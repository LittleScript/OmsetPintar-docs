# OMSETKU — PRD + TDD MASTER DOCUMENT v6
## Product Requirements + Technical Design Document
### Versi 4.6.0 | Status: READY TO BUILD

> **Single source of truth** untuk semua update berikutnya.
> Baca seluruh dokumen sebelum menulis kode.
> Path project: `C:\Users\Kent\Desktop\OmsetKu\`

---

## BAGIAN 0 — IDENTITAS PROYEK

| Atribut | Nilai |
|---|---|
| Nama App | **OmsetKu** |
| Package Android | `com.omsetku.app` |
| Versi Saat Ini | **4.6.0** (versionCode: 23) |
| EAS Project | `@aliangkoko/omsetku` |
| EAS Project ID | `27500f1c-6b40-4014-be88-463faa8d9ad0` |
| Expo Account | `aliangkoko` (aliangkoko@gmail.com) |
| GitHub Docs | `https://github.com/LittleScript/OmsetKu-docs` |
| Privacy Policy | `https://littlescript.github.io/OmsetKu-docs/` |
| Platform | Android (Expo Managed Workflow) |
| Bahasa | JavaScript (bukan TypeScript) |
| Storage | expo-sqlite (SQLite lokal, offline-first) |
| Build Tool | EAS Build (cloud) |

### Scope Produk
App ini **murni untuk pencatatan omset penjualan** dari sales. TIDAK ada hutang/piutang, kasir/POS, atau stok barang. Satu instalasi = satu toko.

### Riwayat Versi
| Versi | Tanggal | Highlight |
|---|---|---|
| 1.0.0 | 2026-05-28 | Initial build |
| 3.1.2–4.2.0 | 2026-05-29 s/d 06-01 | [Lihat PRD v5 untuk detail] |
| 4.2.1–4.2.3 | 2026-06-01 | Bugfix: migrasi DB, OAuth invariantClientId crash, icon APK |
| 4.3.0 | 2026-06-01 | Jaro-Winkler typo detection, Share period picker, GDrive Android OAuth |
| 4.4.x | 2026-06-01 | GDrive client ID, restore dari Drive, tampilan sync UX, kartu share gambar |
| 4.5.0 | 2026-06-01 | Onboarding carousel, perbandingan %, notif cerdas, Excel per periode, refactor src/ |
| **4.6.0** | 2026-06-01 | Auto-sync foreground, DB pagination History, lock timeout kustom, screening fix 10 issues |

---

## BAGIAN 1 — PRODUCT REQUIREMENTS (PRD)

### 1.1 Target Pengguna
- Owner toko retail / UMKM Indonesia
- 1–20 sales per toko
- 10–500 transaksi per hari
- Satu instalasi = satu toko (tidak multi-tenant)
- Tidak butuh internet untuk penggunaan harian (offline-first)

### 1.2 Fitur Aktif (v4.6.0)

#### F-00: ONBOARDING CAROUSEL
- 3 slide saat install pertama: Welcome · Pantau Bisnis · Data Aman
- Swipe horizontal + dot indicator warna per slide
- Tombol Skip (slide 1–2) dan Mulai Sekarang (slide 3)
- Hanya muncul sekali — ditandai di DB (`onboarding_done`)
- User yang upgrade dari versi lama langsung ke main app

#### F-01: SETUP WIZARD (5 Langkah)
- Langkah 1: Nama bisnis
- Langkah 2: Jumlah sales (1–20)
- Langkah 3: Nama-nama sales (auto-uppercase, uncontrolled useRef)
- Langkah 4: Format nomor bon: prefix + separator + digit length + preview real-time
- Langkah 5: Format tanggal: DD/MM/YYYY | MM/DD/YYYY | YYYY/MM/DD

#### F-02: INPUT TRANSAKSI
- **Nomor bon**: navigasi ‹ › (±1), tap untuk edit langsung, auto-generate
- **Tanggal**: navigasi ‹ ›, tap untuk DateTimePicker native Android
- **Sales**: chip horizontal, default = sales terakhir
- **Nama pelanggan**: autocomplete 3-level, dismiss otomatis, focus kembali setelah save
- **Nominal**: number-pad, preview Rp format
- **Catatan**: opsional
- **Duplikat warning**: cek bon+customer+amount identik
- **Save**: animasi ✓, haptic feedback, reset form, double-tap prevention

