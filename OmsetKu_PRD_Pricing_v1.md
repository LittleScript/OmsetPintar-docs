# OMSETKU — PRD PRICING & MONETISASI v1
## Strategi Harga, Tier, dan Gate Fitur
### Versi 4.7.0+ | Status: SIAP IMPLEMENTASI (mock) — menunggu RevenueCat + Google Play

---

## BAGIAN 0 — PRINSIP MONETISASI

### Model: À La Carte + Subscription

Pengguna bisa beli fitur secara terpisah (one-time purchase) **atau** berlangganan untuk semua sekaligus. Dirancang dengan tiga prinsip:

1. **Decoy Effect** — PRO dijadikan "tumbal" agar Ultimate terlihat murah
2. **Bundle Savings** — SEMUA ANALITIK hemat vs beli satuan
3. **Framing Tahunan** — harga per bulan (Rp 14.083) bukan total tahunan

---

## BAGIAN 1 — FREE TIER

### Batasan Free

| Fitur | Batas |
|---|---|
| Jumlah sales | **Maks 2 sales** |
| Transaksi per sales per hari | **Maks 25 bon** |
| Riwayat transaksi | **1 bulan terakhir** |
| Chart bulanan | **2 bulan terakhir** saja (10 bulan lain dikunci 🔒) |
| Ranking pelanggan | **Top 20** per sales (sisanya dikunci 🔒) |
| Daftar pelanggan | **50 per sales** (sisanya dikunci 🔒) |
| Customer Detail | **Summary saja** (riwayat transaksi dikunci 🔒) |
| Hari Tersibuk | **BLUR OVERLAY** — konten ada tapi terhalangi kartu gelap 🔒 |
| Dashboard % ↑↓ | Dikunci 🔒 |
| Export | **CSV saja** |
| Excel export | Dikunci 🔒 |
| Share Rekap Kartu | Dikunci 🔒 |
| Google Drive backup | Dikunci 🔒 |
| Sinkron 2 HP | Dikunci 🔒 |
| Widget home screen | Dikunci 🔒 |

---

## BAGIAN 2 — PRODUCT CATALOG

### 2.1 Sales Tiers (One-Time Purchase)

| Produk | Harga | Max Sales | Note |
|---|---|---|---|
| **Sales Unlock** | Rp 49.000 | 3 | Entry point |
| **Sales Pro** | Rp 89.000 | 10 | 🎣 DECOY — bikin Ultimate terlihat murah |
| **Sales Ultimate** | Rp 99.000 | 50 | ✅ TARGET — cuma Rp 10rb lebih dari Pro! |

**Psikologi:** *"Kenapa bayar Rp 89rb untuk 10 sales, kalau Rp 10rb lebih dapat unlimited?"*

Badge: `PALING LARIS` → di Sales Pro (decoy), `TERBAIK` → di Sales Ultimate

Membeli Sales tier apa pun otomatis membuka:
- Transaksi tidak terbatas per hari
- Riwayat transaksi tidak terbatas

---

### 2.2 Analytics Tiers (One-Time Purchase)

#### 3 Paket Terpisah @ Rp 49.000 masing-masing

| Produk | Harga | Fitur yang Dibuka |
|---|---|---|
| **Analitik Dashboard** | Rp 49.000 | Dashboard % ↑↓ · Hari Tersibuk · Chart 12 bulan |
| **Analitik Pelanggan** | Rp 49.000 | Ranking unlimited · Pelanggan unlimited · Customer Detail |
| **Laporan & Ekspor** | Rp 49.000 | Excel export · Share Rekap Kartu · Laporan per periode |

#### Bundle (Target Pembelian)

| Produk | Harga | Isi | Savings |
|---|---|---|---|
| **Semua Analitik** | **Rp 89.000** | Semua 8 fitur analitik | 🎣 Hemat Rp 58.000 vs beli satuan |

**Psikologi:** *"3 × Rp 49rb = Rp 147rb... atau bundle Rp 89rb? Hemat Rp 58rb!"*

Badge: `⭐ HEMAT Rp 58.000` di Semua Analitik

---

### 2.3 Backup & Sinkron (One-Time Purchase)

| Produk | Harga | Fitur |
|---|---|---|
| **Backup & Sinkron** | Rp 49.000 | Google Drive backup · Sinkron 2 HP · Widget home screen |

---

### 2.4 Subscription

| Produk | Harga | Per Bulan | Badge |
|---|---|---|---|
| **Monthly Plus** | Rp 18.900/bln | Rp 18.900 | 🎣 DECOY |
| **Yearly Plus** | Rp 169.000/thn | Rp 14.083 | ✅ HEMAT 25% |

**Psikologi:** Tampilkan harga per bulan (Rp 14.083) bukan total tahunan (Rp 169.000).

Monthly Plus membuka semua fitur, sama dengan Yearly Plus.
Yearly Plus = lebih hemat Rp 57.800 per tahun.

---

## BAGIAN 3 — ENTITLEMENT MATRIX

