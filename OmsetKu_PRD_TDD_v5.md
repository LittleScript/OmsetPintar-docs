# OMSETKU — PRD + TDD MASTER DOCUMENT v5
## Product Requirements + Technical Design Document
### Versi 4.2.0 | Status: READY TO BUILD

> **Single source of truth** untuk semua update berikutnya.
> Baca seluruh dokumen sebelum menulis kode.
> Path project: `C:\Users\Kent\Desktop\OmsetKu\`

---

## BAGIAN 0 — IDENTITAS PROYEK

| Atribut | Nilai |
|---|---|
| Nama App | **OmsetKu** |
| Package Android | `com.omsetku.app` |
| Versi Saat Ini | **4.2.0** (versionCode: 13) |
| EAS Project | `@aliangkoko/omsetku` |
| EAS Project ID | `27500f1c-6b40-4014-be88-463faa8d9ad0` |
| Expo Account | `aliangkoko` (aliangkoko@gmail.com) |
| GitHub Docs | `https://github.com/LittleScript/OmsetKu-docs` |
| Privacy Policy | `https://littlescript.github.io/OmsetKu-docs/` |
| Platform | Android (Expo Managed Workflow) |
| Bahasa | JavaScript (bukan TypeScript) |
| Storage | expo-sqlite (SQLite lokal, offline-first) |
| Build Tool | EAS Build (cloud) |

### Lokasi Project
```
C:\Users\Kent\Desktop\OmsetKu\
```

### Riwayat Versi
| Versi | Tanggal | Highlight |
|---|---|---|
| 1.0.0 | 2026-05-28 | Initial build |
| 3.1.2 | 2026-05-29 | Rebrand OmsetKu, bugfix, ThemeContext, icon |
| 3.2.0 | 2026-05-30 | Navigasi ‹ › bon & tanggal |
| 3.3.0 | 2026-05-30 | Import CSV Google Sheets |
| 3.4.0 | 2026-05-30 | Rebranding total, dashboard charts, haptic |
| 3.5.0 | 2026-05-30 | Bar chart side-by-side, Excel export checklist |
| 3.6.0 | 2026-05-31 | Excel per sales, auto-focus, hari tersibuk filter |
| 3.7.0 | 2026-05-31 | Double-back exit, warning pindah tab, KPI penuh |
| 3.8.0 | 2026-06-01 | Duplicate warning, share rekap, pagination, PIN lock |
| 3.9.0 | 2026-06-01 | Google Drive backup, Privacy Policy, fix Pulihkan |
| 4.0.0 | 2026-06-01 | Typo detection Levenshtein+word-overlap, backup jam, icon ◉ |
| 4.1.0 | 2026-06-01 | GDrive token expiry tracking, notifikasi harian |
| 4.2.0 | 2026-06-01 | JSON restore, CSV export, Excel professional styling |

---

## BAGIAN 1 — PRODUCT REQUIREMENTS (PRD)

### 1.1 Target Pengguna
- Owner toko retail / UMKM Indonesia
- 1–20 sales per toko
- 10–500 transaksi per hari
- Satu instalasi = satu toko (tidak multi-tenant)
- Tidak butuh internet untuk penggunaan harian (offline-first)

### 1.2 Fitur yang Sudah Diimplementasi (v4.2.0)

#### F-01: SETUP WIZARD (5 Langkah)
- Langkah 1: Nama bisnis
- Langkah 2: Jumlah sales (1–20)
- Langkah 3: Nama-nama sales (auto-uppercase, uncontrolled TextInput via useRef)
- Langkah 4: Format nomor bon: prefix + separator + digit length + preview real-time
- Langkah 5: Format tanggal: DD/MM/YYYY | MM/DD/YYYY | YYYY/MM/DD
- Jika sudah setup → langsung ke main app (skip wizard)

