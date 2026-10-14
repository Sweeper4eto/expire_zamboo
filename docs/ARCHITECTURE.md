# Magazin — архитектура

**Last updated:** 2026-09-13

Мобилно-оптимизирано уеб приложение за управление на стока по магазини, срок на годност, клиенти и месечни плащания.

## Технологии

| Слой | Избор |
|------|--------|
| Frontend + API | Next.js 16, React 19, Tailwind |
| База данни | SQLite (dev) / PostgreSQL (prod) |
| ORM | Prisma 7 + better-sqlite3 adapter |
| Auth | JWT в httpOnly cookie |
| Баркод | html5-qrcode |
| Снимки | MediaDevices API + качване в `public/uploads` |
| PWA | Web manifest, service worker, икони за „Добави на началния екран“ |

## Роли

- **ADMIN** — `/admin`: клиенти, магазини, потребители, плащания
- **USER** — `/app`: сканиране, въвеждане, годност (след асайнване)

## Функционалност

### Админ панел

- **Акаунти (hub):** списък бизнес/домакинство в отделни секции; за всеки акаунт — Overview, Locations, People, Billing (такса, require payments, mark paid)
- **Плащания / lock:** `Client.paymentsRequired` + `paymentsRequiredSince` (месецът, от който тече таксуването). Lock (`clientRequiresPayment`) само при **просрочен** неплатен месец *преди* текущия; текущият месец може да се плати по всяко време. Пример: включено от 1 окт. → lock от 1 ноем. ако окт. е неплатен. Household и fee ≤ 0 са освободени.
- **Плащания (portfolio):** календар / standing по клиент
- **Потребители:** глобално търсене като подтаб в Accounts
- **Плащания:** portfolio „кой дължи“ + by-month; редакция на такса/обекти е в Account → Billing
- **Audit log:** подтабове Business / Household; филтри по акаунт (само от текущия тип), потребител, обект, IP, период
- **Items / Support / What’s new:** както досега
- **Minimart locator:** карта + CRM статуси; пин може да се свърже с **Business** Client (`clientId`, без household); един клиент → много пинове; sync не пипа status/comment/clientId

### Потребител

- Регистрация → „Please contact administrator for Customer assignment“
- Логин без клиент или с неактивен клиент → грешка
- Dropdown магазин (запомня се в `localStorage`)
- **Сканирай:** камера/ръчно → продукт → количество 1–20 → дата → запис
- **Въведи стока:** баркод → име → снимка → глобална база
- **Документ:** `/app/add-document` — live in-app камера (`getUserMedia`), не native iOS picker, за да няма повторно питане за разрешение при „Нов скан“ / Retake
- **Годност:** сортиране по срок, цветове, премахване

### Placeholder за липсваща снимка

`ProductImage` (`src/components/product-image.tsx`) показва **`NoPicturePlaceholder`** когато няма `imagePath` или зареждането е неуспешно:

- Илюстрация: **#29 Mini market scene** (малък щанд с стоки)
- Стил: **mint glow** — mint рамка, radial halo, mint икона (`text-accent`)
- Компонент: `src/components/no-picture-placeholder.tsx`
- Достъпност: `aria-label` от `common.noPicture` (без видим текст „Няма снимка“)

### What's new (новости за потребители)

- Каталог в код: `src/lib/whats-new-catalog.ts` — при всяка **видима** промяна се добавя нов ред (`key`, EN, BG, по желание `href`).
- Sync: Admin → **What's new** (GET `/api/admin/whats-new`) създава **Draft** редове автоматично.
- Публикуване: админ избира редове → **Push to users** → потребителите виждат sheet на `/app`.
- Разработчикът **не** пише текст в админ панела — само в каталога; админът само пуска Live.

### Push известия за годност (phases 1–3)

- **Настройки:** `/app/settings/notifications` — ранно/спешно напомняне (дни + **отделен час** за всяко ниво), филтър по обект; timezone dropdown (auto-detect до първо Save, после запазената стойност). График „веднъж/два пъти дневно“ е премахнат — всяко ниво е винаги **веднъж дневно**.
- **API:** `GET/PATCH /api/push/notification-settings` (auth user).
- **Admin defaults:** полета на `Client` + секция в Admin → Accounts → Overview (за потребители без собствени настройки).
- **Изпращане:** `sendExpiryDigests()` в `src/lib/push-expiry.ts` — Early и Urgent са **независими** digest-и (`expiry-digest-early` / `expiry-digest-urgent`); всеки с собствен час (`time1` / `time2`). Ако часовете съвпадат, се пращат и двете. Продукт в двата прозореца може да влезе и в двата digest-а. Пращане в **15‑минутен** слот около избрания час.
- **Cron:** `POST /api/cron/expiry-notifications` (header `x-cron-secret`) — `*/15 * * * *`; purge cron също вика digest, но за точния слот трябва 15‑минутен cron.

