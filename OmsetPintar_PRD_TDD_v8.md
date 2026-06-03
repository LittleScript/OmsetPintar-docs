# Omset Pintar — PRD + TDD MASTER DOCUMENT v8
## Product Requirements + Technical Design Document
### Versi 4.8.0 | Status: BUILT — Testing

> Dokumen ini adalah **update dari v7**. Baca v6/v7 untuk konteks lengkap.
> Path project: `C:\Users\Kent\Desktop\Omset Pintar\`

---

## CHANGELOG v8 (dari v7)

### Fitur Baru yang Ditambahkan

| Fitur | Versi | Keterangan |
|---|---|---|
| i18n Language Toggle (🇮🇩/EN) | 4.8.0 | Toggle di header — semua teks beralih Bahasa Indonesia ↔ English |
| Daily Line Chart | 4.8.0 | Grafik garis omset harian per sales per bulan (ganti distribusi pie) |
| Bahasa disimpan permanen | 4.8.0 | SecureStore key `app_lang` — bertahan setelah app ditutup |

### Bug Fixes v4.7.0 → v4.8.0

| Bug | Deskripsi | Fix |
|---|---|---|
| BUG-42 | Crash saat toggle notifikasi | `scheduleReminder()` + toggle onPress dibungkus try-catch |
| BUG-43 | `scheduleNotificationAsync` format trigger invalid | Pakai `SchedulableTriggerInputTypes.DAILY` enum + fallback |
| BUG-44 | `handleAuthenticate` stale closure | Tambah `tFn` ke `useCallback([tFn])` |
| BUG-45 | `statusText` hardcode Indonesian | Ganti `tFn('saving')`, `tFn('bon')`, `tFn('failed')` |
| BUG-46 | `ToastAndroid` exit toast hardcode | Ganti `tFn('exit_toast')` |
| BUG-47 | DailyLineChart React key warning | Wrap outer map dengan `<React.Fragment key={...}>` |
| BUG-48 | DashboardScreen 2x `useContext(LanguageContext)` | Combine `const { t, lang } = useContext(LanguageContext)` |
| BUG-49 | SettingsModal PERIODE DATA + ✓ aktif hardcode | Tambah keys di i18n, ganti `t()` |
| BUG-50 | Logo header & share rekap tidak tampil (file identik) | Styling workaround — green wrapper di share card, borderRadius header |

---

## BAGIAN 1 — ARSITEKTUR TERKINI (v4.8.0)

### 1.1 File Structure

```
Omset Pintar/
├── App.js                     ← Entry point + App component (~850 baris)
├── src/
│   ├── constants.js           ← Semua konstanta, themes, products, TABS
│   ├── contexts.js            ← PurchasesContext + LanguageContext
│   ├── i18n.js                ← 265 string keys × 2 bahasa, t() + makeT()
│   ├── theme.js               ← ThemeContext, getStyles, SalesChip, KpiCard
│   ├── utils.js               ← Format, date, analytics, Jaro-Winkler, CSV
│   ├── db.js                  ← SQLite layer + DB pagination
│   ├── services.js            ← GDrive, notifications (+ try-catch), bg task
│   ├── premium.js             ← Entitlement system, PAYWALL_MAP, FREE limits
│   ├── screens/
│   │   ├── OnboardingScreen.js
│   │   ├── SetupWizard.js
│   │   ├── InputScreen.js
│   │   ├── DashboardScreen.js  ← + DailyLineChart component
│   │   ├── HistoryScreen.js
│   │   ├── RankingScreen.js
│   │   ├── CustomersScreen.js
│   │   └── SettingsModal.js
│   ├── components/
│   │   ├── PaywallOverlay.js
│   │   ├── PaywallSheet.js
│   │   └── LockRow.js
│   └── widget/                ← Dinonaktifkan (butuh Expo 54)
├── assets/
│   ├── icon.png               ← APK launcher: white bg, logo 100%
│   ├── adaptive-icon.png      ← Adaptive icon: white bg
│   ├── logo_header.png        ← In-app header (PERLU transparent PNG)
│   └── splash.png
├── .npmrc                     ← legacy-peer-deps=true
├── GOOGLE_DRIVE_SETUP.md
├── Omset Pintar_PRD_Pricing_v1.md
├── Omset Pintar_PRD_TDD_v8.md      ← Dokumen ini
├── PLAY_STORE_DESCRIPTION.md
└── PRIVACY_POLICY.md
```

### 1.2 Context Tree

```
App.js return:
  <LanguageContext.Provider value={{ lang, t: tFn, setLang }}>
    <PurchasesContext.Provider value={{ purchases, openPaywall }}>
      <ThemeContext.Provider value={currentTheme}>
        ...screens...
      </ThemeContext.Provider>
    </PurchasesContext.Provider>
  </LanguageContext.Provider>
