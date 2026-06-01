# Kebijakan Privasi OmsetKu

**Terakhir diperbarui:** 1 Juni 2026

## 1. Pendahuluan

OmsetKu ("Aplikasi") adalah aplikasi pencatatan omset harian untuk usaha mikro, kecil, dan menengah (UMKM) Indonesia yang dikembangkan untuk membantu pemilik toko dan tim sales mencatat transaksi dengan mudah, cepat, dan aman.

Kebijakan Privasi ini menjelaskan bagaimana Aplikasi mengumpulkan, menggunakan, menyimpan, dan melindungi informasi Anda.

---

## 2. Informasi yang Dikumpulkan

### 2.1 Data yang Anda Masukkan Langsung
OmsetKu menyimpan data berikut yang Anda input secara langsung:
- Nama bisnis / toko
- Nama sales / karyawan
- Data transaksi: nomor bon, tanggal, nama pelanggan, nominal, catatan
- Pengaturan aplikasi (format bon, format tanggal, tema, jam notifikasi)

### 2.2 Data Google (hanya jika fitur Google Drive diaktifkan)
Jika Anda memilih untuk menghubungkan akun Google Drive:
- **Email akun Google** yang Anda pilih disimpan lokal di SecureStore (terenkripsi)
- **Token OAuth** (access token + refresh token) disimpan lokal di SecureStore (terenkripsi) untuk menjaga koneksi tanpa perlu login ulang
- File backup diunggah ke folder "OmsetKu Backup" di **Google Drive milik Anda sendiri**

### 2.3 Data yang TIDAK Dikumpulkan
Aplikasi ini **TIDAK** mengumpulkan:
- Informasi pribadi identitas Anda (selain email Google jika Drive aktif)
- Data lokasi / GPS
- Data kontak dari perangkat
- Informasi pembayaran / kartu kredit
- Data biometrik (sidik jari tidak disimpan atau dikirimkan — hanya digunakan untuk verifikasi lokal via sistem Android)
- Analytics / telemetri penggunaan
- Log aktivitas pengguna

---

## 3. Penyimpanan Data

| Jenis Data | Lokasi Penyimpanan | Akses |
|---|---|---|
| Transaksi & pengaturan | SQLite lokal di HP Anda | Hanya app OmsetKu |
| Token OAuth Google | SecureStore (terenkripsi) | Hanya app OmsetKu |
| File backup | Google Drive akun Anda | Anda + siapapun yang Anda izinkan |

Seluruh data bisnis (transaksi, pelanggan, sales) **hanya tersimpan di perangkat Anda**. Tidak ada server OmsetKu yang menerima atau menyimpan data Anda.

---

## 4. Izin Aplikasi yang Diminta

| Izin | Keperluan |
|---|---|
| `USE_BIOMETRIC` / `USE_FINGERPRINT` | Kunci aplikasi fingerprint (opsional, tidak menyimpan biometrik) |
| `RECEIVE_BOOT_COMPLETED` | Restart backup otomatis Drive setelah HP restart (jika Drive aktif) |
| `INTERNET` | Backup & sinkron Google Drive (opsional, tidak wajib untuk fungsi utama) |
| `POST_NOTIFICATIONS` | Notifikasi pengingat harian (opsional) |
| `READ_EXTERNAL_STORAGE` | Import file CSV dari penyimpanan (opsional) |
| `WRITE_EXTERNAL_STORAGE` | Simpan file export Excel / backup (opsional) |

---

## 5. Penggunaan Data

Data yang Anda masukkan **hanya digunakan** untuk keperluan berikut di dalam aplikasi:
- Menampilkan dashboard omset, grafik, dan ranking pelanggan
- Menghasilkan laporan Excel
- Backup ke Google Drive Anda (jika diaktifkan)
- Sinkronisasi antar perangkat (jika diaktifkan, menggunakan Drive Anda sendiri)

**Kami tidak pernah:**
- Menggunakan data Anda untuk iklan
- Membagikan data ke pihak ketiga
- Mengakses data Anda tanpa sepengetahuan Anda

---

## 6. Google Drive & Sinkronisasi

Fitur Google Drive bersifat **sepenuhnya opsional**. Jika diaktifkan:
- Data dibackup ke folder "OmsetKu Backup" di Google Drive **akun Anda sendiri**
- Sinkronisasi antar 2 HP menggunakan Drive sebagai perantara (bukan server OmsetKu)
- Koneksi menggunakan protokol OAuth 2.0 standar dengan PKCE (aman tanpa client secret)
- Token diperbarui otomatis tanpa perlu login ulang berulang
- Anda dapat mencabut izin aplikasi kapan saja melalui: myaccount.google.com → Keamanan → Aplikasi yang memiliki akses

---

## 7. Keamanan Data

- **Data lokal**: Dilindungi oleh keamanan perangkat Anda (PIN, sidik jari, enkripsi storage Android)
- **Token OAuth**: Disimpan di SecureStore Android (terenkripsi)
- **Kunci Aplikasi**: Fitur opsional — fingerprint/PIN HP sebagai lapisan keamanan tambahan
- **Backup**: Dienkripsi oleh Google Drive sesuai kebijakan Google

Kami menyarankan melakukan backup data secara berkala. Jika perangkat hilang atau direset tanpa backup, data tidak dapat dipulihkan oleh kami karena kami tidak memiliki salinan data Anda.

---

## 8. Data Anak-Anak

Aplikasi ini ditujukan untuk penggunaan bisnis oleh orang dewasa. Kami tidak secara sengaja mengumpulkan data dari anak-anak di bawah usia 13 tahun.

---

## 9. Hak Pengguna

Karena seluruh data tersimpan lokal di perangkat Anda, Anda memiliki kendali penuh:
- **Hapus semua data**: Settings → Reset Semua Data
- **Export data**: Settings → Laporan (Excel) atau Export Backup JSON
- **Putus koneksi Drive**: Settings → Backup Google Drive → Putus Koneksi
- **Hapus aplikasi**: Menghapus seluruh data lokal secara permanen
- **Cabut akses Google**: myaccount.google.com → Keamanan → Aplikasi pihak ketiga

---

## 10. Perubahan Kebijakan Privasi

Kebijakan ini dapat diperbarui seiring perkembangan aplikasi. Versi terbaru selalu tersedia di:
- Dalam aplikasi: Settings → tentang
- Online: https://littlescript.github.io/OmsetKu-docs/

Perubahan signifikan akan diberitahukan melalui pembaruan aplikasi di Google Play Store.

---

## 11. Kontak

Pertanyaan atau laporan terkait privasi:

**Email:** aliangkoko@gmail.com
**GitHub:** https://github.com/LittleScript/OmsetKu-docs

---

*Kebijakan Privasi ini berlaku untuk OmsetKu v4.6.0 dan seterusnya.*
*URL Online: https://littlescript.github.io/OmsetKu-docs/*