#### F-03: DASHBOARD
- Year selector ‹ ›
- **Card Hari Ini**: total + perbandingan % vs kemarin (↑↓)
- **Card Minggu Ini**: total + perbandingan % vs minggu lalu (↑↓)
- KPI: Total Omset + Rata-rata per bon
- Progress bar per sales
- Grafik Bulanan: bar chart side-by-side per sales
- Distribusi Omset: proportion bar per sales
- Hari Tersibuk: horizontal bar + filter bulan
- **Share Rekap sebagai Gambar**: modal full-screen dengan tab Hari/Minggu/Bulan/Tahun, navigator bebas, preview kartu navy, capture PNG dan share

#### F-04: RIWAYAT (HISTORY)
- **DB Pagination**: query langsung dari SQLite (LIMIT/OFFSET), bukan from in-memory
- Search: nama pelanggan atau nomor bon — filter di SQL
- Filter chip: ALL + setiap sales
- refreshSignal: reload otomatis setelah setiap write operation
- Edit transaksi: modal, DateTimePicker, Edit Log before/after
- Soft delete + Pulihkan
- isMounted guard: aman dari setState setelah unmount

#### F-05: RANKING PELANGGAN
- Period: Hari | Minggu | Bulan | Tahun dengan navigator ‹ ›
- Sales selector tabs
- Podium top 3 + full list

#### F-06: PELANGGAN
- Search + filter per sales + sort 3 opsi
- Detail Pelanggan: stats + history
- **Cek Typo Nama**:
  - Algoritma: **Jaro-Winkler** + **Token Sort** (ganti Levenshtein)
  - Threshold: ≥88% similarity → flagged
  - Word Overlap: nama parsial (kata kunci ≥5 char)
  - **Abaikan persisten**: disimpan ke tabel `typo_ignored` di DB
  - Ignored pairs tidak muncul lagi di sesi berikutnya
  - FlatList (bukan ScrollView) → scroll berfungsi

#### F-07: SETTINGS

**Bisnis & Sales:**
- Edit nama bisnis
- Tambah/hapus sales

**Format:**
- Format nomor bon (prefix + separator + digit)
- Format tanggal (3 opsi)

**Google Drive Backup & Sync:**
- **Tap area email** → trigger sinkron (bukan tombol terpisah)
- Status: "Synchronizing data..." / "Last sync: HH:MM" / "Tap untuk sinkron"
- Tombol **☁️ Backup** (manual) + **📥 Restore** (pilih dari daftar file Drive)
- Backup otomatis: jam bisa dikustom ‹ HH:00 ›
- **Sinkron 2 HP**: Pull Drive → Merge lokal → Push merged (silent)
- **Auto-sync foreground**: otomatis jika >4 jam sejak sync terakhir
- Refresh token: auto-renew tanpa reconnect manual

**LAPORAN** (section terpisah):
- Export Excel (.xlsx): pilih periode (Tahun / Bulan tertentu ‹ ›)
- Sheet: Ringkasan | Transaksi | Per Sales | Pelanggan | Ranking (sesuai checklist)

**DATA:**
- IMPORT: CSV (Google Sheets) | Restore JSON dari file lokal | Restore dari Drive
- EXPORT & BACKUP: CSV | Backup JSON
- DANGER: Reset Semua Data

**Keamanan:**
- Kunci Aplikasi: fingerprint/PIN HP
- **Timeout kustom**: Langsung | 30 detik | 1 menit | 5 menit

**Notifikasi:**
- Toggle + pilih jam ‹ HH:00 ›
- **Cerdas**: hanya muncul jika belum ada transaksi hari ini

**Tampilan:**
- Dark | Light | Ikuti HP

#### F-08: EXIT & NAVIGASI
- Double back press: toast + exit dalam 2 detik
- Warning pindah tab jika ada input belum tersimpan

---

### 1.3 Yang TIDAK Ada
- Login password / Google Auth
- Multi-cabang / multi-toko dalam satu install
- Widget Android homescreen
- Hutang/piutang atau manajemen stok
- Target omset per sales ← backlog
- In-App Review prompt ← backlog

