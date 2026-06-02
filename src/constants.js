// ─── CONSTANTS ───────────────────────────────────────────────────────────────
export const MONTHS   = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
export const MONTHS_F = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
export const COLORS   = ['#2563eb','#22c55e','#f59e0b','#ec4899','#8b5cf6','#ef4444','#06b6d4','#84cc16'];
export const DB_NAME  = 'OmsetKu.db';

export const APP_VER    = '4.7.0';
export const SCHEMA_VER = 1;

// ─── THEMES ───────────────────────────────────────────────────────────────────
export const DARK_THEME = {
  bg:'#071018', card:'#0f1720', input:'#0a1929',
  border:'rgba(255,255,255,0.07)', primary:'#2563eb',
  success:'#22c55e', warning:'#f59e0b', text:'#f1f5f9',
  muted:'#64748b', accent:'#F57F17', danger:'#ef4444',
};
export const LIGHT_THEME = {
  bg:'#f0f4f8', card:'#ffffff', input:'#e2e8f0',
  border:'rgba(0,0,0,0.09)', primary:'#2563eb',
  success:'#16a34a', warning:'#d97706', text:'#1e293b',
  muted:'#64748b', accent:'#ea580c', danger:'#dc2626',
};

// ─── ONBOARDING ───────────────────────────────────────────────────────────────
export const ONBOARDING_SLIDES = [
  {
    emoji:    '📊',
    accent:   '#2563EB',
    title:    'Selamat Datang di OmsetKu',
    subtitle: 'Aplikasi catat omset harian\nuntuk toko & UMKM Indonesia',
    points: [
      '⚡  Input transaksi dalam hitungan detik',
      '🔌  Bekerja penuh tanpa koneksi internet',
      '👥  Support 1–20 sales per toko',
    ],
  },
  {
    emoji:    '📈',
    accent:   '#22C55E',
    title:    'Pantau Bisnis Real-Time',
    subtitle: 'Dashboard lengkap untuk\nowner dan tim sales',
    points: [
      '📊  Grafik & ranking pelanggan otomatis',
      '🏆  Lihat performa setiap sales harian',
      '📋  Laporan Excel profesional siap cetak',
    ],
  },
  {
    emoji:    '🔒',
    accent:   '#F59E0B',
    title:    'Data Selalu Aman',
    subtitle: 'Backup dan sinkron\nantar perangkat dengan mudah',
    points: [
      '☁️  Backup otomatis ke Google Drive',
      '🔄  Sinkron 2 HP untuk tim multi-sales',
      '🔐  Kunci aplikasi dengan fingerprint',
    ],
  },
];

// ─── GOOGLE DRIVE CONFIG ──────────────────────────────────────────────────────
export const GOOGLE_ANDROID_CLIENT_ID = '846894493859-7mnsos08bck0on5p03v66uopqbeld1g6.apps.googleusercontent.com';
export const GDRIVE_REDIRECT_URI      = 'com.omsetku.app:/oauth2redirect';
export const GDRIVE_TOKEN_KEY         = 'gdrive_access_token';
export const GDRIVE_REFRESH_KEY       = 'gdrive_refresh_token';
export const GDRIVE_EXPIRY_KEY        = 'gdrive_token_expiry';
export const GDRIVE_EMAIL_KEY         = 'gdrive_user_email';
export const GDRIVE_LAST_BACKUP_KEY   = 'gdrive_last_backup';
export const GDRIVE_HOUR_KEY          = 'gdrive_backup_hour';
export const GDRIVE_TASK_NAME         = 'OMSETKU_GDRIVE_BACKUP';
export const NOTIF_TASK_ID            = 'omsetku-daily-reminder';

export const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint:         'https://oauth2.googleapis.com/token',
};

// Bottom tab definitions
export const TABS = [
  { id:'input',      icon:'✚', label:'Input'      },
  { id:'dashboard',  icon:'◈', label:'Dashboard'  },
  { id:'riwayat',    icon:'☰', label:'Riwayat'    },
  { id:'ranking',    icon:'★', label:'Ranking'    },
  { id:'pelanggan',  icon:'◉', label:'Pelanggan'  },
];