#### F-02: INPUT TRANSAKSI
- **Nomor bon**: navigasi ‹ › (±1 sequence), tap angka untuk edit (prefix static, number-pad), auto-generate dari sequence
- **Tanggal**: navigasi ‹ › (±1 hari), tap untuk DateTimePicker native Android
- **Sales selector**: scroll horizontal chip, default = sales terakhir
- **Nama pelanggan**: controlled TextInput, autocomplete 3 level, suggest tutup otomatis setelah klik, focus otomatis kembali ke nama setelah save, `returnKeyType="next"` ke nominal
- **Nominal**: number-pad, preview Rp format
- **Catatan**: opsional
- **Duplikat warning**: cek bon_number + customer_norm + amount identik → Alert sebelum save
- **Save**: animasi ✓ TERSIMPAN, haptic feedback (`NotificationFeedbackType.Success`), reset nama+nominal, persist sales+tanggal
- **Double-tap prevention**: `saving` flag + `doSave` try-finally

#### F-03: DASHBOARD
- **Year selector** (‹ ›)
- **Card Hari Ini**: total + per sales + tombol 📤 Share rekap (via Android Share Sheet)
- **Card Minggu Ini**: total + jumlah bon
- **KPI cards**: Total Omset (toIdr, `adjustsFontSizeToFit`) + Rata-rata per bon
- **Progress bar per sales**: nilai + persentase
- **Grafik Bulanan**: bar chart **side-by-side** per sales (warna berbeda) + legend
- **Distribusi Omset**: proportion bar + % per sales (hanya jika >1 sales)
- **Hari Tersibuk**: bar horizontal Sen–Min + filter bulan (All | Jan–Des) + icon 🔥

#### F-04: RIWAYAT (HISTORY)
- FlatList **semua** transaksi aktif + soft-deleted — **pagination 30 item/load** (`onEndReached`)
- Search: nama pelanggan atau nomor bon (real-time), reset page saat filter berubah
- Filter chip: ALL + setiap sales
- **Edit transaksi**: modal bottom sheet
  - Nomor bon: prefix static + angka editable (number-pad only)
  - Tanggal: DateTimePicker (bukan TextInput manual)
  - Nama, nominal, catatan, sales selector
  - **Edit Log**: badge `✎ edited` + modal Log Perubahan (before/after semua field)
- **Hapus**: soft delete dengan Alert konfirmasi
- **Pulihkan**: tombol `↩ Pulihkan` (FIXED v3.9.0 — loadTransactions sekarang load semua termasuk deleted)

#### F-05: RANKING PELANGGAN
- Period selector: **Hari | Minggu | Bulan | Tahun**
- Navigasi ‹ › untuk **semua** periode (Hari=±1hari, Minggu=±7hari, Bulan=±1bulan, Tahun=±1tahun)
- Sales selector tabs
- Podium top 3 (🥇🥈🥉)
- Full ranked list: nama, bon, total, terakhir transaksi
- Pelanggan dipisah per sales

#### F-06: PELANGGAN
- Search nama
- Filter per sales
- **Sort**: A–Z (grouped by letter) | Terbesar (flat) | Terbaru (flat)
- Avatar inisial warna per sales
- **Detail Pelanggan**: modal — stats + seluruh history transaksi
- **Cek Typo Nama**: tombol 🔍 → modal deteksi nama mirip
  - Algoritma 1: **Levenshtein** (typo 1–2 karakter: "andi" vs "andu")
  - Algoritma 2: **Word Overlap** (nama parsial: "andi hutapea" vs "hutapea")
  - Filter kata umum: pak, bu, mas, mba, mbak, ibu, bapak, bang, kak, dll
  - Opsi per pasangan: [Pakai A] | [Pakai B] | [Bukan typo — Abaikan]
  - Setelah pilih → update semua transaksi sales tersebut

#### F-07: SETTINGS
- Edit nama bisnis
- Sales management: tambah, hapus (deactivate), minimal 1 sales
- Format nomor bon + format tanggal

**Google Drive Backup:**
- Toggle hubungkan/putus akun Google (OAuth2 via Expo proxy)
- Status: email + waktu terakhir backup + indikator token expired (⚠️)
- Reconnect otomatis jika token expired
- Backup manual: cek token valid dulu, alert reconnect jika expired
- **Jam backup otomatis**: ‹ HH:00 › (0–23, default 23:00)
- Background task setiap 15 menit, backup hanya pada jam yang dipilih

**DATA section (terorganisir):**
- IMPORT: 📥 Import dari CSV | 🔄 Restore dari Backup JSON
- EXPORT: 📤 Export ke CSV | 📊 Export ke Excel (.xlsx) | 💾 Export Backup JSON
- DANGER: 🗑 Reset Semua Data

