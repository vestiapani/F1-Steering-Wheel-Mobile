# F1 Remote Mobile

Aplikasi Android untuk mengubah HP menjadi controller nirkabel (tombol + pedal gas + kemudi via gyro) yang terhubung ke PC lewat WiFi, dipakai bersama server companion (Node.js + Socket.IO + ViGEmClient) yang meneruskan input ke game sebagai virtual gamepad, dan mengirim balik data telemetri (kecepatan, gigi, RPM) serta getaran ke HP.

## Fitur
- Tombol face button (A/B/X/Y), bumper (LB/RB), dan trigger R2 (rem/gas tambahan)
- Slider gas dengan multi-touch independen
- Kemudi via kemiringan HP (gyroscope), dengan kalibrasi otomatis & mode invert
- Panel telemetri: gigi, kecepatan, shift light RPM
- Haptic feedback dari getaran game
- Layout tombol bisa digeser & di-resize bebas (mode Edit Layout)
- IP server bisa diisi langsung di aplikasi, tidak perlu hardcode

## Tech stack
- [Expo](https://expo.dev) (React Native) — tanpa `expo-router`, satu layar (`App.js`)
- `expo-sensors` untuk gyroscope, `expo-haptics` untuk getaran
- `socket.io-client` untuk komunikasi realtime ke server PC

## Menjalankan untuk development

```bash
npm install
npx expo start
```

Scan QR dengan Expo Go, atau tekan `a` untuk emulator Android.

## Build APK (production, tanpa Expo Go)

Menjalankan lewat Expo Go menambah latency karena bundle JS masih di-serve dari Metro dev server. Build APK sendiri jauh lebih responsif:

```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview
```

Setelah build selesai, download & install APK ke HP. Buka aplikasi, isi IP lokal laptop kamu (mis. `192.168.1.9:3000`) di kolom yang tersedia — pastikan HP & laptop di jaringan WiFi yang sama, lalu tekan **Connect**.

### Kalau APK force close
Pastikan tidak ada dependency versi `canary`/eksperimental yang tidak dipakai di `package.json`. Untuk debug lebih detail:

```bash
npx expo run:android      # build & jalankan lokal, log error langsung tampil
# atau
adb logcat *:E            # lihat crash log di HP yang tersambung USB
```

## Struktur proyek