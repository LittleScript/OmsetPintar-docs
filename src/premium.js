/**
 * Omset Pintar Premium — Entitlement System
 * Sekarang: mock via SecureStore
 * Nanti: swap ke RevenueCat CustomerInfo (minimal code change)
 */
import * as SecureStore from 'expo-secure-store';

// ─── PRODUCT IDs ──────────────────────────────────────────────────────────────
// Harus identik dengan Google Play Console & RevenueCat
export const PID = {
  SALES_UNLOCK:        'omsetpintar_sales_unlock',
  SALES_PRO:           'omsetpintar_sales_pro',
  SALES_ULTIMATE:      'omsetpintar_sales_ultimate',
  ANALYTICS_DASHBOARD: 'omsetpintar_analytics_dashboard',
  ANALYTICS_CUSTOMERS: 'omsetpintar_analytics_customers',
  ANALYTICS_EXPORT:    'omsetpintar_analytics_export',
  ANALYTICS_ALL:       'omsetpintar_analytics_all',
  BACKUP_SYNC:         'omsetpintar_backup_sync',
  MONTHLY_PLUS:        'omsetpintar_monthly_plus',
  YEARLY_PLUS:         'omsetpintar_yearly_plus',
};

// ─── PRODUCT CATALOG ─────────────────────────────────────────────────────────
export const PRODUCTS = {
  // ── SALES ──────────────────────────────────────────────────────────────────
  [PID.SALES_UNLOCK]: {
    id: PID.SALES_UNLOCK, group: 'sales', type: 'otp',
    name: 'Sales Unlock', price: 49000,
    tagline: 'Hingga 3 sales',
    badge: null,
    features: ['Tambah 1 sales (total 3)', 'Transaksi tidak terbatas', 'Riwayat tidak terbatas'],
  },
  [PID.SALES_PRO]: {
    id: PID.SALES_PRO, group: 'sales', type: 'otp',
    name: 'Sales Pro', price: 89000,
    tagline: 'Hingga 10 sales',
    badge: 'PALING LARIS',     // ← decoy: bikin Ultimate keliatan murah
    features: ['Hingga 10 sales', 'Transaksi tidak terbatas', 'Riwayat tidak terbatas'],
  },
  [PID.SALES_ULTIMATE]: {
    id: PID.SALES_ULTIMATE, group: 'sales', type: 'otp',
    name: 'Sales Ultimate', price: 99000,
    tagline: 'Unlimited sales',
    badge: 'TERBAIK',
    note: 'Hanya Rp 10rb lebih dari Pro!',
    features: ['Hingga 50 sales', 'Transaksi tidak terbatas', 'Riwayat tidak terbatas'],
  },

  // ── ANALYTICS ──────────────────────────────────────────────────────────────
  [PID.ANALYTICS_DASHBOARD]: {
    id: PID.ANALYTICS_DASHBOARD, group: 'analytics', type: 'otp',
    name: 'Analitik Dashboard', price: 49000,
    tagline: 'Insight performa harian',
    badge: null,
    features: ['Dashboard % naik/turun vs kemarin', 'Hari Tersibuk penuh', 'Grafik 12 bulan penuh'],
  },
  [PID.ANALYTICS_CUSTOMERS]: {
    id: PID.ANALYTICS_CUSTOMERS, group: 'analytics', type: 'otp',
    name: 'Analitik Pelanggan', price: 49000,
    tagline: 'Kenali pelanggan Anda',
    badge: null,
    features: ['Ranking pelanggan unlimited', 'Daftar pelanggan unlimited', 'Detail + riwayat transaksi'],
  },
  [PID.ANALYTICS_EXPORT]: {
    id: PID.ANALYTICS_EXPORT, group: 'analytics', type: 'otp',
    name: 'Laporan & Ekspor', price: 49000,
    tagline: 'Laporan profesional',
    badge: null,
    features: ['Export Excel profesional', 'Share rekap sebagai gambar', 'Laporan per periode'],
  },
  [PID.ANALYTICS_ALL]: {
    id: PID.ANALYTICS_ALL, group: 'analytics', type: 'otp',
    name: 'Semua Analitik', price: 89000,
    tagline: '8 fitur analitik sekaligus',
    badge: '⭐ HEMAT Rp 58.000',  // ← target: 3×49rb=147rb vs 89rb
    savings: 58000,
    features: ['Analitik Dashboard', 'Analitik Pelanggan', 'Laporan & Ekspor', '+ 8 fitur analitik'],
  },

  // ── BACKUP ─────────────────────────────────────────────────────────────────
  [PID.BACKUP_SYNC]: {
    id: PID.BACKUP_SYNC, group: 'backup', type: 'otp',
    name: 'Backup & Sinkron', price: 49000,
    tagline: 'Data aman di cloud',
    badge: null,
    features: ['Google Drive backup otomatis', 'Sinkron 2 HP', 'Widget home screen'],
  },

  // ── SUBSCRIPTION ───────────────────────────────────────────────────────────
  [PID.MONTHLY_PLUS]: {
    id: PID.MONTHLY_PLUS, group: 'subscription', type: 'monthly',
    name: 'Monthly Plus', price: 18900,
    tagline: 'Semua fitur / bulan',
    badge: '🎁 7 HARI GRATIS',  // free trial badge
    trial: '7 hari gratis, batalkan kapan saja',
    features: ['7 hari coba GRATIS', 'Semua fitur premium', 'Batalkan kapan saja', 'Uang kembali jika tidak puas'],
  },
  [PID.YEARLY_PLUS]: {
    id: PID.YEARLY_PLUS, group: 'subscription', type: 'yearly',
    name: 'Yearly Plus', price: 169000, pricePerMonth: 14083,
    tagline: 'Semua fitur / tahun',
    badge: 'HEMAT 25%',
    savings: 57800,
    trial: '7 hari gratis, batalkan kapan saja',
    features: ['7 hari coba GRATIS', 'Hanya Rp 14.083 / bulan', 'Hemat Rp 57.800 vs bulanan', 'Uang kembali jika tidak puas'],
  },
};

