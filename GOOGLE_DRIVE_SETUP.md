# Setup Google Drive Backup — OmsetKu

Setelah langkah ini selesai, isi GOOGLE_WEB_CLIENT_ID di App.js baris yang ditandai.

## Langkah 1: Buat Google Cloud Project

1. Buka https://console.cloud.google.com
2. Klik dropdown project di atas → **New Project**
3. Nama: `OmsetKu` → **Create**
4. Tunggu selesai, lalu pilih project tersebut

## Langkah 2: Aktifkan Google Drive API

1. Di sidebar: **APIs & Services** → **Library**
2. Cari: `Google Drive API` → klik → **Enable**

## Langkah 3: Buat OAuth Consent Screen

1. **APIs & Services** → **OAuth consent screen**
2. User Type: **External** → **Create**
3. Isi:
   - App name: `OmsetKu`
   - User support email: `aliangkoko@gmail.com`
   - Developer email: `aliangkoko@gmail.com`
4. **Save and Continue** (skip Scopes, skip Test users)
5. Back to Dashboard

## Langkah 4: Buat OAuth 2.0 Client ID

1. **APIs & Services** → **Credentials**
2. **+ Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `OmsetKu Web Client`
5. Authorized redirect URIs — tambahkan HANYA INI:
   ```
   https://auth.expo.io/@aliangkoko/omsetku
   ```
   ✅ HANYA 1 URI — pakai Expo proxy, tidak perlu custom scheme
   ⚠️ Jangan tambahkan com.omsetku.app:// — tidak diizinkan di Web client
6. **Create**
7. **COPY Client ID** — bentuknya: `XXXXXXXXXX-xxxx.apps.googleusercontent.com`

## Langkah 5: Isi Client ID di App.js

Buka App.js, cari baris:
```js
const GOOGLE_WEB_CLIENT_ID = 'GANTI_DENGAN_WEB_CLIENT_ID_DARI_GOOGLE_CLOUD';
```

Ganti dengan Client ID yang baru dicopy:
```js
const GOOGLE_WEB_CLIENT_ID = '1234567890-abcdefg.apps.googleusercontent.com';
```

Lalu rebuild APK.

## Catatan Penting

- Pertama kali pakai, user harus tap "Hubungkan Google Drive" di Settings dan login Google
- Token disimpan aman di SecureStore (encrypted)
- Backup otomatis berjalan harian di background
- File tersimpan di Google Drive folder "OmsetKu Backup"