```

> **PENTING:** OnboardingScreen, SetupWizard, dan LockScreen dikembalikan sebelum providers → mereka pakai default context (tidak crash, tapi tidak dapat bahasa dari toggle).

### 1.3 i18n System

```javascript
// src/i18n.js
export const STRINGS = {
  id: { /* 265 keys Indonesian */ },
  en: { /* 265 keys English */  },
};
export function t(key, lang = 'id') { ... }
export function makeT(lang) {
  return (key, vars = {}) => { /* interpolasi {var} */ };
}

// src/contexts.js
export const LanguageContext = createContext({
  lang: 'id',
  t:    makeT('id'),       // default — untuk komponen di luar Provider
  setLang: () => {},
});

// App.js
const [lang, setLang] = useState('id');
const tFn = useMemo(() => makeT(lang), [lang]);  // rebuild hanya saat lang berubah
const langCtxValue = useMemo(() => ({
  lang,
  t: tFn,
  setLang: async (newLang) => {
    setLang(newLang);
    await SecureStore.setItemAsync('app_lang', newLang);
  },
}), [lang, tFn]);

// Di setiap screen:
const { t } = useContext(LanguageContext);   // atau { t, lang } jika butuh lang
```

**PERHATIAN VARIABLE SHADOWING:** Banyak screen menggunakan `t` sebagai nama parameter callback (filter, reduce, forEach). Ini valid JavaScript — tidak crash, tapi bisa membingungkan. Jangan panggil `t('key')` di dalam arrow function yang menggunakan `t` sebagai parameter.

### 1.4 DailyLineChart

Komponen baru di `DashboardScreen.js` (di luar `DashboardScreen` function, module level):

```javascript
function DailyLineChart({ activeTxns, salesList, month, year, setMonth, setYear, C, st, t }) {
  // useMemo: dailyData, globalMax
  // Props C, st, t diterima dari DashboardScreen (bukan dari Context langsung)
  // Render: absolute-positioned Views sebagai line segments (rotasi matematik)
}
```

Menggantikan: section "Distribusi Omset" (pie-style bar) yang dihapus.

---

## BAGIAN 2 — DATABASE SCHEMA (tidak berubah dari v7)

```
Lihat v6 untuk schema lengkap.
Tidak ada perubahan schema di v4.8.0.
lock_timeout: selalu 0 (lock langsung)
```

---

## BAGIAN 3 — BUG BERULANG: WAJIB CEK SETIAP UPDATE

> ⚠️ CEK INI SEBELUM SETIAP BUILD:
> 1. `LanguageContext.Provider` harus paling LUAR di App.js main return
> 2. `purchasesCtxValue = useMemo(...)` harus SEBELUM conditional returns
> 3. `tFn = useMemo(() => makeT(lang), [lang])` SEBELUM conditional returns
> 4. `ThemeContext.Provider` harus di App component, BUKAN di komponen lain
> 5. `initDb()`: CREATE TABLE harus SEBELUM blok ALTER
> 6. `expo-auth-session v6`: WAJIB ada `clientId`
> 7. `scheduleNotificationAsync` WAJIB dalam try-catch (crash Android)
> 8. Setiap `useCallback` yang pakai `tFn` → tambahkan `tFn` ke deps array
> 9. `PurchasesContext` import dari `'../contexts'` bukan `'../../App'`
> 10. Jangan panggil `t('key')` di dalam callback `(t => ...)` — nama shadow

---

## BAGIAN 4 — MONETISASI (tidak berubah dari v7)

Lihat `Omset Pintar_PRD_Pricing_v1.md` untuk detail lengkap.

- Status: **MOCK** — pembelian ke SecureStore, tidak ada payment
- RevenueCat: TODO setelah Google Play Developer Account aktif
- 10 produk: sales_unlock/pro/ultimate, analytics_dashboard/customers/export/all, backup_sync, monthly_plus/yearly_plus

---

## BAGIAN 5 — CARA BUILD APK

```bash
cd "C:\Users\Kent\Desktop\Omset Pintar"

# 1. Verifikasi bundle (0 error)
npx expo export --platform android

