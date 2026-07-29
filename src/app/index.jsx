import * as Haptics from "expo-haptics";
import { DeviceMotion } from "expo-sensors";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  PanResponder,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { io } from "socket.io-client";

// Mode koneksi:
// - USB (via adb reverse, latency lebih rendah & stabil): "http://localhost:3000"
// - WiFi: ganti ke IP address laptop kamu, misal "http://192.168.1.9:3000"
const SERVER_IP = "http://localhost:3000";
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// =====================================================================
// EditableItem — pembungkus UNIVERSAL untuk semua elemen di layar
// (tombol, R2, slider gas, gear/speed, shift light...).
// Saat isEditMode aktif:
//   - drag di badan elemen => geser posisi (x, y)
//   - drag di handle pojok kanan-bawah => ubah ukuran (w, h)
// Saat isEditMode nonaktif: elemen berfungsi normal (tombol bisa ditekan,
// slider bisa disentuh, dll) karena PanResponder elemen ini otomatis
// "mengalah" (onStartShouldSetPanResponder => false).
// =====================================================================
const EditableItem = ({
  id,
  x,
  y,
  w,
  h,
  minW = 40,
  minH = 40,
  isEditMode,
  onUpdateLayout,
  children,
}) => {
  const pan = useRef(new Animated.ValueXY({ x, y })).current;
  const sizeAnim = useRef(new Animated.ValueXY({ x: w, y: h })).current;

  const posRef = useRef({ x, y });
  const sizeRef = useRef({ w, h });
  // PanResponder.create() dipanggil sekali (di dalam useRef), jadi callback
  // di dalamnya akan selalu "melihat" isEditMode dari render PERTAMA kalau
  // dibaca langsung. Makanya nilai terbaru disimpan di ref ini dan diupdate
  // setiap render, supaya closure PanResponder selalu baca versi terkini.
  const isEditModeRef = useRef(isEditMode);
  useEffect(() => {
    isEditModeRef.current = isEditMode;
  }, [isEditMode]);

  useEffect(() => {
    const posId = pan.addListener((v) => (posRef.current = v));
    const sizeId = sizeAnim.addListener(
      (v) => (sizeRef.current = { w: v.x, h: v.y }),
    );
    return () => {
      pan.removeListener(posId);
      sizeAnim.removeListener(sizeId);
    };
  }, [pan, sizeAnim]);

  // --- Drag posisi (badan elemen) ---
  // onStartShouldSetPanResponder cukup dipasang di View yang SAMA dengan
  // pointerEvents="box-only" saat edit mode, sehingga sentuhan langsung
  // ditangani di sini tanpa perlu capture-phase (yang justru bisa bikin
  // gesture "macet" kalau dikombinasikan dengan termination-request block).
  const dragResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isEditModeRef.current,
      onMoveShouldSetPanResponder: (evt, gesture) =>
        isEditModeRef.current &&
        (Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2),
      onPanResponderGrant: () => {
        pan.setOffset({ x: posRef.current.x, y: posRef.current.y });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        pan.flattenOffset();
        onUpdateLayout(id, {
          x: posRef.current.x,
          y: posRef.current.y,
          w: sizeRef.current.w,
          h: sizeRef.current.h,
        });
      },
    }),
  ).current;

  // --- Drag ukuran (handle pojok kanan-bawah) ---
  const resizeResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isEditModeRef.current,
      onMoveShouldSetPanResponder: (evt, gesture) =>
        isEditModeRef.current &&
        (Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2),
      onPanResponderGrant: () => {
        sizeAnim.setOffset({ x: sizeRef.current.w, y: sizeRef.current.h });
        sizeAnim.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: sizeAnim.x, dy: sizeAnim.y }],
        {
          useNativeDriver: false,
        },
      ),
      onPanResponderRelease: () => {
        sizeAnim.flattenOffset();
        // Batasi minimum ukuran
        const finalW = Math.max(minW, sizeRef.current.w);
        const finalH = Math.max(minH, sizeRef.current.h);
        sizeAnim.setValue({ x: finalW, y: finalH });
        sizeRef.current = { w: finalW, h: finalH };
        onUpdateLayout(id, {
          x: posRef.current.x,
          y: posRef.current.y,
          w: finalW,
          h: finalH,
        });
      },
    }),
  ).current;

  return (
    <Animated.View
      style={{
        position: "absolute",
        transform: [{ translateX: pan.x }, { translateY: pan.y }],
        width: sizeAnim.x,
        height: sizeAnim.y,
        borderWidth: isEditMode ? 2 : 0,
        borderColor: "#00e5ff",
        borderStyle: "dashed",
        borderRadius: 8,
      }}
    >
      {/* panHandlers dipasang di View yang sama dengan pointerEvents
          box-only: saat edit mode, View ini yang menerima & memproses
          sentuhan untuk drag, dan tap ke child (tombol dll) diblok
          sehingga tidak bentrok / tidak ke-trigger saat sedang diatur. */}
      <View
        style={{ width: "100%", height: "100%" }}
        pointerEvents={isEditMode ? "box-only" : "auto"}
        {...(isEditMode ? dragResponder.panHandlers : {})}
      >
        {children}
      </View>

      {isEditMode && (
        <Animated.View
          {...resizeResponder.panHandlers}
          style={styles.resizeHandle}
        >
          <Text style={styles.resizeHandleText}>⤡</Text>
        </Animated.View>
      )}
    </Animated.View>
  );
};