---

## BAGIAN 2 — TECHNICAL DESIGN (TDD)

### 2.1 Tech Stack

| Layer | Teknologi | Versi |
|---|---|---|
| Framework | React Native via Expo | `expo ~52.0.0` |
| Language | JavaScript | ES2020+ |
| Database | expo-sqlite | `~15.1.4` |
| File System | expo-file-system | `~18.0.0` |
| Sharing | expo-sharing | `~13.0.0` |
| Image Capture | react-native-view-shot | `~4.0.3` |
| Date Picker | @react-native-community/datetimepicker | `8.2.0` |
| Document Picker | expo-document-picker | `~13.0.3` |
| Haptics | expo-haptics | `~14.0.1` |
| Excel | xlsx (SheetJS CE) | `^0.18.5` |
| Biometrics | expo-local-authentication | `~15.0.2` |
| Secure Storage | expo-secure-store | `~14.0.1` |
| Background Task | expo-background-fetch + expo-task-manager | `~13.0.6` / `~12.0.6` |
| OAuth | expo-auth-session + expo-web-browser | `~6.0.3` / `~14.0.2` |
| Notifications | expo-notifications | `~0.29.14` |
| Build | EAS Build cloud | `eas-cli 20.0.0` |
| React | React | `18.3.1` |
| React Native | React Native | `0.76.9` |

### 2.2 Yang TIDAK Dipakai
```
TIDAK: recharts / chart-kit / SVG  → custom bar chart RN Views
TIDAK: AsyncStorage                 → expo-sqlite
TIDAK: react-navigation             → tab state via useState
TIDAK: TypeScript                   → plain JavaScript
TIDAK: Zustand / Redux              → useState lokal + reloadData pattern
TIDAK: StyleSheet.create            → getStyles(C) plain objects
```

### 2.3 Arsitektur Modular (sejak v4.5.0)

```
App.js (~720 baris, entry point + App component)
│
src/
├── constants.js    (85)   — MONTHS, COLORS, themes, GDRIVE_*, TABS, APP_VER, ONBOARDING_SLIDES
├── theme.js        (61)   — ThemeContext, getStyles(C), btnStyle, chipStyle, SalesChip, KpiCard
├── utils.js        (275)  — format, date, analytics, Jaro-Winkler, typo detection, CSV parser
├── db.js           (295)  — initDb, CRUD, migrations, assembleData, DB pagination
├── services.js     (155)  — GDrive auth/upload, notifications handler, background task
└── screens/
    ├── OnboardingScreen.js  (108)
    ├── SetupWizard.js       (128)
    ├── InputScreen.js       (316)
    ├── DashboardScreen.js   (620)
    ├── HistoryScreen.js     (330)
    ├── RankingScreen.js     (165)
    ├── CustomersScreen.js   (418)  — includes CustomerDetailModal + getCustomerList
    └── SettingsModal.js    (1340)
```

### 2.4 State Management Pattern
```
write to SQLite
    ↓
reloadData() — assembleData(db) + setRefreshSignal(s => s+1)
    ↓
setData(fresh) → Analytics screens re-render
    ↓
HistoryScreen mendeteksi refreshSignal → DB query ulang (pagination)
```
- Satu `data` object di App untuk analytics (Dashboard, Ranking, Customers)
- HistoryScreen punya state sendiri — DB pagination via `loadTransactionsPaged`
- ThemeContext hanya untuk tema

### 2.5 Bug Berulang — WAJIB CEK Setiap Update

> ⚠️ CEK INI SEBELUM SETIAP BUILD:
> 1. `ThemeContext.Provider` harus di App component, BUKAN di komponen lain
> 2. `const st = getStyles(C)` ada di App component sebelum `return`
> 3. `initDb()`: CREATE TABLE harus SEBELUM blok ALTER — fresh install butuh semua kolom
> 4. `expo-auth-session v6`: Google.useAuthRequest wajib ada `clientId` — tanpanya crash startup
> 5. Setiap fungsi baru di screen file: pastikan di-import dari src/ yang sesuai

### 2.6 Google Drive Flow (v4.6.0)

