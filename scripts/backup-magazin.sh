#!/usr/bin/env bash
# Backup expire365 (magazin) SQLite DB + product uploads.
# Safe while the app is running: uses sqlite3 .backup (not a raw file copy).
#
# Policy (default):
#   - 1 local backup per week (crontab)
#   - Keep the 2 newest folders (~2 weeks); each run drops anything older
#   - Once a month: download /var/backups/magazin/ to your PC (optional), then you can
#     clear the folder — next weekly runs recreate up to 2 again
#
# Env (optional):
#   MAGAZIN_APP_DIR      default /var/www/magazin
#   MAGAZIN_DB_PATH      default /var/lib/magazin/data.db
#   MAGAZIN_BACKUP_DIR   default /var/backups/magazin
#   MAGAZIN_BACKUP_KEEP  default 2
#
# Install (weekly, Sunday 03:15 server time):
#   sudo apt install -y sqlite3
#   sudo mkdir -p /var/backups/magazin
#   sudo chmod +x /var/www/magazin/scripts/backup-magazin.sh
#   crontab -e
#   15 3 * * 0 /var/www/magazin/scripts/backup-magazin.sh >> /var/log/magazin-backup.log 2>&1
#
# Monthly download (from your PC), optional clear:
#   scp -r root@YOUR_SERVER:/var/backups/magazin ./magazin-backup-$(date +%Y%m)
#   ssh root@YOUR_SERVER 'rm -rf /var/backups/magazin/*'

set -euo pipefail

APP_DIR="${MAGAZIN_APP_DIR:-/var/www/magazin}"
DB_PATH="${MAGAZIN_DB_PATH:-/var/lib/magazin/data.db}"
BACKUP_DIR="${MAGAZIN_BACKUP_DIR:-/var/backups/magazin}"
KEEP="${MAGAZIN_BACKUP_KEEP:-2}"
UPLOADS_DIR="${APP_DIR}/public/uploads"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="${BACKUP_DIR}/${STAMP}"

mkdir -p "$DEST"

if [[ ! -f "$DB_PATH" ]]; then
  echo "ERROR: database not found: $DB_PATH" >&2
  exit 1
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "ERROR: sqlite3 CLI is required (apt install sqlite3)" >&2
  exit 1
fi

echo "==> Backup ${STAMP}"
echo "    DB:      $DB_PATH"
echo "    Uploads: $UPLOADS_DIR"
echo "    Dest:    $DEST"

# Consistent snapshot even with WAL / live writers.
sqlite3 "$DB_PATH" ".backup '${DEST}/data.db'"
# Compress for smaller download / less disk (~1.3G often shrinks a lot).
gzip -9 "${DEST}/data.db"

if [[ -d "$UPLOADS_DIR" ]]; then
  tar -C "$(dirname "$UPLOADS_DIR")" -czf "${DEST}/uploads.tar.gz" "$(basename "$UPLOADS_DIR")"
else
  echo "    (no uploads dir yet — skipped)"
fi

(
  cd "$DEST"
  sha256sum data.db.gz uploads.tar.gz 2>/dev/null > SHA256SUMS || sha256sum data.db.gz > SHA256SUMS
)

echo "==> Wrote:"
du -sh "$DEST"/* 2>/dev/null || true

# Retention: keep only the newest $KEEP backup folder(s).
KEEP_COUNT=0
for dir in $(ls -1dt "$BACKUP_DIR"/[0-9]*T*Z 2>/dev/null); do
  KEEP_COUNT=$((KEEP_COUNT + 1))
  if [[ "$KEEP_COUNT" -gt "$KEEP" ]]; then
    echo "==> Pruning $dir"
    rm -rf "$dir"
  fi
done

echo "==> Done. Latest: $DEST (~${KEEP} week(s) kept under ${BACKUP_DIR})"
