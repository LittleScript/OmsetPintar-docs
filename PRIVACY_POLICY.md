# Kebijakan Privasi Omset Pintar

**Terakhir diperbarui:** 3 Juni 2026 (v1.0.1)

## 1. Pendahuluan

Omset Pintar ("Aplikasi") adalah aplikasi pencatatan omset harian untuk usaha mikro, kecil, dan menengah (UMKM) Indonesia. Dikembangkan oleh @Maelllai. Kebijakan Privasi ini menjelaskan bagaimana Aplikasi mengumpulkan, menggunakan, menyimpan, dan melindungi informasi Anda.

---

## 2. Informasi yang Dikumpulkan

### 2.1 Data yang Anda Masukkan Langsung
- Nama bisnis / toko
- Nama sales / karyawan
- Data transaksi: nomor bon, tanggal, nama pelanggan, nominal, catatan
- Pengaturan aplikasi (format bon, format tanggal, mata uang, tema, jam notifikasi)

### 2.2 Data Google (hanya jika fitur Google Drive diaktifkan — opsional)
- **Email akun Google** disimpan lokal di SecureStore (terenkripsi)
- **Token OAuth** (access token + refresh token) disimpan lokal di SecureStore (terenkripsi)
- File backup diunggah ke folder "Omset Pintar Backup" di **Google Drive milik Anda sendiri**

### 2.3 Preferensi Pengguna (disimpan lokal)
- **Pilihan bahasa** (Indonesia/English) — disimpan di SecureStore
- **Pilihan mata uang** (IDR/USD/MYR/SGD/EUR/GBP) — disimpan di database lokal
- **Preferensi tema** (gelap/terang) — disimpan di database lokal
- **Pengaturan notifikasi** — disimpan di database lokal

Semua preferensi di atas **tidak dikirim ke server mana pun**.

### 2.4 Data yang TIDAK Dikumpulkan
Aplikasi ini **TIDAK** mengumpulkan:
- Informasi pribadi identitas Anda (selain email Google jika Drive aktif)
- Data lokasi / GPS
- Data kontak dari perangkat
- Informasi pembayaran / kartu kredit
- Data biometrik (sidik jari hanya digunakan untuk verifikasi lokal di perangkat, tidak disimpan)
- Analytics / telemetri penggunaan
- Data perangkat (model HP, IMEI, dsb)

---

## 3. Penyimpanan Data

| Jenis Data | Lokasi | Akses |
|---|---|---|
| Transaksi & pengaturan | SQLite lokal di HP | Hanya app Omset Pintar |
| Preferensi bahasa & tema | SecureStore (terenkripsi) | Hanya app Omset Pintar |
| Token OAuth Google | SecureStore (terenkripsi) | Hanya app Omset Pintar |
| File backup | Google Drive akun Anda | Anda + yang Anda izinkan |

**Semua data bisnis Anda tersimpan sepenuhnya di perangkat Anda sendiri.** Omset Pintar tidak memiliki server yang menyimpan data transaksi Anda.

---

## 4. Izin Aplikasi

| Izin | Keperluan |
|---|---|
| `USE_BIOMETRIC` | Kunci aplikasi dengan fingerprint/PIN — proteksi data bisnis |
| `USE_FINGERPRINT` | Alias untuk biometrik (beberapa perangkat Android) |
| `RECEIVE_BOOT_COMPLETED` | Restart backup otomatis Google Drive setelah HP restart |
| `INTERNET` | Backup & sinkron Google Drive (opsional, hanya saat fitur diaktifkan) |
| `POST_NOTIFICATIONS` | Notifikasi pengingat harian input transaksi (opsional) |
| `READ_EXTERNAL_STORAGE` | Membaca file saat import CSV atau restore backup JSON dari storage |
| `WRITE_EXTERNAL_STORAGE` | Menyimpan file export (CSV/JSON) ke folder OmsetPintar di penyimpanan internal HP |
| `READ_MEDIA_IMAGES` | Menyimpan gambar rekap omset ke Galeri HP (Android 13+) |

### 4.1 Tentang Izin Storage