```
User tap area email (atau [Hubungkan Akun Google])
    ↓
AuthSession.useAuthRequest (PKCE, androidClientId)
    ↓
Chrome Custom Tab → accounts.google.com → OAuth consent
    ↓
Redirect ke com.omsetku.app:/oauth2redirect?code=AUTH_CODE
    ↓
Exchange code + code_verifier → token endpoint (PKCE, no client_secret)
    ↓
Simpan: accessToken + expiresIn + refreshToken → SecureStore (encrypted)
    ↓
Auto-refresh: jika token expired → refreshGdriveToken() tanpa user action

Sync Flow (tap email di Settings):
App → download latest Drive file → merge transaksi baru → upload merged
    ↓
Auto-sync saat foreground: jika >4 jam sejak sync → sync silent
```

### 2.7 PIN Lock Flow (v4.6.0)

```
Toggle ON → verifikasi fingerprint/PIN dulu
    ↓ success
pin_lock_enabled = 1 + lock_timeout = [pilihan user] → DB
    ↓
App launch (pinLockEnabled=true) → isLocked=true → Lock Screen
Background → catat waktu masuk background
App foreground:
  - lockTimeout=0 (Langsung): lock saat masuk background
  - lockTimeout>0: cek elapsed time → jika > timeout → lock
    ↓
Auto-prompt fingerprint → setIsLocked(false) → Main App
```

### 2.8 Notification Flow (v4.6.0)

```
scheduleReminder(hour, forceReschedule=false)
  - forceReschedule=false (startup): skip jika sudah ada jadwal
  - forceReschedule=true (user action): cancel + jadwal ulang

setNotificationHandler (module level, services.js):
  - Saat notif tiba: cek DB untuk transaksi hari ini
  - Jika sudah ada transaksi → suppress (shouldShowAlert: false)
  - Jika belum ada → tampilkan
```

### 2.9 Excel Export — Style Library
```js
S.title  — Navy bg (#1E3A5F), white bold 16pt
S.meta   — Light blue bg, navy text 9pt
S.secH   — Blue bg (#2563EB), white bold 11pt
S.colH   — Dark blue (#1D4ED8), white bold 10pt
S.lbl    — Slate-50 bg, slate text bold
S.acc    — Orange bg (#FFF7ED), orange bold 13pt
S.tot    — Green bg (#F0FDF4), green bold
S.r0/r1  — White/Slate-50 alternating rows
numFmt: '#,##0'  — format rupiah
safeSheetName()  — sanitasi nama sheet (max 31 char, hapus karakter ilegal)
```

---

## BAGIAN 3 — DATABASE SCHEMA (v4.6.0)

### 3.1 File Database
```
OmsetKu.db
```

### 3.2 Tabel settings (1 row, id=1)
```sql
CREATE TABLE IF NOT EXISTS settings (
  id                 INTEGER PRIMARY KEY DEFAULT 1 CHECK(id=1),
  company_name       TEXT    NOT NULL DEFAULT '',
  is_setup_complete  INTEGER NOT NULL DEFAULT 0,
  bon_prefix         TEXT    NOT NULL DEFAULT 'INV',
  bon_separator      TEXT    NOT NULL DEFAULT '-',
  bon_digit_length   INTEGER NOT NULL DEFAULT 5,
  date_format        TEXT    NOT NULL DEFAULT 'dd/mm/yyyy',
  active_year        INTEGER NOT NULL DEFAULT [tahun sekarang],
  last_date          TEXT    NOT NULL DEFAULT [hari ini],
  last_sales         TEXT    NOT NULL DEFAULT '',
  current_seq        INTEGER NOT NULL DEFAULT 1,
  theme_mode         TEXT    NOT NULL DEFAULT 'dark',
  pin_lock_enabled   INTEGER NOT NULL DEFAULT 0,
  notif_enabled      INTEGER NOT NULL DEFAULT 0,
  notif_hour         INTEGER NOT NULL DEFAULT 20,
  onboarding_done    INTEGER NOT NULL DEFAULT 0,
  lock_timeout       INTEGER NOT NULL DEFAULT 30
);
```

### 3.3 Tabel sales
```sql
CREATE TABLE IF NOT EXISTS sales (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL UNIQUE,
  color         TEXT    NOT NULL DEFAULT '#2563eb',
  active        INTEGER NOT NULL DEFAULT 1,
  display_order INTEGER NOT NULL DEFAULT 0
);
```