// ─── PAYWALL MAPPING — produk yang ditampilkan per fitur terkunci ─────────────
export const PAYWALL_MAP = {
  hari_tersibuk:   { title: 'Unlock Hari Tersibuk', products: [PID.ANALYTICS_DASHBOARD, PID.ANALYTICS_ALL] },
  dashboard_pct:   { title: 'Unlock Perbandingan %', products: [PID.ANALYTICS_DASHBOARD, PID.ANALYTICS_ALL] },
  chart_full:      { title: 'Unlock Grafik Penuh',  products: [PID.ANALYTICS_DASHBOARD, PID.ANALYTICS_ALL] },
  ranking_full:    { title: 'Unlock Ranking Penuh', products: [PID.ANALYTICS_CUSTOMERS, PID.ANALYTICS_ALL] },
  customer_full:   { title: 'Unlock Semua Pelanggan', products: [PID.ANALYTICS_CUSTOMERS, PID.ANALYTICS_ALL] },
  customer_detail: { title: 'Unlock Detail Pelanggan', products: [PID.ANALYTICS_CUSTOMERS, PID.ANALYTICS_ALL] },
  excel_export:    { title: 'Unlock Export Excel', products: [PID.ANALYTICS_EXPORT, PID.ANALYTICS_ALL] },
  share_kartu:     { title: 'Unlock Share Gambar', products: [PID.ANALYTICS_EXPORT, PID.ANALYTICS_ALL] },
  backup_drive:    { title: 'Unlock Backup Drive', products: [PID.BACKUP_SYNC] },
  more_sales:      { title: 'Tambah Sales',         products: [PID.SALES_UNLOCK, PID.SALES_PRO, PID.SALES_ULTIMATE] },
};

// ─── FREE TIER LIMITS ─────────────────────────────────────────────────────────
export const FREE = {
  MAX_SALES:              2,
  MAX_TXN_PER_SALES_DAY: 25,
  HISTORY_MONTHS:         1,
  MAX_RANKING:           20,
  MAX_CUSTOMERS:         50,
  CHART_MONTHS_VISIBLE:   2,
};

// ─── ENTITLEMENT CHECKS ───────────────────────────────────────────────────────
const isPlus  = (p) => !!(p?.[PID.MONTHLY_PLUS] || p?.[PID.YEARLY_PLUS]);
const has     = (p, ...ids) => isPlus(p) || ids.some(id => !!p?.[id]);

export const getMaxSales = (p) => {
  if (isPlus(p) || p?.[PID.SALES_ULTIMATE]) return 50;
  if (p?.[PID.SALES_PRO])                   return 10;
  if (p?.[PID.SALES_UNLOCK])                return  3;
  return FREE.MAX_SALES;
};

export const can = {
  moreSales:       (p) => getMaxSales(p) > FREE.MAX_SALES,
  unlimitedTxn:    (p) => has(p, PID.SALES_UNLOCK, PID.SALES_PRO, PID.SALES_ULTIMATE),
  unlimitedHistory:(p) => has(p, PID.SALES_UNLOCK, PID.SALES_PRO, PID.SALES_ULTIMATE, PID.ANALYTICS_ALL),
  dashboardPct:    (p) => has(p, PID.ANALYTICS_DASHBOARD, PID.ANALYTICS_ALL),
  hariTersibuk:    (p) => has(p, PID.ANALYTICS_DASHBOARD, PID.ANALYTICS_ALL),
  chartFull:       (p) => has(p, PID.ANALYTICS_DASHBOARD, PID.ANALYTICS_ALL),
  rankingFull:     (p) => has(p, PID.ANALYTICS_CUSTOMERS, PID.ANALYTICS_ALL),
  customerFull:    (p) => has(p, PID.ANALYTICS_CUSTOMERS, PID.ANALYTICS_ALL),
  customerDetail:  (p) => has(p, PID.ANALYTICS_CUSTOMERS, PID.ANALYTICS_ALL),
  excelExport:     (p) => has(p, PID.ANALYTICS_EXPORT,    PID.ANALYTICS_ALL),
  shareKartu:      (p) => has(p, PID.ANALYTICS_EXPORT,    PID.ANALYTICS_ALL),
  backupDrive:     (p) => has(p, PID.BACKUP_SYNC),
  syncMulti:       (p) => has(p, PID.BACKUP_SYNC),
  widget:          (p) => has(p, PID.BACKUP_SYNC),
};

// ─── STORAGE (mock — nanti swap ke RevenueCat) ────────────────────────────────
const KEY = 'omsetpintar_purchases_v1';

export const loadPurchases = async () => {
  try { return JSON.parse(await SecureStore.getItemAsync(KEY) || '{}'); }
  catch { return {}; }
};

export const savePurchases = async (p) => {
  await SecureStore.setItemAsync(KEY, JSON.stringify(p));
};

// DEV ONLY — unlock semua untuk testing tanpa beli
export const devUnlockAll = async () => {
  const all = {};
  Object.values(PID).forEach(id => { all[id] = { purchasedAt: Date.now() }; });
  await savePurchases(all);
};

export const devClearAll = async () => {
  await SecureStore.deleteItemAsync(KEY).catch(() => {});
};

// Format harga
export const fmtPrice = (n) => 'Rp ' + n.toLocaleString('id-ID');