**Export ke Excel (professional):**
- Sheet "📊 Ringkasan" selalu ada: KPI dashboard, per-sales table, rekap bulanan
- Sheet per sales (jika dipilih): header berwarna, alternating rows, auto-filter
- Sheet Per Sales, Pelanggan, Ranking (sesuai checklist)
- Full cell styling: warna, border, merge cell, column width optimal
- Format angka rupiah: `#,##0`

**Import/Export CSV:**
- Import CSV: auto-detect delimiter (;/,), skip header, 7 kolom sheet
- Export CSV: format identik importer, tanggal dd/mm/yyyy, escape CSV

**JSON Backup & Restore:**
- Export JSON: full data snapshot dengan metadata (versi, tanggal)
- Restore JSON: pick file, parse, preview (jumlah transaksi, sales, total, duplikat), opsi Lewati/Import Semua

**Notifikasi Harian:**
- Toggle aktif/nonaktif di Settings → Notifikasi
- Request permission saat pertama aktifkan
- Pilih jam (‹ HH:00 ›, default 20:00)
- Re-schedule otomatis saat app launch (restore setelah reinstall)

**Kunci Aplikasi:**
- Toggle di Settings → Keamanan
- Verifikasi fingerprint/PIN saat mengaktifkan (tidak bisa aktif tanpa biometric)
- Lock screen dengan auto-prompt fingerprint
- Lock kembali setelah 30 detik di background
- Fallback ke PIN HP jika fingerprint tidak tersedia

**Theme**: Dark / Light / System (ikuti HP)

#### F-08: EXIT & NAVIGASI
- **Double back press**: toast "Tekan sekali lagi untuk keluar", kedua dalam 2 detik → keluar
- **Warning pindah tab**: jika nama/nominal belum tersimpan di Input → Alert konfirmasi via `dirtyRef`

### 1.3 Yang TIDAK Ada (Jangan Implement Tanpa Diskusi)
- Login password / Google Auth
- Multi-cabang / multi-toko dalam satu install
- Target omset per sales (backlog)
- Widget Android homescreen (backlog)
- Onboarding tutorial carousel (backlog)
- In-App Review prompt (backlog)
- GDrive refresh token (backlog — butuh Android OAuth client + SHA-1)

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
| Date Picker | @react-native-community/datetimepicker | `8.2.0` |
| Document Picker | expo-document-picker | `~13.0.3` |
| Haptics | expo-haptics | `~14.0.1` |
| Excel | xlsx (SheetJS CE) | `^0.18.5` |
| Biometrics | expo-local-authentication | `~15.0.2` |
| Secure Storage | expo-secure-store | `~14.0.1` |
| Background Task | expo-background-fetch + expo-task-manager | `~13.0.6` / `~12.0.6` |
| OAuth | expo-auth-session + expo-web-browser | `~6.0.3` / `~14.0.2` |
| Notifications | expo-notifications | `~0.29.14` |
| Crypto | expo-crypto | `~14.0.2` |
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
TIDAK: Dimensions / StyleSheet      → dihapus (dead import)
```

### 2.3 Arsitektur Single-File

```
App.js (~4000 baris, single file)
│
├── Imports & Constants
│   ├── DB_NAME = 'OmsetKu.db'
│   ├── Google Drive config + constants
│   ├── Notifications config (setNotificationHandler)
│   ├── isGdriveTokenValid() — helper async cek expiry
│   ├── scheduleReminder() / cancelReminder()
│   └── TaskManager.defineTask(GDRIVE_TASK_NAME)
│
├── ThemeContext + getStyles(C)
│
├── Utils
│   ├── todayStr()         — LOCAL timezone
│   ├── fmtDate()          — format per user preference
│   ├── genBon() / parseBon()
│   ├── toIdr() / toShort()
│   └── getNorm()
│
├── SQLite Layer
│   ├── initDb()           — WAL, schema, migrations
│   ├── assembleData()     — load semua data + notifEnabled/Hour
│   ├── insertTransaction() / updateTransaction()
│   ├── softDeleteTransaction() / restoreTransaction()
│   ├── mergeCustomerName() — untuk typo fix
│   ├── setupBusiness() / updateSettings()
│   └── addSales() / deactivateSales()
│
├── Google Drive
│   ├── uploadToDrive()    — multipart upload ke Drive
│   └── TaskManager.defineTask (cek jam, upload jika saatnya)
│
├── Analytics
│   ├── filterByPeriod() / getWeekBounds()
│   ├── getRanking()
│   └── getAutocomplete()  — 3-level matching
│
├── Typo Detection
│   ├── levenshtein(a, b)  — edit distance
│   ├── getSignificantWords(name)  — filter kata umum
│   ├── hasWordOverlap(a, b)  — nama parsial check
│   └── findSimilarNames(transactions)  — returns pairs
│
├── CSV Parser
│   └── parseCsvText(text, bonConfig)
│
├── Style Helpers
│   ├── btnStyle() / chipStyle()
│   └── (Excel styles library inside handleExportExcel)
│
└── React Components
    ├── KpiCard            — adjustsFontSizeToFit
    ├── SalesChip
    ├── SetupWizard        — 5-langkah onboarding
    ├── InputScreen        — dirtyRef, duplicate check, typo-safe save
    ├── DashboardScreen    — charts, share, filter bulan
    ├── HistoryScreen      — pagination, DateTimePicker edit
    ├── RankingScreen      — navigasi semua 4 periode
    ├── CustomersScreen    — sort 3 opsi, typo detection modal
    ├── CustomerDetailModal
    ├── SettingsModal      — GDrive, Excel, CSV, JSON, PIN, Notif
    └── App (root)         — ThemeContext, auth screen, BackHandler