### 3.4 Tabel transactions
```sql
CREATE TABLE IF NOT EXISTS transactions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  bon_number       TEXT    NOT NULL,
  bon_seq          INTEGER NOT NULL,
  sales_name       TEXT    NOT NULL,
  customer_name    TEXT    NOT NULL,
  customer_norm    TEXT    NOT NULL,
  amount           INTEGER NOT NULL CHECK(amount > 0),
  transaction_date TEXT    NOT NULL,
  year             INTEGER NOT NULL,
  year_month       TEXT    NOT NULL,
  notes            TEXT    NOT NULL DEFAULT '',
  created_at       TEXT    NOT NULL,
  updated_at       TEXT    NOT NULL,
  deleted_at       TEXT,
  edited_at        TEXT,
  original_values  TEXT
);

CREATE INDEX IF NOT EXISTS idx_txn_date     ON transactions(transaction_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_txn_year     ON transactions(year, sales_name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_txn_yearmonth ON transactions(year_month)     WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_txn_customer ON transactions(sales_name, customer_norm) WHERE deleted_at IS NULL;
```

### 3.5 Tabel typo_ignored
```sql
CREATE TABLE IF NOT EXISTS typo_ignored (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  sales   TEXT NOT NULL,
  norm_a  TEXT NOT NULL,
  norm_b  TEXT NOT NULL,
  UNIQUE(sales, norm_a, norm_b)
);
```

### 3.6 SecureStore Keys
```
gdrive_access_token   — OAuth access token
gdrive_refresh_token  — OAuth refresh token (auto-renew)
gdrive_token_expiry   — Timestamp ms expiry token
gdrive_user_email     — Email akun Google
gdrive_last_backup    — Timestamp ms backup/sync terakhir
gdrive_backup_hour    — Jam backup otomatis (0–23, default 23)
```

### 3.7 Migrations (dieksekusi di initDb setiap launch)
```sql
DROP INDEX IF EXISTS idx_bon_unique
ALTER TABLE transactions ADD COLUMN edited_at TEXT
ALTER TABLE transactions ADD COLUMN original_values TEXT
ALTER TABLE settings ADD COLUMN theme_mode TEXT NOT NULL DEFAULT 'dark'
ALTER TABLE settings ADD COLUMN pin_lock_enabled INTEGER NOT NULL DEFAULT 0
ALTER TABLE settings ADD COLUMN notif_enabled INTEGER NOT NULL DEFAULT 0
ALTER TABLE settings ADD COLUMN notif_hour INTEGER NOT NULL DEFAULT 20
ALTER TABLE settings ADD COLUMN onboarding_done INTEGER NOT NULL DEFAULT 0
ALTER TABLE settings ADD COLUMN lock_timeout INTEGER NOT NULL DEFAULT 30
```

---

## BAGIAN 4 — FILE STRUCTURE

```
OmsetKu/
├── App.js                    ← Entry point + App component (~720 baris)
├── app.json                  ← Expo + Android config (v4.6.0, versionCode 23)
├── package.json              ← name: "omsetku", version: "4.6.0"
├── eas.json                  ← Build profiles
├── babel.config.js
├── PRIVACY_POLICY.md         ← Kebijakan Privasi (v4.6.0)
├── GOOGLE_DRIVE_SETUP.md     ← Panduan setup Google Cloud OAuth
├── OmsetKu_PRD_TDD_v6.md    ← Dokumen ini
├── src/
│   ├── constants.js          ← Semua konstanta
│   ├── theme.js              ← ThemeContext + style helpers + SalesChip + KpiCard
│   ├── utils.js              ← Utility + analytics + Jaro-Winkler + CSV
│   ├── db.js                 ← SQLite layer (initDb, CRUD, pagination)
│   ├── services.js           ← GDrive + notifications + background task
│   └── screens/
│       ├── OnboardingScreen.js
│       ├── SetupWizard.js
│       ├── InputScreen.js
│       ├── DashboardScreen.js
│       ├── HistoryScreen.js
│       ├── RankingScreen.js
│       ├── CustomersScreen.js
│       └── SettingsModal.js
├── docs/
│   ├── index.html            ← Privacy Policy web (GitHub Pages)
│   └── .nojekyll
└── assets/
    ├── icon.png              ← 1024×1024, background putih, logo 68%
    ├── adaptive-icon.png     ← Background transparan, logo 60% safe zone
    ├── splash.png            ← Dark bg (#071018)
    ├── favicon.png
    └── logo.png
```