```
                           FREE  UNLOCK  PRO  ULTIMATE  A-DASH  A-CUST  A-EXP  A-ALL  BACKUP  MONTHLY  YEARLY
                                 Rp49    Rp89  Rp99     Rp49    Rp49    Rp49   Rp89   Rp49    Rp18.9   Rp169
─────────────────────────────────────────────────────────────────────────────────────────────────────────────
Max sales                   2     3       10    50        2       2       2      2      2       50       50
Txn/sales/hari             25    ∞        ∞     ∞        25      25      25     25     25      ∞        ∞
Riwayat                    1bln  ∞        ∞     ∞       1bln    1bln   1bln    ∞     1bln     ∞        ∞
─────────────────────────────────────────────────────────────────────────────────────────────────────────────
Dashboard % ↑↓              🔒    🔒       🔒    🔒       ✅       🔒      🔒     ✅     🔒      ✅       ✅
Hari Tersibuk               🔒    🔒       🔒    🔒       ✅       🔒      🔒     ✅     🔒      ✅       ✅
Chart 12 bulan              🔒    🔒       🔒    🔒       ✅       🔒      🔒     ✅     🔒      ✅       ✅
─────────────────────────────────────────────────────────────────────────────────────────────────────────────
Ranking unlimited           🔒    🔒       🔒    🔒       🔒       ✅      🔒     ✅     🔒      ✅       ✅
Pelanggan unlimited         🔒    🔒       🔒    🔒       🔒       ✅      🔒     ✅     🔒      ✅       ✅
Customer Detail             🔒    🔒       🔒    🔒       🔒       ✅      🔒     ✅     🔒      ✅       ✅
─────────────────────────────────────────────────────────────────────────────────────────────────────────────
Excel export                🔒    🔒       🔒    🔒       🔒       🔒      ✅     ✅     🔒      ✅       ✅
Share Rekap Kartu           🔒    🔒       🔒    🔒       🔒       🔒      ✅     ✅     🔒      ✅       ✅
─────────────────────────────────────────────────────────────────────────────────────────────────────────────
Drive backup                🔒    🔒       🔒    🔒       🔒       🔒      🔒     🔒     ✅      ✅       ✅
Sinkron 2 HP                🔒    🔒       🔒    🔒       🔒       🔒      🔒     🔒     ✅      ✅       ✅
Widget home screen          🔒    🔒       🔒    🔒       🔒       🔒      🔒     🔒     ✅      ✅       ✅
```

---

## BAGIAN 4 — PAYWALL UX

### 4.1 Blur Overlay (Hari Tersibuk)
- Konten chart **tetap dirender** tapi dengan opacity 0.12 (hampir tidak terlihat)
- Kartu gelap semi-transparan menutupi seluruh area
- Teks: `"Unlock Hari Tersibuk 🔒"` + subtitle + tombol `"Buka Sekarang — Mulai Rp 49.000"`
- Tap mana saja → PaywallSheet muncul

### 4.2 Lock Row (Ranking & Pelanggan)
- List dipotong di posisi 20 (Ranking) atau 50 (Pelanggan)
- Baris terakhir: `"🔒 +47 pelanggan tersembunyi — Tap untuk unlock"`
- Tap → PaywallSheet muncul

### 4.3 Locked Icon (% Comparison)
- Kecil, tidak mencolok: `"🔒 ↑↓ %"` dengan warna primary
- Tap → PaywallSheet muncul

### 4.4 Customer Detail Lock
- Summary tetap tampil (total omset, total bon, pertama/terakhir)
- Riwayat transaksi diganti dengan kartu lock besar
- Text: `"Riwayat Transaksi Terkunci"` + `"Lihat X transaksi dengan Analitik Pelanggan"`

### 4.5 Settings Lock (Excel & Drive)
- Excel: tombol abu-abu dengan `"🔒 Export ke Excel"` + `"Laporan & Ekspor — Rp 49.000"`
- Drive: section penuh diganti PaywallCard dengan gembok + unlock button

---

## BAGIAN 5 — PAYWALL SHEET

PaywallSheet muncul dari bawah (bottom sheet) dengan produk yang relevan.

### Contoh: user tap Hari Tersibuk
```
┌─────────────────────────────────────┐
│ 🔓 Unlock Hari Tersibuk             │
│ Pilih paket yang paling sesuai      │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Analitik Dashboard    Rp 49.000 │ │
│ │ Dashboard % · Hari Tersibuk     │ │
│ │ Chart 12 bulan                  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ⭐ HEMAT Rp 58.000               │ │
│ │ Semua Analitik        Rp 89.000 │ │  ← highlighted (target)
│ │ 8 fitur analitik sekaligus      │ │
│ │ [        Beli Sekarang →      ] │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ─── atau berlangganan ───────────── │
│                                     │
│ ┌───────────────┐ ┌───────────────┐ │
│ │ Monthly Plus  │ │ Yearly Plus   │ │
│ │ Rp 18.900/bln │ │ Rp 14.083/bln │ │  ← Yearly highlighted
│ └───────────────┘ │ HEMAT 25%     │ │
│                   └───────────────┘ │
│                                     │
│ Sudah beli? Restore pembelian       │
└─────────────────────────────────────┘
```