```

### 2.4 State Management Pattern
```
write to SQLite
    ↓
reloadData() — assembleData(db)
    ↓
setData(fresh)
    ↓
UI re-render
```
- Satu `data` object di App
- Context hanya untuk Theme
- Setiap write → reload seluruh data

### 2.5 Bug Berulang — WAJIB CEK Setiap Update App.js

> ⚠️ DUA HAL INI SERING SALAH:
> 1. `</ThemeContext.Provider>` harus di App component, BUKAN di komponen lain
> 2. `const st = getStyles(C)` harus ada di App component sebelum `return`

### 2.6 Google Drive Flow
```
User tap "Hubungkan Akun Google"
    ↓
gRequest !== null? (guard)
    ↓
Google.useAuthRequest (expo-auth-session, useProxy:true)
Browser → auth.expo.io/@aliangkoko/omsetku → Google OAuth
    ↓
Simpan: accessToken + expiresIn → GDRIVE_EXPIRY_KEY
    ↓
Background task (15 menit interval):
  → isGdriveTokenValid()? NO → return Failed (user reconnect)
  → Jam sesuai preferensi? NO → return NoData
  → Sudah backup <23 jam? YES → return NoData
  → uploadToDrive() → update GDRIVE_LAST_BACKUP_KEY
```

**Token Expiry UI:**
- Warning banner merah di Settings jika token expired
- Tombol [Reconnect] langsung di banner
- Manual backup: cek valid dulu, alert reconnect jika expired
- `driveTokenExpired` state: auto-check saat startup + app active

**Known Limitation:** Refresh token TIDAK diimplementasi (butuh Android OAuth client + SHA-1 keystore). Access token expire ±1 jam → user perlu reconnect manual.

### 2.7 PIN Lock Flow
```
Toggle ON → verifikasi fingerprint/PIN dulu
    ↓
!enrolled → Alert: aktifkan di Pengaturan HP
    ↓ enrolled
LocalAuthentication.authenticateAsync()
    ↓ success
pin_lock_enabled = 1 → DB
    ↓
App launch (pinLockEnabled=true) → isLocked=true → Lock Screen
Background >30 detik → isLocked=true → Lock Screen
    ↓
Auto-prompt fingerprint / tombol "Buka Aplikasi"
    ↓ success