// =====================================================================
// Elemen-elemen berikut SEKARANG MURNI VISUAL — tidak ada touch handler
// sendiri (tidak Pressable, tidak PanResponder, tidak onTouchX). Semua
// deteksi sentuhan untuk gameplay (bukan drag-edit) dipusatkan di root
// App lewat MultiTouchLayer, supaya banyak jari bisa dilacak independen
// sekaligus tanpa terjebak "satu responder aktif" dari React Native.
// pressedId dipakai untuk kasih efek visual (opacity berubah) saat
// sedang ditekan oleh sistem multi-touch terpusat.
// =====================================================================
const FaceButton = ({ label, color, pressed }) => (
  <View
    style={[
      styles.faceButton,
      { backgroundColor: color, opacity: pressed ? 0.6 : 1 },
    ]}
  >
    <Text style={styles.faceButtonText}>{label}</Text>
  </View>
);

const R2Button = ({ pressed }) => (
  <View style={[styles.r2Button, { opacity: pressed ? 0.6 : 1 }]}>
    <Text style={styles.r2Text}>R2</Text>
  </View>
);

const GasSlider = ({ percent }) => (
  <View style={styles.pedalContainer}>
    <Text style={styles.pedalLabel}>GAS</Text>
    <View style={styles.pedalTrack}>
      <View style={[styles.pedalFill, { height: `${percent * 100}%` }]} />
    </View>
    <Text style={styles.pedalPercent}>{Math.round(percent * 100)}%</Text>
  </View>
);

const ShiftLight = ({ litDots, totalDots }) => (
  <View style={styles.rpmRow}>
    {Array.from({ length: totalDots }).map((_, i) => {
      // Zona warna dari kiri ke kanan: Hijau -> Biru -> Merah.
      // 3 dot terakhir = merah (redline), sisanya dibagi dua:
      // separuh awal hijau, separuh berikutnya biru.
      const redZoneStart = totalDots - 3;
      const greenZoneEnd = Math.ceil(redZoneStart / 2);

      let color = "#333"; // belum menyala
      if (i < litDots) {
        if (i >= redZoneStart) {
          color = "#3d27fd"; // merah — redline
        } else if (i >= greenZoneEnd) {
          color = "#ff1744"; // biru — zona tengah
        } else {
          color = "#00e676"; // hijau — zona awal
        }
      }

      return (
        <View key={i} style={[styles.rpmDot, { backgroundColor: color }]} />
      );
    })}
  </View>
);

const GearSpeed = ({ gearLabel, speed }) => (
  <View style={styles.telemetryCenter}>
    <Text style={styles.gearText}>{gearLabel}</Text>
    <Text style={styles.speedText}>{speed} KM/H</Text>
  </View>
);

