#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${MAGAZIN_APP_DIR:-/var/www/magazin}"
SCRIPT_PATH="${APP_DIR}/scripts/update-magazin.sh"
DB_PATH="${MAGAZIN_DB_PATH:-/var/lib/magazin/data.db}"
MAINTENANCE_FLAG="${MAGAZIN_MAINTENANCE_FLAG:-$APP_DIR/MAINTENANCE}"

cd "$APP_DIR"

enable_maintenance() {
  touch "$MAINTENANCE_FLAG"
  echo "==> Maintenance mode ON ($MAINTENANCE_FLAG)"
}

disable_maintenance() {
  if [[ -f "$MAINTENANCE_FLAG" ]]; then
    rm -f "$MAINTENANCE_FLAG"
    echo "==> Maintenance mode OFF"
  fi
}

# After git reset the file on disk is new, but bash keeps running the old
# inode. Re-exec once so migrate/stop order from origin/master actually runs.
if [[ "${MAGAZIN_UPDATE_REEXEC:-}" != "1" ]]; then
  # Flip maintenance on early (needs nginx snippet from a previous deploy).
  if [[ -f "$APP_DIR/public/maintenance.html" ]]; then
    enable_maintenance
  fi
  echo "==> Syncing to latest origin/master..."
  git fetch origin
  git reset --hard origin/master
  export MAGAZIN_UPDATE_REEXEC=1
  exec bash "$SCRIPT_PATH"
fi

# Clear the flag only after a successful finish. If the script fails mid-update,
# leave MAINTENANCE on so visitors keep seeing the maintenance page.
trap 'code=$?; if [[ $code -ne 0 ]]; then echo "==> Update failed (exit $code) — leaving maintenance ON ($MAINTENANCE_FLAG)"; fi' EXIT

enable_maintenance

# prisma migrate deploy needs DATABASE_URL in the env (prisma.config.ts reads
# it). If .env doesn't provide one, fall back to the known DB path so a missing
# var never blocks migrations.
if [[ -z "${DATABASE_URL:-}" ]]; then
  export DATABASE_URL="file:${DB_PATH}"
  echo "==> DATABASE_URL not set; using ${DATABASE_URL}"
fi

# Stop the app (and stray scripts) before any step touches the SQLite file.
release_db_lock() {
  echo "==> Stopping app and any DB lock holders..."
  pm2 stop magazin 2>/dev/null || true

  # Name-fix / import scripts also open the SQLite file and block migrate.
  pkill -f "tsx scripts/fix-names-from-internet" 2>/dev/null || true
  pkill -f "tsx scripts/fix-images-from-internet" 2>/dev/null || true
  pkill -f "tsx scripts/clean-product-names" 2>/dev/null || true
  pkill -f "tsx scripts/refresh-product-names" 2>/dev/null || true

  if command -v fuser >/dev/null 2>&1 && [[ -e "$DB_PATH" ]]; then
    echo "    Processes using ${DB_PATH}:"
    fuser -v "$DB_PATH" "$DB_PATH-wal" "$DB_PATH-shm" 2>&1 || true
    fuser -k "$DB_PATH" "$DB_PATH-wal" "$DB_PATH-shm" 2>/dev/null || true
  fi

  sleep 2
}

migrate_with_retry() {
  if [[ "${MAGAZIN_SKIP_MIGRATE:-}" == "1" ]]; then
    echo "==> MAGAZIN_SKIP_MIGRATE=1; skipping migrations."
    return 0
  fi

  local attempt
  local status_out
  local deploy_out

  release_db_lock

  status_out="$(npx prisma migrate status 2>&1 || true)"
  echo "$status_out"
  if echo "$status_out" | grep -qi "Database schema is up to date"; then
    echo "==> Schema already up to date; skipping migrate deploy."
    return 0
  fi
  if echo "$status_out" | grep -qi "database is locked"; then
    echo "==> DB locked during migrate status; skipping migrate and continuing build."
    return 0
  fi

  for attempt in 1 2 3 4 5; do
    echo "==> Applying migrations (attempt ${attempt}/5)..."
    deploy_out="$(npx prisma migrate deploy 2>&1)" && {
      echo "$deploy_out"
      return 0
    }
    echo "$deploy_out"
    if echo "$deploy_out" | grep -qi "database is locked"; then
      echo "    Database locked; retrying..."
    else
      echo "    migrate deploy failed; retrying..."
    fi
    release_db_lock
    sleep $((attempt * 2))
  done

  status_out="$(npx prisma migrate status 2>&1 || true)"
  if echo "$status_out" | grep -qi "Database schema is up to date"; then
    echo "==> migrate deploy failed but schema is up to date; continuing."
    return 0
  fi
  if echo "$status_out" | grep -qi "database is locked"; then
    echo "==> DB still locked; skipping migrate and continuing build."
    return 0
  fi

  echo "WARNING: prisma migrate deploy failed — continuing build anyway."
  echo "Check lock holders with: fuser -v $DB_PATH"
  return 0
}

release_db_lock

echo "==> Installing dependencies..."
npm install

echo "==> Generating Prisma client..."
npx prisma generate

migrate_with_retry || {
  echo "WARNING: migrate step failed unexpectedly; continuing build anyway."
}

echo "==> Removing old .next build..."
rm -rf .next

echo "==> Building app (webpack, low-memory friendly)..."
# Skip Next's in-build typecheck on the VPS (OOM / exit 137 on 4GB).
# Local `npm run validate` still typechecks.
export MAGAZIN_SKIP_TYPECHECK="${MAGAZIN_SKIP_TYPECHECK:-1}"
# Keep the heap under typical 4GB RAM after OS + npm overhead.
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=1280}"
npm run build

echo "==> Restarting PM2..."
pm2 restart magazin || pm2 start npm --name magazin -- start

# Give Node a moment to listen before nginx stops returning the maintenance page.
sleep 2

disable_maintenance
echo "==> Done."
