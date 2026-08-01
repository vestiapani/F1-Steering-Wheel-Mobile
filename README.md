# 🏁 F1 Racing Wheel / Pitwall Dashboard

Aplikasi *dashboard* dan *button box* modular berbasis Android untuk simulator balap F1. Aplikasi ini dirancang untuk bekerja secara berdampingan dengan aplikasi server PC **[F1 Pitwall](https://github.com/vestiapani/F1-Pitwall)** guna memantau telemetri sekaligus mengontrol fungsi mobil secara nirkabel maupun menggunakan kabel.

---

## ✨ Fitur Utama
- **Modular Button Box:** Atur dan kustomisasi tombol makro sesuai kebutuhan kokpit virtual Anda.
- **Live Telemetry & Track Map:** Pantau data telemetri, posisi lawan, hingga *leaderboard* secara *real-time*.
- **Dukungan Stik Virtual (ViGEmBus):** Integrasi mulus dengan PC menggunakan driver kontroler Xbox virtual agar langsung terbaca di dalam game F1.
- **Koneksi Fleksibel:** Hubungkan perangkat menggunakan jaringan WiFi lokal atau kabel USB via ADB (ADB Reverse) untuk latensi sekecil mungkin.

---

## 🛠️ Prasyarat Sistem
Agar aplikasi Android ini dapat berfungsi optimal, Anda memerlukan:
1. **Aplikasi PC F1 Pitwall** yang terinstal di komputer (unduh melalui [F1 Pitwall Releases](https://github.com/vestiapani/F1-Pitwall/releases)).
2. **ViGEmBus Driver** yang terinstal di PC agar emulasi *controller* berjalan dengan baik.
3. **Perangkat Android** dengan file APK terinstal.

---

## 📦 Cara Instalasi & Penggunaan

### 1. Sisi PC (Server)
1. Unduh dan pasang aplikasi PC **F1 Pitwall** dari [halaman rilis resminya](https://github.com/vestiapani/F1-Pitwall/releases).
2. Pastikan driver **ViGEmBus** sudah terpasang di komputer Anda.
3. Jalankan aplikasi F1 Pitwall di PC (telemetri game F1 akan otomatis terhubung jika pengaturan UDP dibiarkan *default*).

### 2. Sisi Android (Client APK)
1. Download file APK versi terbaru dari halaman **Releases** repository ini.
2. Install file APK tersebut ke perangkat Android Anda (pastikan izin *Install from Unknown Sources* aktif).
3. Hubungkan HP ke PC menggunakan salah satu metode koneksi berikut:
   - **Metode WiFi:** Pastikan PC dan HP berada di jaringan WiFi yang sama, lalu masukkan IP Server yang tertera di aplikasi PC ke aplikasi HP.
   - **Metode USB (ADB):** Aktifkan *USB Debugging* di HP, sambungkan via kabel data, klik tombol **USB** di aplikasi PC, lalu isi kolom IP di HP dengan `127.0.0.1`.

### 3. Konfigurasi di Dalam Game
1. Jalankan game simulator F1 di PC Anda.
2. Masuk ke menu pengaturan kontrol (*Control Settings*).
3. Lakukan *mapping* tombol pada fungsi yang diinginkan (seperti DRS, ERS, atau DIFF) dengan menekan tombol yang ada di aplikasi Android.