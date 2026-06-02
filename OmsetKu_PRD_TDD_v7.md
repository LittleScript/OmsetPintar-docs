# OMSETKU — PRD + TDD MASTER DOCUMENT v7
## Product Requirements + Technical Design Document
### Versi 4.7.0 | Status: READY TO BUILD

> Dokumen ini adalah **update dari v6**. Baca v6 terlebih dahulu untuk konteks lengkap.
> Path project: `C:\Users\Kent\Desktop\OmsetKu\`

---

## CHANGELOG v7 (dari v6)

### Fitur Baru yang Ditambahkan

| Fitur | Versi | Keterangan |
|---|---|---|
| In-App Review prompt | 4.6.x | Setelah 10 transaksi tersimpan, trigger review Google Play |
| Premium / Monetisasi | 4.6.x | Sistem freemium dengan 10 produk à la carte + subscription |
| Paywall (gate fitur) | 4.6.x | Lock UI untuk fitur premium dengan PaywallOverlay + PaywallSheet |
| Onboarding Carousel | 4.5.x | 3 slide saat install pertama |
| Share Rekap sebagai Gambar | 4.5.x | Kartu putih profesional dengan logo, capture PNG |
| Auto-sync GDrive tiap 10 input | 4.7.0 | Silent sync setelah 10 transaksi tersimpan |
| Auto-sync saat foreground | 4.5.x | Jika >4 jam sejak sync terakhir |
| DB Pagination History | 4.5.x | Query SQLite LIMIT/OFFSET, bukan in-memory |
| Setup Wizard sales ‹ › max 2 | 4.7.0 | Navigator instead of TextInput, free tier max 2 |
| Settings — save inline | 4.7.0 | Tombol ✓ di sebelah Nama Bisnis & Format Bon |
| Format Tanggal — chip kompak | 4.7.0 | 3 chip, klik = pilih + simpan otomatis |
| Mode Tampilan — chip kompak | 4.7.0 | 3 chip (Gelap/Terang/Ikuti HP), klik = pilih + simpan |
| Lock langsung saat tutup app | 4.7.0 | Seperti app bank, tidak ada delay |
| Reset data — keamanan ganda | 4.7.0 | Konfirmasi + fingerprint (jika aktif) + konfirmasi akhir |
| Sales limit gate di Settings | 4.7.0 | Cek maxSales sebelum tambah sales, trigger paywall |
| Kelola Pembelian di Settings | 4.6.x | Daftar aktif, Restore, Kelola Langganan → Play Store |
| Share Rekap Card — redesign | 4.7.0 | Background putih, logo transparan, data hijau |
| PaywallSheet scroll fix | 4.7.0 | maxHeight dinamis, scroll indicator, padding cukup |
| Icon APK 75%, logo header terpisah | 4.7.0 | icon.png white bg 75%, logo_header.png transparan 85% |

---

## BAGIAN 1 — MONETISASI (BARU)

### 1.1 Model: Freemium + À La Carte + Subscription

#### Free Tier
| Batasan | Nilai |
|---|---|
| Sales | Maks 2 |
| Transaksi/sales/hari | Maks 25 |
| Riwayat | 1 bulan |
| Chart bulanan | 2 bulan terakhir |
| Ranking | Top 20 per sales |
| Daftar pelanggan | 50 per sales |
| Customer Detail | Summary saja |
| Hari Tersibuk | Blur overlay |
| Export | CSV saja |

#### Produk Premium (mock, RevenueCat TODO)

| ID | Nama | Harga | Fitur |
|---|---|---|---|
| `omsetku_sales_unlock` | Sales Unlock | Rp 49.000 | Hingga 3 sales |
| `omsetku_sales_pro` | Sales Pro | Rp 89.000 | Hingga 10 sales 🎣decoy |
| `omsetku_sales_ultimate` | Sales Ultimate | Rp 99.000 | Hingga 50 sales ✅target |
| `omsetku_analytics_dashboard` | Analitik Dashboard | Rp 49.000 | % ↑↓, Hari Tersibuk, Chart 12bln |
| `omsetku_analytics_customers` | Analitik Pelanggan | Rp 49.000 | Ranking full, Pelanggan full, Detail |
| `omsetku_analytics_export` | Laporan & Ekspor | Rp 49.000 | Excel, Share Kartu |
| `omsetku_analytics_all` | Semua Analitik | Rp 89.000 | Bundle 8 fitur 🎣decoy→✅target |
| `omsetku_backup_sync` | Backup & Sinkron | Rp 49.000 | Drive, sync 2HP |
| `omsetku_monthly_plus` | Monthly Plus | Rp 18.900/bln | Semua fitur 🎣decoy |
| `omsetku_yearly_plus` | Yearly Plus | Rp 169.000/thn | Semua fitur ✅target |

### 1.2 Status Monetisasi
- **Saat ini: MOCK** — pembelian disimpan ke SecureStore tanpa payment
- **TODO**: Integrasikan RevenueCat (swap ~10 baris di App.js)
- **TODO**: Daftarkan produk di Google Play Console
- **TODO**: Submit OAuth verification untuk GDrive production

---

## BAGIAN 2 — ARSITEKTUR TERKINI (v4.7.0)

### 2.1 File Structure

```
OmsetKu/
├── App.js                     ← Entry point + App component (~820 baris)
├── src/
│   ├── constants.js           ← Semua konstanta, themes, products
│   ├── contexts.js            ← PurchasesContext (NO circular import)
│   ├── theme.js               ← ThemeContext, getStyles, SalesChip, KpiCard
│   ├── utils.js               ← Format, date, analytics, Jaro-Winkler, CSV
│   ├── db.js                  ← SQLite layer + DB pagination
│   ├── services.js            ← GDrive, notifications, background task
│   ├── premium.js             ← Entitlement system, PAYWALL_MAP, FREE limits
│   ├── screens/
│   │   ├── OnboardingScreen.js
│   │   ├── SetupWizard.js
│   │   ├── InputScreen.js
│   │   ├── DashboardScreen.js
│   │   ├── HistoryScreen.js
│   │   ├── RankingScreen.js
│   │   ├── CustomersScreen.js
│   │   └── SettingsModal.js
│   ├── components/
│   │   ├── PaywallOverlay.js   ← Blur lock untuk konten premium
│   │   ├── PaywallSheet.js     ← Bottom sheet pricing
│   │   └── LockRow.js         ← Row truncation untuk list
│   └── widget/                ← Kode widget (dinonaktifkan, butuh Expo 54)
├── assets/
│   ├── icon.png               ← APK icon: white bg, logo 75%
│   ├── adaptive-icon.png      ← Adaptive: transparent, logo 60%
│   ├── logo_header.png        ← In-app header: transparent, logo 85%
│   └── splash.png
├── docs/
│   └── index.html             ← Privacy Policy (GitHub Pages)
├── .npmrc                     ← legacy-peer-deps=true
└── OmsetKu_PRD_Pricing_v1.md ← Detail pricing model
```

### 2.2 Database Schema (v4.7.0)

Tambahan dari v6:
```sql
-- Tidak ada perubahan schema v4.7.0
-- lock_timeout tetap ada di DB tapi selalu 0 (lock langsung)
-- Lihat v6 untuk schema lengkap
```

---

## BAGIAN 3 — BUG FIXES v4.6.x → v4.7.0

| Bug | Deskripsi | Fix |
|---|---|---|
| BUG-33 | react-native-android-widget crash (blank screen) | Hapus module, simpan kode untuk Expo 54 |
| BUG-34 | InputScreen: btnStyle + toIdr tidak diimport | Tambah ke import |
| BUG-35 | HistoryScreen: todayStr, chipStyle(C) missing | Tambah ke import + C arg |
| BUG-36 | SettingsModal: parseBon tidak diimport | Tambah ke import |
| BUG-37 | CustomersScreen: key={idx} undefined di renderItem | Fix: index: pairIdx |
| BUG-38 | App.js: useMemo setelah conditional returns (Rules of Hooks) | Pindahkan ke sebelum returns |
| BUG-39 | PaywallSheet di luar ThemeContext.Provider | Pindahkan ke dalam |
| BUG-40 | HistoryScreen: loadPage tanpa catch block | Tambah catch |
| BUG-41 | App.js: circular import PurchasesContext dari App.js | Pindah ke src/contexts.js |

---

## BAGIAN 4 — BUG BERULANG: WAJIB CEK SETIAP UPDATE

> ⚠️ CEK INI SEBELUM SETIAP BUILD:
> 1. `ThemeContext.Provider` harus di App component, BUKAN di komponen lain
> 2. `const st = getStyles(C)` ada di App component sebelum `return`
> 3. `initDb()`: CREATE TABLE harus SEBELUM blok ALTER
> 4. `expo-auth-session v6`: Google.useAuthRequest WAJIB ada `clientId`
> 5. Setiap fungsi baru di screen file: pastikan di-import dari src/
> 6. `useMemo`/hooks HARUS sebelum conditional `return` statements
> 7. `PurchasesContext` import dari `'../contexts'` bukan `'../../App'`

---

## BAGIAN 5 — CARA BUILD APK (v4.7.0)

```bash
cd "C:\Users\Kent\Desktop\OmsetKu"
# Verifikasi
npx expo export --platform android --output-dir /tmp/test