# 2. Build APK preview
eas build --platform android --profile preview --non-interactive

# 3. Build AAB production (Play Store)
eas build --platform android --profile production --non-interactive
```

### Checklist Sebelum Build
- [ ] `APP_VER` di `src/constants.js` sudah update
- [ ] `version` di `app.json` sudah update
- [ ] `versionCode` di `app.json` naik 1
- [ ] `version` di `package.json` sudah update
- [ ] `npx expo export` bersih tanpa error

### Versi Saat Ini
| File | Nilai |
|---|---|
| `src/constants.js` `APP_VER` | `'4.8.0'` |
| `app.json` `version` | `'4.8.0'` |
| `app.json` `versionCode` | `25` |
| `package.json` `version` | `'4.8.0'` |

---

## BAGIAN 6 — BACKLOG (Terurut Prioritas)

| # | Fitur | Prioritas | Status |
|---|---|---|---|
| B-01 | RevenueCat integration | 🔴 High | TODO — swap ~10 baris di App.js |
| B-02 | OAuth GDrive Verification (Production) | 🔴 High | Pending submit ke Google |
| B-03 | Google Play Store submission | 🔴 High | Butuh $25 Developer Account |
| B-04 | logo_header.png transparent | 🟡 Medium | File saat ini = icon.png (identik). Perlu buat PNG transparan |
| B-05 | Widget Android | 🟢 Low | Butuh Expo 54 (saat ini Expo 52) |
| B-06 | Target omset per sales | 🟢 Low | Belum diimplementasi |
| B-07 | i18n OnboardingScreen + SetupWizard | 🟢 Low | Belum diimplementasi |

---

## BAGIAN 7 — SOP OPERASIONAL

### SOP-01: Rilis Versi Baru
```
1. Update APP_VER di src/constants.js
2. Update version + versionCode di app.json  
3. Update version di package.json
4. npx expo export — 0 error
5. eas build --platform android --profile preview --non-interactive
6. Test APK di HP fisik:
   - Semua tab (Input, Dashboard, Riwayat, Ranking, Pelanggan)
   - Toggle bahasa ID ↔ EN
   - Toggle notifikasi (TIDAK boleh crash)
   - Toggle dark/light mode
   - Share rekap kartu
   - Input + simpan transaksi
```

### SOP-02: Ganti Logo Header
```
1. Buat PNG dengan background TRANSPARAN dari Figma/Canva
   - Export as PNG, background = None
   - Ukuran minimal 200×200px
2. Simpan ke: assets/logo_header.png
3. Rebuild APK
```

### SOP-03: Update Privacy Policy
```
1. Edit PRIVACY_POLICY.md + docs/index.html
2. git add docs/ PRIVACY_POLICY.md && git commit
3. git subtree push --prefix docs origin master
4. Verifikasi: https://littlescript.github.io/Omset Pintar-docs/
```

### SOP-04: RevenueCat Integration (TODO)
```
1. Buat akun di app.revenuecat.com (gratis)
2. npx expo install react-native-purchases
3. Buat 10 produk di Google Play Console (sesuai PID di premium.js)
4. Di App.js, ganti:
   - loadPurchases() → Purchases.getCustomerInfo()
   - savePurchases() → tidak perlu (RevenueCat handle)
   - handlePurchase() → Purchases.purchaseStoreProduct()
5. Test dengan sandbox mode Google Play
```

---

## BAGIAN 8 — RIWAYAT VERSI

| Versi | versionCode | Tanggal | Highlight |
|---|---|---|---|
| 4.8.0 | 25 | 2 Juni 2026 | i18n toggle ID/EN, daily line chart, fix crash notifikasi |
| 4.7.0 | 24 | 2 Juni 2026 | Modularisasi, premium/paywall, GDrive PKCE, pagination |
| 4.6.0 | 23 | 1 Juni 2026 | Share rekap gambar, auto-sync, in-app review |
| 4.5.0 | 22 | — | Onboarding, chart stacked, export Excel per periode |
| 4.2.0 | — | — | JSON restore, CSV export, Excel styling |
| 4.0.0 | — | — | Typo detection (Jaro-Winkler), backup jam |
| 3.9.0 | — | — | GDrive + Privacy Policy + fix Pulihkan |

---

*Dokumen ini mencerminkan kode aktual Omset Pintar v4.8.0*
*Path project: `C:\Users\Kent\Desktop\Omset Pintar\`*
*Terakhir update: 2 Juni 2026*