Izin penyimpanan (`READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `READ_MEDIA_IMAGES`) **hanya digunakan untuk:**
- Menyimpan file CSV/JSON hasil export ke folder `Downloads/OmsetPintar/` di HP Anda
- Menyimpan gambar kartu rekap omset ke Galeri HP
- Membaca file backup saat proses import/restore

**File yang disimpan TIDAK pernah diunggah ke server manapun.** Seluruh file tersimpan 100% di perangkat Anda sendiri.

---

## 5. Penggunaan Data

Data hanya digunakan **di dalam aplikasi** untuk:
- Menampilkan dashboard omset, grafik, dan ranking pelanggan
- Menghasilkan laporan Excel untuk keperluan bisnis Anda
- Backup ke Google Drive Anda (jika diaktifkan)
- Sinkronisasi antar perangkat (menggunakan Drive Anda sendiri sebagai perantara)
- Notifikasi pengingat harian (jika diaktifkan)

**Kami tidak pernah:**
- Menggunakan data untuk iklan atau targeting
- Membagikan data ke pihak ketiga
- Mengakses data tanpa sepengetahuan Anda
- Menjual data Anda ke siapa pun

---

## 6. Google Drive & Sinkronisasi

Fitur Google Drive bersifat **sepenuhnya opsional**. Jika diaktifkan:
- Data dibackup ke folder "Omset Pintar Backup" di Google Drive **akun Anda sendiri**
- Koneksi menggunakan protokol **OAuth 2.0 dengan PKCE** (aman, tanpa menyimpan client secret)
- Token diperbarui otomatis tanpa perlu login ulang
- Sinkronisasi antar 2 HP menggunakan Drive sebagai perantara — **bukan server Omset Pintar**
- Anda dapat mencabut izin kapan saja di: `myaccount.google.com → Keamanan → Aplikasi pihak ketiga`

---

## 7. Keamanan Biometrik (Fingerprint / PIN)

Fitur kunci aplikasi menggunakan:
- **`expo-local-authentication`** — library resmi Expo untuk autentikasi biometrik
- Sidik jari **tidak pernah disimpan** oleh Omset Pintar — proses verifikasi sepenuhnya dilakukan oleh Android OS
- PIN HP sebagai fallback (juga diproses oleh Android OS, bukan Omset Pintar)
- Timer 30 detik: app terkunci jika berpindah ke background lebih dari 30 detik
- **Tidak mengunci** saat buka file picker, share sheet, atau notifikasi — hanya saat benar-benar berpindah ke app lain

---

## 8. Keamanan Data

- Data lokal dilindungi enkripsi storage Android
- Token OAuth disimpan di Android SecureStore (terenkripsi oleh OS)
- Kunci aplikasi fingerprint sebagai lapisan keamanan tambahan
- Reset data memerlukan konfirmasi ganda + verifikasi fingerprint (jika aktif)

---

## 9. Hak Pengguna

- **Hapus semua data**: Settings → Reset Semua Data (konfirmasi ganda)
- **Export data**: Settings → Data Saya → Export Backup JSON / Export CSV (tersimpan di `Downloads/OmsetPintar/`)
- **Simpan gambar rekap**: Dashboard → Share Rekap → Simpan ke Galeri
- **Putus Drive**: Settings → Google Drive → Putus Koneksi (token dihapus dari perangkat)
- **Hapus aplikasi**: Uninstall menghapus seluruh data lokal secara permanen
- **Cabut akses Google**: `myaccount.google.com → Keamanan → Aplikasi pihak ketiga → Omset Pintar`

---

## 10. Data Anak-Anak

Aplikasi ini ditujukan untuk penggunaan bisnis oleh orang dewasa. Kami tidak mengumpulkan data dari anak-anak di bawah usia 13 tahun.

---

## 11. Perubahan Kebijakan

Versi terbaru selalu tersedia di: https://littlescript.github.io/OmsetPintar-docs/

Perubahan signifikan akan diumumkan melalui pembaruan aplikasi.

---

## 12. Kontak

**Developer:** @Maelllai  
**Email:** aliangkoko@gmail.com  
**GitHub:** https://github.com/LittleScript/OmsetPintar-docs  
**Privacy Policy URL:** https://littlescript.github.io/OmsetPintar-docs/

---

*Berlaku mulai Omset Pintar v1.0.0, diperbarui v1.0.1 (penambahan izin storage & galeri)*  
*Package: com.omsetpintar.app*  
*URL Online: https://littlescript.github.io/OmsetPintar-docs/*