# Build APK (internal testing)
git add -A && git commit -m "release: vX.Y.Z"
eas build --platform android --profile preview --non-interactive

# Build AAB (Play Store)
eas build --platform android --profile production --non-interactive
```

### Checklist Sebelum Build
- [ ] `expo export` bersih tanpa error
- [ ] `APP_VER` di `src/constants.js` sudah update
- [ ] `version` di `app.json` sudah update
- [ ] `versionCode` di `app.json` naik 1
- [ ] `version` di `package.json` sudah update

---

## BAGIAN 6 — BACKLOG (Terurut Prioritas)

| # | Fitur | Prioritas | Status |
|---|---|---|---|
| B-01 | RevenueCat integration | 🔴 High | TODO — swap ~10 baris di App.js |
| B-02 | OAuth GDrive Verification (Production) | 🔴 High | Pending submit ke Google |
| B-03 | In-App Review prompt | ✅ | Done v4.6.x |
| B-04 | Onboarding carousel | ✅ | Done v4.5.x |
| B-05 | Perbandingan % omset | ✅ | Done v4.5.x |
| B-06 | Notifikasi cerdas | ✅ | Done v4.5.x |
| B-07 | Export Excel per periode | ✅ | Done v4.5.x |
| B-08 | Widget Android | 🟢 Low | Butuh Expo 54 |
| B-09 | Target omset per sales | 🟢 Low | Belum diimplementasi |

---

## BAGIAN 7 — SOP OPERASIONAL (Update)

### SOP-01: Rilis Versi Baru
```
1. Update APP_VER di src/constants.js
2. Update version + versionCode di app.json  
3. Update version di package.json
4. npx expo export — 0 error
5. git add -A && git commit -m "release: vX.Y.Z"
6. eas build --platform android --profile preview
7. Test APK di HP fisik (semua tab, input, export)
```

### SOP-02: Update Privacy Policy
```
1. Edit PRIVACY_POLICY.md + docs/index.html
2. git add docs/ PRIVACY_POLICY.md && git commit
3. git subtree push --prefix docs origin master
4. Verifikasi: https://littlescript.github.io/OmsetKu-docs/
```

### SOP-03: RevenueCat Integration (TODO)
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

*Dokumen ini mencerminkan kode aktual OmsetKu v4.7.0*
*Update setiap kali ada perubahan signifikan*
*Path project: `C:\Users\Kent\Desktop\OmsetKu\`*
