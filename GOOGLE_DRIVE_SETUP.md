# Setup Google Drive — OmsetKu
**Panduan untuk Developer | Versi 4.6.0+**

> ⚠️ Panduan ini SUDAH DIUPDATE untuk OAuth Android native (bukan Expo proxy).
> Expo proxy (`auth.expo.io`) sudah deprecated dan tidak bisa dipakai.

---

## Status Saat Ini

| Komponen | Status | Keterangan |
|---|---|---|
| Android OAuth Client ID | ✅ Aktif | `846894493859-7mnsos08bck0on5p03v66uopqbeld1g6` |
| OAuth Consent Screen | ✅ Testing | Hanya email terdaftar sebagai test user |
| Custom URI Scheme | ✅ Enabled | `com.omsetku.app:/oauth2redirect` |
| Refresh Token | ✅ Implemented | PKCE flow, auto-renew |
| Play Store Verification | ⏳ Pending | Perlu submit ke Google untuk Production |

---

## Arsitektur OAuth yang Digunakan

```
App (PKCE) → accounts.google.com/o/oauth2/v2/auth
    ↓ redirect ke
com.omsetku.app:/oauth2redirect?code=AUTH_CODE
    ↓ app menangkap deep link
exchange code → https://oauth2.googleapis.com/token (tanpa client secret)
    ↓
Access Token + Refresh Token → disimpan di SecureStore
```

**Keunggulan PKCE:**
- Tidak butuh client secret (aman untuk mobile app)
- Mendapat refresh token → tidak perlu reconnect manual setiap jam
- Standard OAuth 2.0 modern untuk installed apps

---

## Setup Baru (Jika Perlu Recreate)

### Langkah 1: Google Cloud Project

1. Buka https://console.cloud.google.com
2. Project: **OmsetKu** (ID: `omsetku-497913`) — sudah ada, gunakan yang ini

### Langkah 2: Aktifkan Google Drive API

1. **APIs & Services** → **Library**
2. Cari `Google Drive API` → **Enable**
3. Cari `People API** → **Enable** (untuk akses email user)

### Langkah 3: OAuth Consent Screen

1. **APIs & Services** → **OAuth consent screen**
2. User Type: **External**
3. Isi:
   - App name: `OmsetKu`
   - User support email: `aliangkoko@gmail.com`
   - App logo: upload icon.png
   - Privacy Policy URL: `https://littlescript.github.io/OmsetKu-docs/`
   - Developer email: `aliangkoko@gmail.com`
4. **Scopes**: tambahkan `drive.file`, `email`, `profile`
5. **Test users**: tambahkan `aliangkoko@gmail.com` (dan email lain yang perlu testing)
6. Status: **Testing** → setelah siap publish, klik **Publish App**

### Langkah 4: Buat Android OAuth Client

1. **APIs & Services** → **Credentials**
2. **+ Create Credentials** → **OAuth client ID**
3. Application type: **Android**
4. Name: `OmsetKu Android`
5. Package name: `com.omsetku.app`
6. SHA-1 fingerprint: *(dapatkan dari EAS, lihat di bawah)*
7. ✅ Centang **Enable custom URI scheme**
8. **Create** → copy Client ID

### Mendapatkan SHA-1 dari EAS

```bash
# Jalankan di terminal project OmsetKu:
eas credentials
# Pilih: Android → Production keystore → lihat SHA-1 fingerprint

# Atau dari APK yang sudah didownload:
apksigner verify --print-certs path/to/app.apk
```

SHA-1 saat ini: `F1:BF:4F:42:B0:B8:41:97:E2:2C:48:33:E5:25:C6:71:83:51:EE:18`

### Langkah 5: Update Client ID di Code

File: `src/constants.js`

```javascript
export const GOOGLE_ANDROID_CLIENT_ID = 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com';
```

Ganti dengan Client ID dari langkah 4. Rebuild APK setelah update.

---

## Konfigurasi yang Sudah Ada di Code

### `src/constants.js`
```javascript
export const GOOGLE_ANDROID_CLIENT_ID = '846894493859-7mnsos08bck0on5p03v66uopqbeld1g6.apps.googleusercontent.com';
export const GDRIVE_REDIRECT_URI      = 'com.omsetku.app:/oauth2redirect';
export const GDRIVE_TOKEN_KEY         = 'gdrive_access_token';
export const GDRIVE_REFRESH_KEY       = 'gdrive_refresh_token';
export const GDRIVE_EXPIRY_KEY        = 'gdrive_token_expiry';
export const GDRIVE_EMAIL_KEY         = 'gdrive_user_email';
export const GDRIVE_LAST_BACKUP_KEY   = 'gdrive_last_backup';
export const GDRIVE_HOUR_KEY          = 'gdrive_backup_hour';
export const GDRIVE_TASK_NAME         = 'OMSETKU_GDRIVE_BACKUP';
```

### `App.js` — OAuth Flow
```javascript
const [gRequest, gResponse, gPromptAsync] = AuthSession.useAuthRequest(
  {
    clientId:    GOOGLE_ANDROID_CLIENT_ID,
    redirectUri: GDRIVE_REDIRECT_URI,
    scopes:      ['https://www.googleapis.com/auth/drive.file', 'email', 'profile'],
    responseType:'code',
    usePKCE:     true,
    extraParams: { access_type: 'offline', prompt: 'consent' },
  },
  GOOGLE_DISCOVERY
);
```

---

## Fitur Google Drive yang Diimplementasi

| Fitur | Status | Keterangan |
|---|---|---|
| Connect/Disconnect | ✅ | Tap area email di Settings |
| Auto-sync saat foreground | ✅ | Jika >4 jam sejak sync terakhir |
| Backup manual | ✅ | Tombol Backup di Settings |
| Backup otomatis | ✅ | Background task, jam bisa dikustom |
| Restore dari Drive | ✅ | Pilih file dari daftar backup |
| Sync 2 HP | ✅ | Pull → Merge → Push |
| Auto refresh token | ✅ | Tidak perlu reconnect manual |
| Warning expired | ✅ | Banner merah jika token invalid |

---

## Untuk Submit Google Play (OAuth Verification)

Saat app dipublish ke Play Store, user umum perlu bisa connect Drive.
Langkah yang diperlukan:

1. **OAuth Consent Screen** → klik **Publish App** (pindah dari Testing ke Production)
2. Google akan review app Anda (1–4 minggu untuk scope `drive.file`)
3. Persiapkan:
   - Video demo singkat cara pakai fitur Drive di app
   - Privacy Policy URL sudah live ✅
   - Justifikasi penggunaan `drive.file` scope

---

## Troubleshooting

| Error | Penyebab | Solusi |
|---|---|---|
| `access_denied 403` | Email belum di test users | Tambah email di OAuth consent screen → Test users |
| `Error 400: invalid_request` | Client ID salah / redirect URI tidak cocok | Cek custom URI scheme sudah enabled di Google Cloud |
| Token expired setelah sebentar | Refresh token gagal | Cek GOOGLE_ANDROID_CLIENT_ID benar; reconnect |
| Backup gagal di background | Token sudah expired | Reconnect → token baru akan auto-refresh |