### 4.1 app.json (ringkasan)
```json
{
  "expo": {
    "name": "OmsetKu",
    "slug": "omsetku",
    "version": "4.6.0",
    "scheme": "com.omsetku.app",
    "backgroundColor": "#071018",
    "userInterfaceStyle": "automatic",
    "android": {
      "package": "com.omsetku.app",
      "versionCode": 23,
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#FFFFFF"
      }
    },
    "plugins": [
      "expo-sqlite", "expo-asset",
      "@react-native-community/datetimepicker",
      "expo-local-authentication", "expo-secure-store",
      "expo-notifications"
    ]
  }
}
```

### 4.2 Google Cloud OAuth
- **Android Client ID**: `846894493859-7mnsos08bck0on5p03v66uopqbeld1g6.apps.googleusercontent.com`
- **Redirect URI**: `com.omsetku.app:/oauth2redirect` (custom scheme, Android client)
- **Scopes**: `drive.file`, `email`, `profile`
- **Flow**: Authorization Code + PKCE (tanpa client secret)
- **Status**: Testing mode (test users only) — perlu submit verifikasi untuk Production

---

## BAGIAN 5 — BUG FIXES HISTORY

| Bug | Versi Fix | Deskripsi |
|---|---|---|
| BUG-01–21 | v1.0–4.1 | [Lihat PRD v5 untuk detail] |
| BUG-22 | v4.2.1 | initDb: CREATE TABLE setelah ALTER → fresh install kehilangan kolom |
| BUG-23 | v4.2.3 | expo-auth-session v6: invariantClientId() crash saat render (tanpa clientId) |
| BUG-24 | v4.2.x | GDrive: useProxy deprecated → Error 400/403 |
| BUG-25 | v4.3.0 | Notif langsung tembak: trigger type 'daily' tidak digunakan |
| BUG-26 | v4.3.0 | Typo modal tidak bisa scroll (ScrollView tanpa flex:1) |
| BUG-27 | v4.3.0 | Threshold Levenshtein terlalu longgar → 89 false positives |
| BUG-28 | v4.4.x | GDrive Error 400 custom scheme + Error 403 Expo proxy deprecated |
| BUG-29 | v4.5.0 (screening) | SettingsModal: scheduleReminder, cancelReminder, padNum tidak diimport |
| BUG-30 | v4.5.0 (screening) | Stale closure handleSyncDrive di auto-sync AppState listener |
| BUG-31 | v4.5.0 (screening) | handleSyncDrive pakai data.transactions stale → gunakan DB langsung |
| BUG-32 | v4.5.0 (screening) | PctTag di dalam DashboardScreen component → React anti-pattern |

---

## BAGIAN 6 — DESIGN SYSTEM

### 6.1 Color Palette
```js
DARK_THEME  = { bg:'#071018', card:'#0f1720', input:'#0a1929', border:'rgba(255,255,255,0.07)',
                primary:'#2563eb', success:'#22c55e', warning:'#f59e0b', text:'#f1f5f9',
                muted:'#64748b', accent:'#F57F17', danger:'#ef4444' }
LIGHT_THEME = { bg:'#f0f4f8', card:'#ffffff', input:'#e2e8f0', border:'rgba(0,0,0,0.09)',
                primary:'#2563eb', success:'#16a34a', warning:'#d97706', text:'#1e293b',
                muted:'#64748b', accent:'#ea580c', danger:'#dc2626' }
COLORS = ['#2563eb','#22c55e','#f59e0b','#ec4899','#8b5cf6','#ef4444','#06b6d4','#84cc16']
```

### 6.2 Bottom Tab Bar
| Tab | Icon | ID |
|---|---|---|
| Input | ✚ | `input` |
| Dashboard | ◈ | `dashboard` |
| Riwayat | ☰ | `riwayat` |
| Ranking | ★ | `ranking` |
| Pelanggan | ◉ | `pelanggan` |