setIsLocked(false) → Main App
```

### 2.8 Excel Export — Style Library
```js
S.title  — Navy bg (#1E3A5F), white bold 16pt  → judul company
S.meta   — Light blue bg, navy text 9pt         → meta/subtitle
S.secH   — Blue bg (#2563EB), white bold 11pt   → section header
S.colH   — Dark blue (#1D4ED8), white bold 10pt → column headers
S.lbl    — Slate-50 bg, slate text bold         → label KPI
S.acc    — Orange bg (#FFF7ED), orange bold 13pt → nilai utama
S.tot    — Green bg (#F0FDF4), green bold        → baris total
S.r0/r1  — White/Slate-50 alternating rows       → data rows
numFmt: '#,##0'                                  → format rupiah
```

---

## BAGIAN 3 — DATABASE SCHEMA (v4.2.0)

### 3.1 File Database
```
OmsetKu.db   ← nama sejak v3.9.0
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
  notif_hour         INTEGER NOT NULL DEFAULT 20
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

CREATE INDEX idx_txn_date      ON transactions(transaction_date);
CREATE INDEX idx_txn_year      ON transactions(year, sales_name);
CREATE INDEX idx_txn_yearmonth ON transactions(year_month);
CREATE INDEX idx_txn_customer  ON transactions(sales_name, customer_norm);
-- TIDAK ada UNIQUE INDEX pada bon_number
```

### 3.5 SecureStore Keys
```
gdrive_access_token   — OAuth access token
gdrive_token_expiry   — Timestamp ms expiry token
gdrive_user_email     — Email akun Google
gdrive_last_backup    — Timestamp ms backup terakhir
gdrive_backup_hour    — Jam backup otomatis (0–23, default 23)
```

### 3.6 Notifications
```
expo-notifications identifier: 'omsetku-daily-reminder'
Scheduled: daily repeating, hour = notif_hour, minute = 0
```

### 3.7 Migrations (dieksekusi di initDb setiap launch)
```sql
ALTER TABLE transactions ADD COLUMN edited_at TEXT
ALTER TABLE transactions ADD COLUMN original_values TEXT
ALTER TABLE settings ADD COLUMN theme_mode TEXT NOT NULL DEFAULT 'dark'
ALTER TABLE settings ADD COLUMN pin_lock_enabled INTEGER NOT NULL DEFAULT 0
ALTER TABLE settings ADD COLUMN notif_enabled INTEGER NOT NULL DEFAULT 0
ALTER TABLE settings ADD COLUMN notif_hour INTEGER NOT NULL DEFAULT 20
DROP INDEX IF EXISTS idx_bon_unique
```

---

## BAGIAN 4 — FILE STRUCTURE

```
OmsetKu/
├── App.js                ← MAIN APP (single file, ~4000 baris)
├── app.json              ← Expo + Android config
├── package.json          ← name: "omsetku", version: "4.2.0"
├── eas.json              ← Build profiles
├── babel.config.js
├── PRIVACY_POLICY.md     ← Kebijakan Privasi
├── GOOGLE_DRIVE_SETUP.md ← Panduan setup Google Cloud OAuth
├── docs/
│   ├── index.html        ← Privacy Policy web (GitHub Pages)
│   └── .nojekyll
└── assets/
    ├── icon.png          ← 1024×1024 RGBA
    ├── adaptive-icon.png
    ├── splash.png        ← dark bg (#071018)
    ├── favicon.png
    └── logo.png
```

### 4.1 app.json (ringkasan)
```json
{
  "expo": {
    "name": "OmsetKu",
    "slug": "omsetku",
    "version": "4.2.0",
    "scheme": "com.omsetku.app",
    "backgroundColor": "#071018",
    "userInterfaceStyle": "automatic",
    "splash": { "backgroundColor": "#071018" },
    "android": {
      "package": "com.omsetku.app",
      "versionCode": 13
    },
    "plugins": [
      "expo-sqlite", "expo-asset",
      "@react-native-community/datetimepicker",
      "expo-local-authentication",
      "expo-secure-store",
      "expo-notifications"
    ]
  }
}
```

### 4.2 Google Cloud OAuth
- **Web Client ID**: `846894493859-vl3v947mucd6chu7tm0agi7kbitpb27a.apps.googleusercontent.com`
- **Authorized redirect URI**: `https://auth.expo.io/@aliangkoko/omsetku`
- **Scopes**: `drive.file`, `email`, `profile`

---

## BAGIAN 5 — BUG FIXES HISTORY (Lengkap)

| Bug | Versi Fix | Deskripsi |
|---|---|---|
| BUG-01 | v1 | parseBon: parseInt salah pada format dateCode |
| BUG-02 | v1 | todayStr UTC vs Lokal (WIB midnight issue) |
| BUG-03 | v1 | styles.btnText: fg/sz undefined di StyleSheet.create |
| BUG-04 | v1 | Double-save race condition → `saving` flag |
| BUG-05 | v1 | getMondayOfWeek DST → gunakan T12:00:00 (noon) |
| BUG-06 | v3.0 | Sales input double karakter → uncontrolled useRef |
| BUG-07 | v3.0 | Bon prefix hilang saat edit → prefix static |
| BUG-08 | v3.0 | Bon naik ke urutan lama setelah edit-turun |
| BUG-09 | v3.0 | Light mode tidak apply → ThemeContext |
| BUG-10 | v3.0 | ThemeContext.Provider nyasar ke komponen lain (berulang) |
| BUG-11 | v3.5 | Bar chart warna ditimpa → side-by-side fix |
| BUG-12 | v3.6 | Dashboard crash: Array.keys().map() tidak jalan di Hermes |
| BUG-13 | v3.9 | loadTransactions WHERE deleted_at IS NULL → Pulihkan tidak jalan |
| BUG-14 | v3.9 | StyleSheet, Dimensions, SW diimport tapi tidak dipakai |
| BUG-15 | v3.9 | LoginScreen dead code (tidak pernah dirender) |
| BUG-16 | v4.0 | doSave tidak punya try-finally → saving stuck disabled |
| BUG-17 | v4.0 | handleTypoCheck sinkronus → loading state tidak tampil |
| BUG-18 | v4.0 | gPromptAsync() tanpa guard gRequest !== null |
| BUG-19 | v4.0 | SecureStore backupHour tanpa .catch() |
| BUG-20 | v4.0 | PIN lock toggle: tidak ada verifikasi sebelum aktifkan |
| BUG-21 | v4.1 | GDrive token expiry tidak tersimpan → backup gagal setelah 1 jam (partial fix) |

---

## BAGIAN 6 — DESIGN SYSTEM

### 6.1 Color Palette
```js
const DARK_THEME = {
  bg:'#071018', card:'#0f1720', input:'#0a1929',
  border:'rgba(255,255,255,0.07)', primary:'#2563eb',
  success:'#22c55e', warning:'#f59e0b', text:'#f1f5f9',
  muted:'#64748b', accent:'#F57F17', danger:'#ef4444',
};
const LIGHT_THEME = {
  bg:'#f0f4f8', card:'#ffffff', input:'#e2e8f0',
  border:'rgba(0,0,0,0.09)', primary:'#2563eb',
  success:'#16a34a', warning:'#d97706', text:'#1e293b',
  muted:'#64748b', accent:'#ea580c', danger:'#dc2626',
};
const COLORS = ['#2563eb','#22c55e','#f59e0b','#ec4899','#8b5cf6','#ef4444','#06b6d4','#84cc16'];
```

### 6.2 Bottom Tab Bar
| Tab | Icon | ID | Catatan |
|---|---|---|---|
| Input | ✚ | `input` | Text char, berubah warna |
| Dashboard | ◈ | `dashboard` | Text char |
| Riwayat | ☰ | `riwayat` | Text char |
| Ranking | ★ | `ranking` | Text char |
| Pelanggan | **◉** | `pelanggan` | Text char (ganti dari emoji 👥 v4.0) |

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
- [ ] `npx expo export --platform android --output-dir /tmp/test` — tidak ada error
- [ ] `</ThemeContext.Provider>` ada di App, BUKAN di komponen lain
- [ ] `const st = getStyles(C)` ada di App sebelum `return`
- [ ] `APP_VER` di App.js sudah update
- [ ] `version` di app.json sudah update
- [ ] `versionCode` di app.json naik 1
- [ ] `version` di package.json sudah update
- [ ] `git commit` sudah dilakukan

### Cara Bump Versi
1. `const APP_VER = 'X.Y.Z'` di App.js
2. `"version": "X.Y.Z"` di app.json
3. `"versionCode": N+1` di app.json
4. `"version": "X.Y.Z"` di package.json

---

## BAGIAN 8 — TROUBLESHOOTING

| Error | Penyebab | Fix |
|---|---|---|
| `Property 'st' doesn't exist` | App tidak punya `const st = getStyles(C)` | Tambah sebelum `return` di App |
| `Adjacent JSX elements` | `</ThemeContext.Provider>` nyasar | Pindah ke App component |
| `Metro bundler failed` | Cache kotor | `npx expo start --clear` |
| `App crash di Dashboard` | `.keys().map()` tidak jalan di Hermes | Pakai array literal `[0,1,2,...12]` |
| `Pulihkan tidak muncul` | Fixed v3.9.0 — loadTransactions sudah load semua |  |
| `saving button stuck` | doSave error tanpa finally | Fixed v4.0.0 — try-finally |
| `GDrive backup gagal` | Token expired (~1 jam) | Reconnect di Settings → warning banner |
| `Notifikasi tidak muncul` | Izin belum diberikan / toggle OFF | Settings → Notifikasi → aktifkan |
| `PIN lock langsung unlock` | Device tidak ada biometric enrolled | Alert muncul — aktifkan dulu di HP Settings |
| `EAS quota habis` | Free plan limit bulanan | Tunggu reset tanggal 1 / upgrade plan |
| `Slug does not match projectId` | Slug diubah | `eas init --force` |

---

## BAGIAN 9 — PANDUAN UPDATE

### Cara Push Privacy Policy Update
```bash
cd "C:\Users\Kent\Desktop\OmsetKu"
# edit docs/index.html
git add docs/
git commit -m "docs: update"
git subtree push --prefix docs origin master
# remote: https://github.com/LittleScript/OmsetKu-docs.git
```

### Cara Tambah Kolom DB Baru
```js
try {
  await db.execAsync(`ALTER TABLE settings ADD COLUMN nama_kolom TEXT`);
} catch(e) {} // kolom sudah ada — ok
```
Tambahkan di `initDb()` dan `assembleData()`.

### Cara Tambah Dependency Baru
```bash
cd "C:\Users\Kent\Desktop\OmsetKu"
npx expo install nama-package
# Jika butuh native module → tambah ke plugins di app.json
git add package.json package-lock.json app.json
git commit -m "add: nama-package"
```

---

## BAGIAN 10 — BACKLOG (Terurut Prioritas)

| # | Fitur | Prioritas | Catatan |
|---|---|---|---|
| B-01 | Google Drive refresh token | 🔴 High | Butuh Android OAuth client + SHA-1 EAS keystore |
| B-02 | Onboarding carousel 3 slide | 🟡 Medium | Muncul sekali saat install pertama |
| B-03 | In-App Review prompt | 🟡 Medium | `expo-store-review`, trigger setelah 10 transaksi |
| B-04 | Perbandingan bulan ini vs lalu (%) | 🟡 Medium | Di Dashboard card Hari Ini / Minggu Ini |
| B-05 | Target omset per sales | 🟢 Low | Set target, progress bar |
| B-06 | Notifikasi — hanya jika belum ada transaksi hari ini | 🟢 Low | Cek via background task sebelum kirim notif |
| B-07 | Widget Android | 🟢 Low | react-native-android-widget, terpisah |
| B-08 | Export Excel per periode (filter tahun/bulan) | 🟢 Low | Tambah filter ke checklist Excel |

---

## BAGIAN 11 — CHECKLIST GOOGLE PLAY RELEASE

| Item | Status | Siapa |
|---|---|---|
| Build AAB (production) | ⏳ | Claude Code |
| Privacy Policy URL live | ✅ `https://littlescript.github.io/OmsetKu-docs/` | Done |
| Google Play Console ($25) | ✅ | Anda |
| Screenshot app (2–8 gambar) | ⏳ | Anda (HP) |
| Feature graphic 1024×500 | ⏳ | Anda (Canva) |
| Deskripsi app Bahasa Indonesia | ⏳ | Claude Code + Anda |
| Data Safety form | ⏳ | Anda (Play Console) |
| Rating konten questionnaire | ⏳ | Anda (Play Console) |
| Upload AAB + review + publish | ⏳ | Anda |

---

*Dokumen ini dibuat berdasarkan kode aktual v4.2.0*
*Update dokumen ini setiap kali ada perubahan signifikan*
*Path project: `C:\Users\Kent\Desktop\OmsetKu\`*
*GitHub Docs: `https://github.com/LittleScript/OmsetKu-docs`*