// =====================================================================
// Layout default — semua elemen yang bisa di-drag & resize
// =====================================================================
const DEFAULT_LAYOUT = [
  {
    id: "X",
    type: "button",
    label: "X",
    color: "#29b6f6",
    x: SCREEN_W - 230,
    y: 40,
    w: 65,
    h: 65,
  },
  {
    id: "Y",
    type: "button",
    label: "Y",
    color: "#ffd600",
    x: SCREEN_W - 150,
    y: 220,
    w: 55,
    h: 55,
  },
  {
    id: "A",
    type: "button",
    label: "A",
    color: "#66bb6a",
    x: SCREEN_W - 90,
    y: 90,
    w: 60,
    h: 60,
  },
  {
    id: "B",
    type: "button",
    label: "B",
    color: "#ef5350",
    x: SCREEN_W - 60,
    y: 180,
    w: 60,
    h: 60,
  },
  {
    id: "LB",
    type: "button",
    label: "LB",
    color: "#00e676",
    x: 40,
    y: 150,
    w: 55,
    h: 55,
  },
  {
    id: "RB",
    type: "button",
    label: "RB",
    color: "#00e676",
    x: SCREEN_W - 230,
    y: 150,
    w: 55,
    h: 55,
  },
  { id: "R2", type: "r2", x: -60, y: SCREEN_H - 240, w: 180, h: 180 },
  {
    id: "GAS",
    type: "gas",
    x: SCREEN_W - 100,
    y: SCREEN_H / 2 - 100,
    w: 60,
    h: 180,
  },
  {
    id: "SHIFTLIGHT",
    type: "shiftlight",
    x: SCREEN_W / 2 - 130,
    y: 20,
    w: 260,
    h: 30,
  },
  {
    id: "GEARSPEED",
    type: "gearspeed",
    x: SCREEN_W / 2 - 100,
    y: SCREEN_H / 2 - 100,
    w: 200,
    h: 160,
  },
];

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [gyroEnabled, setGyroEnabled] = useState(false);
  const [gyroInverted, setGyroInverted] = useState(false);

  // FIX #1 (shift light): default maxRpm tetap dipertahankan saat data
  // dari server masuk (server hanya kirim speed/gear/rpm, TANPA maxRpm).
  const [telemetry, setTelemetry] = useState({
    speed: 0,
    gear: 0,
    rpm: 0,
    maxRpm: 13000,
  });
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);

  const inputRef = useRef({
    A: false,
    B: false,
    X: false,
    Y: false,
    LB: false,
    RB: false,
    RT: 0, // Gas
    LT: 0, // Rem / R2
    LX: 0, // Setir kiri-kanan, dari gyro
  });

  const socketRef = useRef(null);
  const gyroSubscription = useRef(null);
  // neutralGamma: sudut "gamma" (roll) HP saat kalibrasi (posisi netral).
  // null berarti belum dikalibrasi.
  const neutralGamma = useRef(null);
  const gyroInvertedRef = useRef(false);

  useEffect(() => {
    gyroInvertedRef.current = gyroInverted;
  }, [gyroInverted]);

  useEffect(() => {
    socketRef.current = io(SERVER_IP, { transports: ["websocket"] });
    socketRef.current.on("connect", () => setIsConnected(true));
    socketRef.current.on("disconnect", () => setIsConnected(false));

    // FIX #1 (shift light): MERGE data baru ke telemetry lama, jangan
    // overwrite total. Server cuma kirim {speed, gear, rpm} — kalau kita
    // pakai setTelemetry(data) langsung, field "maxRpm" hilang jadi
    // undefined dan bikin rpmPercentage = NaN => shift light mati total.
    socketRef.current.on("f1Data", (data) => {
      setTelemetry((prev) => ({ ...prev, ...data }));
    });

    // Getar dari GAME (bukan dari tekan tombol) — dikirim server saat
    // ViGEmClient menerima perintah rumble dari game (misal nabrak/drift).
    // large & small dari server bernilai 0-255.
    let lastVibrationAt = 0;
    socketRef.current.on("vibrationData", ({ large, small }) => {
      const intensity = Math.max(large, small);
      if (intensity <= 5) return; // getar terlalu kecil, abaikan (noise)

      // Batasi frekuensi biar tidak spam Haptics.impactAsync terus-menerus
      // (game bisa kirim event ini sangat sering saat getar berkelanjutan)
      const now = Date.now();
      if (now - lastVibrationAt < 60) return;
      lastVibrationAt = now;

      const style =
        intensity > 170
          ? Haptics.ImpactFeedbackStyle.Heavy
          : intensity > 80
            ? Haptics.ImpactFeedbackStyle.Medium
            : Haptics.ImpactFeedbackStyle.Light;
      Haptics.impactAsync(style);
    });

    // Interval kirim input diturunkan ke 16ms (~60Hz) dari 33ms (~30Hz)
    // untuk latency lebih rendah. Aman dipakai kalau koneksi via USB
    // (adb reverse) karena lebih stabil dibanding WiFi.
    const interval = setInterval(() => {
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit("controllerInput", inputRef.current);
      }
    }, 16);

    return () => {
      clearInterval(interval);
      socketRef.current.disconnect();
    };
  }, []);

  const updateItemLayout = (id, newLayout) => {
    setLayout((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...newLayout } : item)),
    );
  };

  // Gyro sebagai setir (LX) — TILT-BASED memakai DeviceMotion.
  //
  // Berbeda dari versi Gyroscope lama (yang mengintegrasikan kecepatan
  // rotasi dan selalu luntur balik ke 0), versi ini membaca SUDUT
  // KEMIRINGAN ABSOLUT HP (rotation.gamma, dalam radian) relatif ke
  // gravitasi. Artinya: HP ditahan miring di sudut tertentu => input
  // tetap di situ, TIDAK luntur ke 0. Baru kembali ke 0 kalau HP
  // dikembalikan ke posisi persis seperti saat kalibrasi.
  //
  // Kalibrasi netral: dilakukan OTOMATIS setiap kali toggle GYRO
  // dinyalakan — posisi HP saat itu (apapun sudutnya) dijadikan acuan 0°.
  useEffect(() => {
    if (gyroEnabled) {
      neutralGamma.current = null; // reset, akan di-set di sample pertama
      DeviceMotion.setUpdateInterval(33);

      gyroSubscription.current = DeviceMotion.addListener((motion) => {
        if (!motion.rotation) return; // beberapa device butuh 1-2 sample pertama untuk siap
        const { beta } = motion.rotation; // radian, sudut roll (miring kiri-kanan layar tetap menghadap user)

        // Kalibrasi: sample pertama yang valid dijadikan posisi netral (0°).
        if (neutralGamma.current === null) {
          neutralGamma.current = beta;
        }

        const dir = gyroInvertedRef.current ? -1 : 1;

        // Selisih dari posisi netral, dinormalisasi ke rentang -PI..PI
        // (menghindari lompatan nilai kalau beta "wrap around" di ±PI).
        let delta = beta - neutralGamma.current;
        if (delta > Math.PI) delta -= 2 * Math.PI;
        if (delta < -Math.PI) delta += 2 * Math.PI;

        // Deadzone kecil supaya getaran tangan / noise sensor saat HP
        // "dianggap lurus" tidak bikin input goyang-goyang sedikit di 0.
        const DEADZONE_RAD = 0.02; // ~1.1°
        if (Math.abs(delta) < DEADZONE_RAD) delta = 0;

        // Mapping: ±30° dari netral = full lock (LX = ±1.0)
        const MAX_TILT_RAD = (60 * Math.PI) / 180;
        let value = (delta / MAX_TILT_RAD) * dir;
        value = Math.max(-1, Math.min(1, value));

        inputRef.current.LX = value;
      });
    } else {
      if (gyroSubscription.current) {
        gyroSubscription.current.remove();
        gyroSubscription.current = null;
      }
      neutralGamma.current = null;
      inputRef.current.LX = 0;
    }

    return () => {
      if (gyroSubscription.current) {
        gyroSubscription.current.remove();
        gyroSubscription.current = null;
      }
    };
  }, [gyroEnabled]);

  const rpmPercentage = Math.min((telemetry.rpm / telemetry.maxRpm) * 100, 100);
  const totalDots = 15;
  const litDots = Math.round((rpmPercentage / 100) * totalDots);

  // FIX #2 (gear label): mapping F1 game yang benar adalah
  //   -1 => Reverse (R)
  //    0 => Neutral (N)
  //  1..8 => gear 1..8 (TIDAK dikurangi 1)
  // Kode lama salah treat 0 sebagai R dan 1 sebagai N, jadi semua
  // gear "kegeser" satu tingkat lebih rendah dari seharusnya.
  const gearLabel =
    telemetry.gear === -1 ? "R" : telemetry.gear === 0 ? "N" : telemetry.gear;

  // pressedIds: id tombol/elemen yang SEDANG ditekan (untuk efek visual saja)
  const [pressedIds, setPressedIds] = useState({});
  const gasPercentRef = useRef(0);
  const [gasPercent, setGasPercent] = useState(0);

  // Ref ke layout terbaru, supaya handler touch (yang dipasang sekali di
  // JSX tapi dipanggil berkali-kali) selalu baca posisi/ukuran elemen
  // TERKINI, bukan versi lama dari saat komponen pertama render.
  const layoutRef = useRef(layout);
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  const isEditModeRef2 = useRef(isEditMode);
  useEffect(() => {
    isEditModeRef2.current = isEditMode;
  }, [isEditMode]);

  // Melacak jari mana (touch identifier) sedang "menduduki" elemen mana.
  // Map: identifier -> { itemId, type }
  const activeTouches = useRef({});

  // Cari elemen (dari layout) yang berada di koordinat (px, py) — koordinat
  // ini relatif ke root container (pageX/pageY dikurangi offset container,
  // tapi karena container full-screen dari (0,0), pageX/pageY = koordinat
  // layar = koordinat yang sama dipakai layout x/y).
  const hitTest = (px, py) => {
    // Loop terbalik supaya elemen yang dirender belakangan (di atas
    // secara visual) diprioritaskan, sama seperti urutan tumpukan layar.
    const items = layoutRef.current;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it.type === "shiftlight" || it.type === "gearspeed") continue; // bukan kontrol
      if (px >= it.x && px <= it.x + it.w && py >= it.y && py <= it.y + it.h) {
        return it;
      }
    }
    return null;
  };

  const applyPressToItem = (item, active, py) => {
    if (!item) return;
    if (item.type === "button") {
      inputRef.current[item.id] = active;
      setPressedIds((prev) => ({ ...prev, [item.id]: active }));
      if (active) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else if (item.type === "r2") {
      inputRef.current.LT = active ? 1 : 0;
      setPressedIds((prev) => ({ ...prev, [item.id]: active }));
      if (active) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } else if (item.type === "gas") {
      if (active) {
        let value = 1 - (py - item.y) / item.h;
        value = Math.max(0, Math.min(1, value));
        gasPercentRef.current = value;
        setGasPercent(value);
        inputRef.current.RT = value;
      } else {
        gasPercentRef.current = 0;
        setGasPercent(0);
        inputRef.current.RT = 0;
      }
    }
  };

  const handleTouchStart = (evt) => {
    if (isEditModeRef2.current) return; // edit mode dihandle EditableItem sendiri
    const touches = evt.nativeEvent.touches;
    for (const t of touches) {
      if (activeTouches.current[t.identifier]) continue; // sudah dilacak
      const item = hitTest(t.pageX, t.pageY);
      if (item) {
        activeTouches.current[t.identifier] = item.id;
        applyPressToItem(item, true, t.pageY);
      }
    }
  };

  const handleTouchMove = (evt) => {
    if (isEditModeRef2.current) return;
    const touches = evt.nativeEvent.touches;
    for (const t of touches) {
      const itemId = activeTouches.current[t.identifier];
      if (!itemId) continue;
      const item = layoutRef.current.find((it) => it.id === itemId);
      if (item && item.type === "gas") {
        // Update posisi gas mengikuti gerakan jari, meski jari sudah
        // sedikit keluar dari track (biar tidak "lepas" kalau geser cepat)
        applyPressToItem(item, true, t.pageY);
      }
    }
  };

  const releaseTouch = (identifier) => {
    const itemId = activeTouches.current[identifier];
    if (!itemId) return;
    const item = layoutRef.current.find((it) => it.id === itemId);
    applyPressToItem(item, false, 0);
    delete activeTouches.current[identifier];
  };

  const handleTouchEnd = (evt) => {
    // changedTouches berisi jari-jari yang BARU SAJA diangkat
    const changed = evt.nativeEvent.changedTouches;
    for (const t of changed) {
      releaseTouch(t.identifier);
    }
  };

  const renderContent = (item) => {
    switch (item.type) {
      case "button":
        return (
          <FaceButton
            label={item.label}
            color={item.color}
            pressed={!!pressedIds[item.id]}
          />
        );
      case "r2":
        return <R2Button pressed={!!pressedIds[item.id]} />;
      case "gas":
        return <GasSlider percent={gasPercent} />;
      case "shiftlight":
        return <ShiftLight litDots={litDots} totalDots={totalDots} />;
      case "gearspeed":
        return <GearSpeed gearLabel={gearLabel} speed={telemetry.speed} />;
      default:
        return null;
    }
  };

  return (
    <View
      style={styles.container}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <Text style={styles.statusText}>
        {isConnected ? "🟢 Terhubung" : "🔴 Terputus"}
      </Text>

      {/* Toggle Gyro + Invert */}
      <View style={styles.gyroPanel}>
        <View style={styles.gyroRow}>
          <Text style={styles.gyroLabel}>GYRO</Text>
          <Switch
            value={gyroEnabled}
            onValueChange={setGyroEnabled}
            trackColor={{ false: "#333", true: "#00e676" }}
            thumbColor="#fff"
          />
        </View>
        <View style={styles.gyroRow}>
          <Text style={styles.gyroLabel}>INVERT</Text>
          <Switch
            value={gyroInverted}
            onValueChange={setGyroInverted}
            trackColor={{ false: "#333", true: "#ff9800" }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Semua elemen dirender lewat EditableItem supaya bisa di-drag + resize bareng */}
      {layout.map((item) => (
        <EditableItem
          key={item.id}
          id={item.id}
          x={item.x}
          y={item.y}
          w={item.w}
          h={item.h}
          minW={item.type === "button" ? 40 : item.type === "gas" ? 40 : 60}
          minH={item.type === "button" ? 40 : item.type === "gas" ? 100 : 30}
          isEditMode={isEditMode}
          onUpdateLayout={updateItemLayout}
        >
          {renderContent(item)}
        </EditableItem>
      ))}

      {/* Tombol Edit Layout */}
      <TouchableOpacity
        style={[
          styles.editBtn,
          { backgroundColor: isEditMode ? "#ff9800" : "#424242" },
        ]}
        onPress={() => setIsEditMode(!isEditMode)}
      >
        <Text style={styles.editBtnText}>
          {isEditMode ? "Simpan Layout" : "Edit Layout"}
        </Text>
      </TouchableOpacity>

      {isEditMode && (
        <Text style={styles.editHint}>
          Geser badan elemen untuk pindah posisi. Geser ikon ⤡ di pojok untuk
          ubah ukuran.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0d0d" },
  statusText: {
    position: "absolute",
    top: 10,
    right: 10,
    color: "#fff",
    fontSize: 12,
    zIndex: 30,
  },
  gyroPanel: {
    position: "absolute",
    top: 30,
    right: 10,
    zIndex: 30,
  },
  gyroRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  gyroLabel: {
    color: "#aaa",
    fontSize: 10,
    fontWeight: "bold",
    marginRight: 6,
    width: 46,
  },

  // Elemen-elemen isi (tanpa position: absolute — posisinya diatur EditableItem)
  faceButton: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 999,
    elevation: 5,
  },
  faceButtonText: { color: "#000", fontWeight: "bold", fontSize: 16 },

  r2Button: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: "#1b1b1b",
    justifyContent: "center",
    alignItems: "center",
  },
  r2Text: { color: "#666", fontWeight: "bold", fontSize: 20 },

  pedalContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  pedalLabel: {
    color: "#aaa",
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 4,
  },
  pedalTrack: {
    flex: 1,
    width: 40,
    backgroundColor: "#222",
    borderRadius: 10,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  pedalFill: { width: "100%", backgroundColor: "#00e676" },
  pedalPercent: { color: "#fff", fontSize: 12, marginTop: 4 },

  rpmRow: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  rpmDot: { width: 14, height: 14, borderRadius: 3 },

  telemetryCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  gearText: {
    fontSize: 90,
    fontWeight: "900",
    color: "#ff9800",
    lineHeight: 90,
  },
  speedText: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#00ffcc",
    marginTop: 2,
  },

  resizeHandle: {
    position: "absolute",
    right: -14,
    bottom: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#00e5ff",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 40,
  },
  resizeHandleText: { color: "#000", fontWeight: "bold", fontSize: 14 },

  editBtn: {
    position: "absolute",
    top: 10,
    left: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    zIndex: 30,
  },
  editBtnText: { color: "#fff", fontWeight: "bold" },

  editHint: {
    position: "absolute",
    bottom: 10,
    left: 10,
    right: 10,
    textAlign: "center",
    color: "#aaa",
    fontSize: 11,
  },
});