---

## BAGIAN 7 — CARA BUILD APK

### Prerequisites
```bash
node --version   # v24.15.0
eas --version    # 20.0.0
eas whoami       # aliangkoko
```

### Build APK (preview/testing)
```bash
cd "C:\Users\Kent\Desktop\OmsetKu"
git add -A
git commit -m "deskripsi"
eas build --platform android --profile preview --non-interactive
```

### Build AAB (Google Play Store)
```bash
eas build --platform android --profile production --non-interactive
```

### Checklist Sebelum Build
- [ ] `npx expo export --platform android` — tidak ada error
- [ ] `ThemeContext.Provider` ada di App, BUKAN di komponen lain
- [ ] `const st = getStyles(C)` ada di App sebelum `return`
- [ ] `APP_VER` di `src/constants.js` sudah update
- [ ] `version` di `app.json` sudah update
- [ ] `versionCode` di `app.json` naik 1
- [ ] `version` di `package.json` sudah update
- [ ] `git commit` sudah dilakukan

### Cara Bump Versi
1. `APP_VER = 'X.Y.Z'` di `src/constants.js`
2. `"version": "X.Y.Z"` di `app.json`
3. `"versionCode": N+1` di `app.json`
4. `"version": "X.Y.Z"` di `package.json`

---

## BAGIAN 8 — TROUBLESHOOTING

| Error | Penyebab | Fix |
|---|---|---|
| App tidak bisa dibuka (crash startup) | invariantClientId() → clientId hilang | Cek `src/constants.js`: GOOGLE_ANDROID_CLIENT_ID tidak boleh kosong/placeholder |
| `ReferenceError: scheduleReminder` | Import hilang di SettingsModal | Tambah import dari `../services` |
| `Metro bundler failed` | Cache kotor | `npx expo start --clear` |
| GDrive Error 400 custom scheme | Redirect URI tidak terdaftar | Cek Custom URI scheme enabled di Google Cloud Console |
| GDrive Error 403 access_denied | Email belum di test users | Tambah di OAuth Consent Screen → Test users |
| Token expired | refresh_token gagal | Reconnect sekali → refresh_token baru akan auto-renew |
| Notifikasi tidak muncul | Izin belum diberikan atau sudah ada transaksi hari ini | Cek izin + notif cerdas aktif |
| History tidak reload setelah edit | refreshSignal tidak naik | Pastikan reloadData() dipanggil setelah setiap write |
| `EAS quota habis` | Free plan limit bulanan | Tunggu reset tanggal 1 / upgrade plan |

---

## BAGIAN 9 — PANDUAN UPDATE

### Cara Push Privacy Policy ke GitHub Pages
```bash
cd "C:\Users\Kent\Desktop\OmsetKu"
# edit docs/index.html
git add docs/ PRIVACY_POLICY.md
git commit -m "docs: update privacy policy"
git subtree push --prefix docs origin master
# remote: https://github.com/LittleScript/OmsetKu-docs.git
```

### Cara Tambah Kolom DB Baru
1. Tambahkan kolom ke CREATE TABLE di `src/db.js` (initDb)
2. Tambahkan migration `ALTER TABLE ... ADD COLUMN` di blok migrasi
3. Tambahkan ke `assembleData()` return object
4. Tambahkan handling ke `updateSettings()` jika bisa diubah user
```js
// Pattern migration:
try { await db.execAsync(`ALTER TABLE settings ADD COLUMN nama_kolom TEXT DEFAULT ''`); }
catch(e) {} // kolom sudah ada — aman
```

### Cara Tambah Screen Baru
1. Buat file baru di `src/screens/NamaScreen.js`
2. Import yang dibutuhkan dari `../theme`, `../constants`, `../utils`, `../db`
3. Export: `export default NamaScreen;`
4. Import di `App.js`: `import NamaScreen from './src/screens/NamaScreen';`
5. Tambahkan tab/route di App render dan TABS constant di `src/constants.js`

### Cara Tambah Dependency Baru
```bash
cd "C:\Users\Kent\Desktop\OmsetKu"
npx expo install nama-package
# Jika butuh native module → tambah ke plugins di app.json
git add package.json package-lock.json app.json
git commit -m "add: nama-package"
# Rebuild diperlukan setelah install native module
```