---

## BAGIAN 6 — PRODUCT IDs (Google Play & RevenueCat)

| RevenueCat ID | Tipe | Harga |
|---|---|---|
| `omsetku_sales_unlock` | Non-consumable | Rp 49.000 |
| `omsetku_sales_pro` | Non-consumable | Rp 89.000 |
| `omsetku_sales_ultimate` | Non-consumable | Rp 99.000 |
| `omsetku_analytics_dashboard` | Non-consumable | Rp 49.000 |
| `omsetku_analytics_customers` | Non-consumable | Rp 49.000 |
| `omsetku_analytics_export` | Non-consumable | Rp 49.000 |
| `omsetku_analytics_all` | Non-consumable | Rp 89.000 |
| `omsetku_backup_sync` | Non-consumable | Rp 49.000 |
| `omsetku_monthly_plus` | Auto-renewable subscription | Rp 18.900/bln |
| `omsetku_yearly_plus` | Auto-renewable subscription | Rp 169.000/thn |

---

## BAGIAN 7 — IMPLEMENTASI TEKNIS

### 7.1 File Baru

```
src/
  premium.js                    ← Entitlement logic, product catalog, FREE limits
  components/
    PaywallOverlay.js           ← Blur overlay untuk Hari Tersibuk dll
    PaywallSheet.js             ← Bottom sheet pricing dengan decoy styling
    LockRow.js                  ← Baris truncation untuk list
```

### 7.2 Alur Data

```
App.js
  ├── PurchasesContext.Provider (purchases state, openPaywall callback)
  │     ↓
  ├── setiap Screen via useContext(PurchasesContext)
  │     ↓
  ├── can.featureName(purchases) → boolean
  │     ↓
  ├── Jika false → PaywallOverlay / LockRow / Lock card
  │     ↓ tap
  └── openPaywall('feature_key') → setPaywallKey → PaywallSheet tampil
        ↓ user beli
        handlePurchase(productId) → savePurchases → setPurchases → re-render
```

### 7.3 Swap ke RevenueCat (TODO)

Ganti di `App.js`:
```javascript
// SEKARANG (mock):
const p = await loadPurchases(); // dari SecureStore

// NANTI (RevenueCat):
const customerInfo = await Purchases.getCustomerInfo();
const p = customerInfo.entitlements.active; // dari RevenueCat server
```

Ganti di `handlePurchase`:
```javascript
// SEKARANG (mock):
const updated = { ...purchases, [productId]: { purchasedAt: Date.now() } };
await savePurchases(updated);

// NANTI (RevenueCat):
const { customerInfo } = await Purchases.purchaseStoreProduct(storeProduct);
// RevenueCat otomatis update CustomerInfo
```

---

## BAGIAN 8 — SETUP REVENUECART & GOOGLE PLAY

### Langkah Setup (Setelah Google Play Developer Account $25 dibayar)

1. **Buat akun RevenueCat** di app.revenuecat.com (gratis)
2. **Install SDK**: `npx expo install react-native-purchases`
3. **Google Play Console**: buat semua 10 in-app products dengan ID di atas
4. **RevenueCat**: sambungkan ke Google Play, buat Entitlements
5. **Ganti mock code** di App.js dengan RevenueCat SDK calls
6. **Test** dengan test user Google Play (sandbox mode)

---

## BAGIAN 9 — PROYEKSI REVENUE

### Skenario Konservatif (bulan ke-6 setelah launch)

```
Asumsi: 1.000 download, konversi 5% = 50 paying users

Distribusi pembelian perkiraan:
  Sales Ultimate (Rp 99rb)  : 10 user = Rp 990.000
  Semua Analitik (Rp 89rb)  : 15 user = Rp 1.335.000
  Backup & Sinkron (Rp 49rb): 10 user = Rp 490.000
  Yearly Plus (Rp 169rb)    : 10 user = Rp 1.690.000
  Monthly Plus × 5 bulan    :  5 user = Rp 472.500
  ────────────────────────────────────────────────────
  Gross Revenue              : Rp 4.977.500
  Google Play 15%            : Rp (746.625)
  RevenueCat (gratis s/d ~37jt) : Rp 0
  ────────────────────────────────────────────────────
  Net Profit                 : Rp 4.230.875
```

---

## BAGIAN 10 — NOTES PENTING

1. **Semua gate sekarang berjalan dengan mock data** — tidak ada uang keluar masuk
2. `devUnlockAll()` di `src/premium.js` untuk testing semua fitur premium
3. `devClearAll()` untuk kembali ke free tier saat testing
4. Free tier tetap **fully functional** — bukan demo/trial yang expire
5. User tidak kehilangan data jika downgrade (tidak ada downgrade — OTP selamanya)

---

*Dokumen ini dibuat 1 Juni 2026 untuk OmsetKu v4.7.0*
*Update setiap kali ada perubahan pricing atau fitur gate*
