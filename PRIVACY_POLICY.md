# Kebijakan Privasi Omset Pintar

**Terakhir diperbarui:** 3 Juni 2026 (v1.0.0)

## 1. Pendahuluan

Omset Pintar ("Aplikasi") adalah aplikasi pencatatan omset harian untuk usaha mikro, kecil, dan menengah (UMKM) Indonesia. Kebijakan Privasi ini menjelaskan bagaimana Aplikasi mengumpulkan, menggunakan, menyimpan, dan melindungi informasi Anda.

---

## 2. Informasi yang Dikumpulkan

### 2.1 Data yang Anda Masukkan Langsung
- Nama bisnis / toko
- Nama sales / karyawan
- Data transaksi: nomor bon, tanggal, nama pelanggan, nominal, catatan
- Pengaturan aplikasi (format bon, format tanggal, tema, jam notifikasi)

### 2.2 Data Google (hanya jika fitur Google Drive diaktifkan)
- **Email akun Google** disimpan lokal di SecureStore (terenkripsi)
- **Token OAuth** (access token + refresh token) disimpan lokal di SecureStore (terenkripsi)
- File backup diunggah ke folder "Omset Pintar Backup" di **Google Drive milik Anda sendiri**

### 2.2a Preferensi Bahasa
- **Pilihan bahasa** (Indonesia/English) disimpan lokal di SecureStore perangkat Anda
- Tidak dikirim ke server mana pun

### 2.3 Data yang TIDAK Dikumpulkan
Aplikasi ini **TIDAK** mengumpulkan:
- Informasi pribadi identitas Anda (selain email Google jika Drive aktif)
- Data lokasi / GPS
- Data kontak dari perangkat
- Informasi pembayaran / kartu kredit
- Data biometrik (sidik jari hanya digunakan untuk verifikasi lokal)
- Analytics / telemetri penggunaan

---

## 3. Penyimpanan Data

| Jenis Data | Lokasi | Akses |
|---|---|---|
| Transaksi & pengaturan | SQLite lokal di HP | Hanya app Omset Pintar |
| Token OAuth Google | SecureStore (terenkripsi) | Hanya app Omset Pintar |
| File backup | Google Drive akun Anda | Anda + yang Anda izinkan |

---

## 4. Izin Aplikasi

| Izin | Keperluan |
|---|---|
| `USE_BIOMETRIC` | Kunci aplikasi fingerprint + verifikasi reset data |
| `RECEIVE_BOOT_COMPLETED` | Restart backup otomatis setelah HP restart |
| `INTERNET` | Backup & sinkron Google Drive (opsional) |
| `POST_NOTIFICATIONS` | Notifikasi pengingat harian (opsional) |
| `READ_EXTERNAL_STORAGE` | Import file CSV |
| `WRITE_EXTERNAL_STORAGE` | Simpan file export Excel / backup |

---

## 5. Penggunaan Data

Data hanya digunakan **di dalam aplikasi** untuk:
- Menampilkan dashboard omset, grafik, dan ranking pelanggan
- Menghasilkan laporan Excel
- Backup ke Google Drive Anda (jika diaktifkan)
- Sinkronisasi antar perangkat (menggunakan Drive Anda sendiri)

**Kami tidak pernah:** menggunakan data untuk iklan, membagikan ke pihak ketiga, atau mengakses data tanpa sepengetahuan Anda.

---

## 6. Google Drive & Sinkronisasi

Fitur Google Drive bersifat **sepenuhnya opsional**. Jika diaktifkan:
- Data dibackup ke folder "Omset Pintar Backup" di Google Drive **akun Anda sendiri**
- Koneksi menggunakan protokol OAuth 2.0 dengan PKCE (aman, tanpa client secret)
- Token diperbarui otomatis tanpa perlu login ulang
- Sinkronisasi antar 2 HP menggunakan Drive sebagai perantara — bukan server Omset Pintar
- Anda dapat mencabut izin kapan saja di: myaccount.google.com → Keamanan → Aplikasi pihak ketiga

---

## 7. Keamanan Data

- Data lokal dilindungi enkripsi storage Android
- Token OAuth disimpan di Android SecureStore (terenkripsi)
- Kunci aplikasi fingerprint sebagai lapisan keamanan tambahan
- Reset data memerlukan konfirmasi ganda + verifikasi fingerprint (jika aktif)

---

## 8. Hak Pengguna

- **Hapus semua data**: Settings → Reset Semua Data
- **Export data**: Settings → Laporan (Excel) atau Export Backup JSON
- **Putus Drive**: Settings → Backup Google Drive → Putus Koneksi
- **Hapus aplikasi**: Menghapus seluruh data lokal secara permanen
- **Cabut akses Google**: myaccount.google.com → Keamanan → Aplikasi pihak ketiga

---

## 9. Data Anak-Anak

Aplikasi ini ditujukan untuk penggunaan bisnis oleh orang dewasa. Kami tidak mengumpulkan data dari anak-anak di bawah usia 13 tahun.

---

## 10. Perubahan Kebijakan

Versi terbaru selalu tersedia di: https://littlescript.github.io/OmsetPintar-docs/

---

## 11. Kontak

**Email:** aliangkoko@gmail.com  
**GitHub:** https://littlescript.github.io/OmsetPintar-docs/

---

*Berlaku mulai Omset Pintar v1.0.0*  
*Package: com.omsetpintar.app*  
*URL Online: https://littlescript.github.io/OmsetPintar-docs/*