---

## BAGIAN 10 — BACKLOG (Terurut Prioritas)

| # | Fitur | Prioritas | Status |
|---|---|---|---|
| B-01 | Google Drive OAuth Verification (Production) | 🔴 High | Pending — submit ke Google |
| B-02 | In-App Review prompt | 🟡 Medium | Belum diimplementasi |
| B-03 | Target omset per sales | 🟢 Low | Belum diimplementasi |
| B-04 | Widget Android | 🟢 Low | Belum diimplementasi |
| B-05 | Auto-kompres gambar share (kartu rekap) | 🟢 Low | File PNG terlalu besar |

**Fitur yang sudah selesai dari backlog lama:**
- ✅ B-01 Refresh token → PKCE flow (auto-renew)
- ✅ B-02 Onboarding carousel → v4.5.0
- ✅ B-04 Perbandingan % → v4.5.0
- ✅ B-06 Notifikasi cerdas → v4.5.0/4.6.0
- ✅ B-08 Export Excel per periode → v4.5.0

---

## BAGIAN 11 — CHECKLIST GOOGLE PLAY RELEASE

| Item | Status | Keterangan |
|---|---|---|
| Build AAB (production) | ⏳ | Siap setelah kuota EAS tersedia |
| Privacy Policy URL | ✅ | https://littlescript.github.io/OmsetKu-docs/ |
| Google Play Console ($25) | ✅ | Sudah terdaftar |
| Screenshot app (2–8 gambar) | ⏳ | Ambil dari HP |
| Feature graphic 1024×500 | ⏳ | Buat di Canva |
| Deskripsi app Bahasa Indonesia | ⏳ | Perlu dibuat |
| Data Safety form | ⏳ | Isi di Play Console |
| Rating konten questionnaire | ⏳ | Isi di Play Console |
| OAuth Verification Google | ⏳ | Submit setelah app live |
| Upload AAB + review + publish | ⏳ | Langkah terakhir |

---

## BAGIAN 12 — SOP OPERASIONAL

### SOP-01: Rilis Versi Baru
```
1. Kode sudah di-commit (git status bersih)
2. Jalankan: npx expo export --platform android (harus 0 error)
3. Bump versi di src/constants.js, app.json, package.json
4. git add -A && git commit -m "release: vX.Y.Z — deskripsi"
5. eas build --platform android --profile preview --non-interactive
6. Test APK di HP fisik:
   - Coba semua tab utama
   - Input transaksi → save → cek di Riwayat
   - Cek Dashboard angka
   - Coba export Excel
7. Jika semua OK → build production (AAB) untuk Play Store
```

### SOP-02: Update Privacy Policy
```
1. Edit docs/index.html dan PRIVACY_POLICY.md
2. Update tanggal "Terakhir diperbarui"
3. Update versi di badge/footer
4. git add docs/ PRIVACY_POLICY.md && git commit -m "docs: update PP"
5. git subtree push --prefix docs origin master
6. Verifikasi: https://littlescript.github.io/OmsetKu-docs/
```

### SOP-03: Tambah Fitur Baru
```
1. Diskusikan scope fitur dan dampaknya ke PRD/TDD
2. Update dokumen ini (PRD) sebelum coding
3. Buat/edit file di src/ yang relevan
4. Jalankan expo export untuk verifikasi bundle
5. Test fitur di emulator/HP
6. Update PRD/TDD setelah implementasi
7. Commit + build
```

### SOP-04: Investigasi Bug
```
1. Reproduksi bug: langkah, versi HP, versi app
2. Cek log: expo start → lihat error di Metro
3. Cek screening notes di Bagian 5 (Bug History)
4. Fix + tulis test case mental
5. Tambahkan ke Bug History
6. Bump patch version (X.Y.Z → X.Y.Z+1)
```

---

*Dokumen ini mencerminkan kode aktual OmsetKu v4.6.0*
*Update dokumen setiap kali ada perubahan signifikan*
*Path project: `C:\Users\Kent\Desktop\OmsetKu\`*
*GitHub Docs: `https://github.com/LittleScript/OmsetKu-docs`*