### Годност и purge

- Видими: изтичащи в следващите 3 месеца или изтекли до 6 месеца назад
- Цветове: ≤7д червено, ≤14д жълто, ≤28д синьо
- `removedAt` — ръчно премахване от списъка
- `deletedAt` — hard delete 6 месеца след изтичане (cron + при зареждане на списъка)
- **Намалена цена:** `priceReducedAt` + `priceDiscountPercent` + `priceReducedByUserId` — last editor (който последно е включил/сменил %); при restore се чистят; UI footer „Reduced by / Намалил“ + дата/час

## API

| Метод | Път | Описание |
|-------|-----|----------|
| POST | `/api/auth/register` | Регистрация |
| POST | `/api/auth/login` | Вход |
| GET | `/api/auth/me` | Потребител + магазини |
| GET/POST/PATCH/DELETE | `/api/admin/clients` | Клиенти |
| GET/POST/PATCH/DELETE | `/api/admin/stores` | Магазини |
| GET/PATCH | `/api/admin/users` | Потребители |
| GET/POST/PATCH/DELETE | `/api/admin/minimart-locator` | Minimart карта (sync/create/edit; optional `clientId`) |
| GET | `/api/admin/payments/calendar` | Календарен изглед |
| GET/POST | `/api/products` | Продукти |
| GET/POST/PATCH | `/api/inventory` | Стока в магазин |
| POST | `/api/upload` | Качване на снимка |
| POST/GET | `/api/cron/purge-inventory` | Hard delete (header `x-cron-secret`) |

## PWA (Progressive Web App)

Приложението може да се **добави на началния екран** на телефона и да се отваря на цял екран като приложение.

- Manifest: `src/app/manifest.ts` → `/manifest.webmanifest`
- Service worker: `public/sw.js` (кешира основни страници; API заявките винаги са online)
- Икони: `public/icons/` (генерират се с `npm run icons`)

### iPhone (Safari)

1. Отворете сайта в Safari
2. Бутон **Сподели** → **Add to Home Screen** / **Добави на началния екран**

### Android (Chrome)

1. Отворете сайта в Chrome
2. Меню → **Инсталирай приложение** или **Добави на началния екран**

> За камерата на телефон в production е препоръчително **HTTPS**.

## Cron

Извикване (напр. от systemd/cron job):

```bash
curl -X POST -H "x-cron-secret: YOUR_SECRET" http://localhost:3000/api/cron/purge-inventory
```

## Backups (VPS / SQLite)

Production DB is SQLite (`MAGAZIN_DB_PATH`, default `/var/lib/magazin/data.db`). Photos are under `public/uploads`.

Script: `scripts/backup-magazin.sh`

**Policy:** 1 local backup per week; keep the **2 newest** folders (~2 weeks / ~2–3 GB compressed). Each run deletes anything older. Once a month you can download `/var/backups/magazin/` to your PC.

```bash
# Once on the server
sudo apt install -y sqlite3
sudo mkdir -p /var/backups/magazin
sudo chmod +x /var/www/magazin/scripts/backup-magazin.sh

# Crontab — every Sunday 03:15
15 3 * * 0 /var/www/magazin/scripts/backup-magazin.sh >> /var/log/magazin-backup.log 2>&1
```

Monthly (from your PC):

```bash
scp -r root@YOUR_SERVER:/var/backups/magazin ./magazin-backup-$(date +%Y%m)
ssh root@YOUR_SERVER 'rm -rf /var/backups/magazin/*'
```

Restore (stop app first):

```bash
pm2 stop magazin
gunzip -c /path/to/backup/data.db.gz > /var/lib/magazin/data.db
# optional: restore uploads
tar -C /var/www/magazin/public -xzf /path/to/backup/uploads.tar.gz
pm2 start magazin
```

## Стартиране

```bash
cd D:\Work\magazin
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

Админ: `admin` / `admin123`

## Тестове

```bash
npm run validate   # lint + test + build
```

`tests/expiry.test.ts` — формула за плащания, видимост и цветове на годност.
`tests/no-picture-placeholder.test.ts` — избран placeholder (#29 + mint glow).
