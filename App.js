import * as Haptics from "expo-haptics";
import { DeviceMotion } from "expo-sensors";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  useWindowDimensions,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  Modal,
} from "react-native";
import { io } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COLORS, FONT_MONO } from "./src/theme";
import {
  MIN_SIZE,
  buildCatalog,
  buildInitialLayout,
} from "./src/constants/catalog";
import {
  IconSettings,
  IconCheck,
  IconEdit,
} from "./src/components/icons/Icons";
import MfdDash from "./src/components/MfdDash";
import TopShiftBar from "./src/components/TopShiftBar";
import EditableItem from "./src/components/EditableItem";
import PitBoxItem from "./src/components/PitBoxItem";
import {
  FaceButton,
  R2Button,
  GasSlider,
  PaddleShift,
  DrsIndicator,
  FlagIndicator,
} from "./src/components/controls";
import F1SteeringButton from "./src/components/F1SteeringButton";

// ---------------------------------------------------------------------------
// Help Modal Component (Panduan F1 Pitwall)
// ---------------------------------------------------------------------------
function HelpModal({ visible, onClose }) {
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.helpOverlay}>
        <View style={styles.helpContainer}>
          <Text style={styles.helpTitle}>Panduan Koneksi 🏁</Text>

          <ScrollView style={styles.helpScrollArea}>
            {/* --- METODE 2: USB (Disarankan) --- */}
            <Text style={styles.methodTitle}>Metode USB (Disarankan) 🚀</Text>

            <View style={styles.stepContainer}>
              <Text style={styles.stepNumber}>1</Text>
              <Text style={styles.stepText}>
                Aktifkan <Text style={styles.boldText}>USB Debugging</Text> pada
                Opsi Pengembang (Developer Options) di HP Anda.
              </Text>
            </View>

            <View style={styles.stepContainer}>
              <Text style={styles.stepNumber}>2</Text>
              <Text style={styles.stepText}>
                Hubungkan HP ke PC menggunakan{" "}
                <Text style={styles.boldText}>kabel data</Text>.
              </Text>
            </View>

            <View style={styles.stepContainer}>
              <Text style={styles.stepNumber}>3</Text>
              <Text style={styles.stepText}>
                Klik tombol <Text style={styles.boldText}>USB</Text> pada navbar
                di aplikasi F1 Pitwall PC. Tunggu hingga notifikasi ADB aktif.
              </Text>
            </View>

            <View style={styles.stepContainer}>
              <Text style={styles.stepNumber}>4</Text>
              <Text style={styles.stepText}>
                Pada aplikasi HP ini, isi kolom IP dengan{" "}
                <Text style={styles.codeText}>127.0.0.1</Text>, lalu tap
                Connect.
              </Text>
            </View>

            <View style={styles.divider} />

            {/* --- METODE 1: WIFI --- */}
            <Text style={styles.methodTitle}>Metode WiFi 📶</Text>

            <View style={styles.stepContainer}>
              <Text style={styles.stepNumber}>1</Text>
              <Text style={styles.stepText}>
                Pastikan PC dan HP terhubung di{" "}
                <Text style={styles.boldText}>jaringan WiFi yang sama</Text>.
              </Text>
            </View>

            <View style={styles.stepContainer}>
              <Text style={styles.stepNumber}>2</Text>
              <Text style={styles.stepText}>
                Buka F1 Pitwall di PC, pastikan tombol indikator di navbar
                menunjukkan <Text style={styles.boldText}>WiFi</Text>.
              </Text>
            </View>

            <View style={styles.stepContainer}>
              <Text style={styles.stepNumber}>3</Text>
              <Text style={styles.stepText}>
                Masukkan <Text style={styles.boldText}>IP Server</Text> yang
                tertera pada navbar aplikasi PC ke pengaturan aplikasi ini, lalu
                tap Connect.
              </Text>
            </View>

            <View style={styles.stepContainer}>
              <Text style={styles.stepNumber}>!</Text>
              <Text style={styles.stepText}>
                <Text style={{ fontStyle: "italic", color: "#aaa" }}>
                  Troubleshoot: Jika gagal, pastikan Port 3000 tidak terblokir
                  oleh Windows Defender Firewall.
                </Text>
              </Text>
            </View>
          </ScrollView>

          <TouchableOpacity style={styles.helpCloseBtn} onPress={onClose}>
            <Text style={styles.helpCloseBtnText}>Tutup Panduan</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------
export default function App() {
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();
  const [serverIp, setServerIp] = useState("127.0.0.1:3000");
  const [isConnected, setIsConnected] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [gyroEnabled, setGyroEnabled] = useState(false);
  const [gyroInverted, setGyroInverted] = useState(false);

  const [telemetry, setTelemetry] = useState({
    speed: 0,
    gear: 0,
    rpm: 0,
    maxRpm: 13000,
    drs: 0,
    tyreTemp: [0, 0, 0, 0],
    ersEnergy: 0,
    delta: 0,
    lastLapMs: 0,
  });
  const [flagState, setFlagState] = useState({ active: "NONE", ts: 0 });
  const [layout, setLayout] = useState([]);
  const [pressedIds, setPressedIds] = useState({});
  const [gasPercent, setGasPercent] = useState(0);

  const [dataToggles, setDataToggles] = useState({
    mfd: true,
    ers: true,
    tyres: true,
    flags: true,
    delta: true,
  });
  const dataTogglesRef = useRef(dataToggles);
  useEffect(() => {
    dataTogglesRef.current = dataToggles;
  }, [dataToggles]);

  const TOGGLES_KEY = "@f1_data_toggles";
  useEffect(() => {
    AsyncStorage.getItem(TOGGLES_KEY).then((raw) => {
      if (raw) setDataToggles(JSON.parse(raw));
    });
  }, []);
  useEffect(() => {
    AsyncStorage.setItem(TOGGLES_KEY, JSON.stringify(dataToggles));
  }, [dataToggles]);

  const inputRef = useRef({
    A: false,
    B: false,
    X: false,
    Y: false,
    LB: false,
    RB: false,
    START: false,
    SELECT: false,
    L3: false,
    R3: false,
    RT: 0,
    LT: 0,
    LX: 0,
  });

  const socketRef = useRef(null);
  const gyroSubscription = useRef(null);
  const gyroInvertedRef = useRef(false);
  const layoutRef = useRef(layout);
  const isEditModeRef = useRef(isEditMode);
  const showSettingsRef = useRef(showSettings);
  const activeTouches = useRef({});
  const gasPercentRef = useRef(0);
  const LAYOUT_KEY = "@f1_mfd_layout";
  const [showLibrary, setShowLibrary] = useState(true);

  // --- AUTOMATIC LOAD & SAVE LAYOUT DARI ASYNC STORAGE ---
  useEffect(() => {
    const initLayout = async () => {
      if (SCREEN_W === 0) return;
      try {
        const savedLayout = await AsyncStorage.getItem(LAYOUT_KEY);
        if (savedLayout !== null) setLayout(JSON.parse(savedLayout));
        else setLayout(buildInitialLayout(SCREEN_W, SCREEN_H));
      } catch (e) {
        console.error("Gagal load layout:", e);
        setLayout(buildInitialLayout(SCREEN_W, SCREEN_H));
      }
    };
    if (layout.length === 0) initLayout();
  }, [SCREEN_W, SCREEN_H]);

  useEffect(() => {
    gyroInvertedRef.current = gyroInverted;
  }, [gyroInverted]);

  useEffect(() => {
    layoutRef.current = layout;
    const saveLayoutToLocal = async () => {
      if (layout.length > 0) {
        try {
          await AsyncStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
        } catch (e) {
          console.error("Gagal save layout:", e);
        }
      }
    };
    saveLayoutToLocal();
  }, [layout]);

  useEffect(() => {
    isEditModeRef.current = isEditMode;
  }, [isEditMode]);
  useEffect(() => {
    showSettingsRef.current = showSettings;
  }, [showSettings]);

  const catalog = useMemo(
    () => (SCREEN_W > 0 ? buildCatalog() : []),
    [SCREEN_W],
  );
  const availableInPitBox = catalog.filter(
    (c) => !layout.some((l) => l.id === c.id),
  );

  // --- SOCKET.IO CONNECT ---
  const connect = () => {
    if (socketRef.current) socketRef.current.disconnect();
    const url = serverIp.startsWith("http") ? serverIp : `http://${serverIp}`;
    const socket = io(url, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));

    socket.on("telemetry", (data) => {
      const t = dataTogglesRef.current;
      const filtered = { ...data };
      if (!t.tyres) delete filtered.tyreTemp;
      setTelemetry((prev) => ({ ...prev, ...filtered }));
    });

    socket.on("cek-ping", (waktuDariServer) => {
      if (socket.connected) socket.emit("pantulan-ping", waktuDariServer);
    });

    socket.on("telemetry-status", (data) => {
      if (!dataTogglesRef.current.ers) return;
      setTelemetry((prev) => ({ ...prev, ...data }));
    });

    socket.on("my-status", (me) => {
      if (!me) return;
      const t = dataTogglesRef.current;
      setTelemetry((prev) => ({
        ...prev,
        lastLapMs: me.lastLapMs || prev.lastLapMs,
        delta: t.delta ? (me.intervalS != null ? me.intervalS : 0) : prev.delta,
        lapNum: me.lapNum,
      }));
    });

    socket.on("session-info", (data) => {
      setTelemetry((prev) => ({ ...prev, sessionTime: data.timeLeft }));
    });

    socket.on("flags", (data) => {
      if (!dataTogglesRef.current.flags) return;
      const present = new Set((data.zones || []).map((z) => z.flag));
      if (data.ownCarFlag && data.ownCarFlag !== "NONE")
        present.add(data.ownCarFlag);
      const yellowCount = (data.zones || []).filter(
        (z) => z.flag === "YELLOW",
      ).length;

      let activeFlag = "NONE";
      if (present.has("RED") || data.trackStatus === "RED") activeFlag = "RED";
      else if (yellowCount >= 2) activeFlag = "DOUBLE_YELLOW";
      else if (
        present.has("YELLOW") ||
        data.trackStatus === "SAFETY CAR" ||
        data.trackStatus === "VIRTUAL SC"
      )
        activeFlag = "YELLOW";
      else if (present.has("BLUE")) activeFlag = "BLUE";
      else if (present.has("GREEN")) activeFlag = "GREEN";

      setFlagState({ active: activeFlag, ts: Date.now() });
    });
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (socketRef.current?.connected)
        socketRef.current.volatile.emit("controllerInput", inputRef.current);
    }, 16);
    return () => {
      clearInterval(interval);
      socketRef.current?.disconnect();
    };
  }, []);

  // --- GYRO ---
  useEffect(() => {
    if (!gyroEnabled) {
      gyroSubscription.current?.remove();
      gyroSubscription.current = null;
      inputRef.current.LX = 0;
      return;
    }
    DeviceMotion.setUpdateInterval(16);

    gyroSubscription.current = DeviceMotion.addListener((motion) => {
      if (!motion.rotation) return;
      let { beta, gamma } = motion.rotation;

      if (Math.abs(gamma) > 1.5) {
        if (beta > 0) beta = Math.PI - beta;
        else beta = -Math.PI - beta;
      }
      const dir = gyroInvertedRef.current ? -1 : 1;
      let setir = (beta / 1.0) * dir;
      inputRef.current.LX = Math.max(-1, Math.min(1, setir));
    });
    return () => {
      gyroSubscription.current?.remove();
      gyroSubscription.current = null;
    };
  }, [gyroEnabled]);

  // --- LAYOUT METHODS ---
  const updateItemLayout = (id, newLayout) =>
    setLayout((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...newLayout } : item)),
    );
  const removeItem = (id) =>
    setLayout((prev) => prev.filter((item) => item.id !== id));
  const addItemFromCatalog = (catalogItem, dropX, dropY) => {
    setLayout((prev) => {
      if (prev.some((i) => i.id === catalogItem.id)) return prev;
      return [
        ...prev,
        {
          ...catalogItem,
          x: Math.max(0, dropX - catalogItem.w / 2),
          y: Math.max(0, dropY - catalogItem.h / 2),
        },
      ];
    });
  };

  const gearLabel =
    telemetry.gear === -1 ? "R" : telemetry.gear === 0 ? "N" : telemetry.gear;
  const rpmPercentage = Math.min((telemetry.rpm / telemetry.maxRpm) * 100, 100);

  let topLitDots = 0;
  if (rpmPercentage >= 75) {
    const fillRatio = Math.min(1, (rpmPercentage - 75) / 15);
    topLitDots = Math.round(fillRatio * 15);
  }

  // --- TOUCH HANDLING ---
  const hitTest = (px, py) => {
    const items = layoutRef.current;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it.type === "mfd" || it.type === "drs") continue;
      if (px >= it.x && px <= it.x + it.w && py >= it.y && py <= it.y + it.h)
        return it;
    }
    return null;
  };

  const applyPressToItem = (item, active, py) => {
    if (!item) return;
    if (
      item.type === "button" ||
      item.type === "paddle" ||
      item.type === "macro"
    ) {
      inputRef.current[item.id] = active;
      setPressedIds((prev) => ({ ...prev, [item.id]: active }));
      if (active) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else if (item.type === "r2") {
      inputRef.current.LT = active ? 1 : 0;
      setPressedIds((prev) => ({ ...prev, [item.id]: active }));
    } else if (item.type === "gas") {
      const value = active
        ? Math.max(0, Math.min(1, 1 - (py - item.y) / item.h))
        : 0;
      gasPercentRef.current = value;
      setGasPercent(value);
      inputRef.current.RT = value;
    }
  };

  const handleTouchStart = (evt) => {
    if (isEditModeRef.current || showSettingsRef.current) return;
    for (const t of evt.nativeEvent.touches) {
      if (activeTouches.current[t.identifier]) continue;
      const item = hitTest(t.pageX, t.pageY);
      if (item) {
        activeTouches.current[t.identifier] = item.id;
        applyPressToItem(item, true, t.pageY);
      }
    }
  };

  const handleTouchMove = (evt) => {
    if (isEditModeRef.current || showSettingsRef.current) return;
    for (const t of evt.nativeEvent.touches) {
      const itemId = activeTouches.current[t.identifier];
      if (!itemId) continue;
      const item = layoutRef.current.find((it) => it.id === itemId);
      if (item?.type === "gas") applyPressToItem(item, true, t.pageY);
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
    for (const t of evt.nativeEvent.changedTouches) releaseTouch(t.identifier);
  };

  const renderContent = (item) => {
    switch (item.type) {
      case "macro":
        return (
          <F1SteeringButton
            label={item.label}
            color={item.color}
            size={Math.min(item.w, item.h)}
            pressed={!!pressedIds[item.id]}
          />
        );
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
      case "paddle":
        return (
          <PaddleShift
            label={item.label}
            side={item.side}
            pressed={!!pressedIds[item.id]}
          />
        );
      case "mfd":
        if (!dataToggles.mfd) return null;
        return (
          <MfdDash
            telemetry={telemetry}
            gearLabel={gearLabel}
            showDelta={dataToggles.delta}
          />
        );
      case "drs":
        return <DrsIndicator active={telemetry.drs === 1} />;
      case "flag":
        return (
          <FlagIndicator flag={dataToggles.flags ? flagState.active : "NONE"} />
        );
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
      <StatusBar hidden />
      <TopShiftBar litDots={topLitDots} />

      {isEditMode && (
        <View style={styles.editDimOverlay} pointerEvents="none" />
      )}

      {layout.map((item) => {
        const minBounds = MIN_SIZE[item.type] ?? MIN_SIZE.default;
        return (
          <EditableItem
            key={item.id}
            {...item}
            minW={minBounds.w}
            minH={minBounds.h}
            isEditMode={isEditMode}
            onUpdateLayout={updateItemLayout}
            onDelete={removeItem}
          >
            {renderContent(item)}
          </EditableItem>
        );
      })}

      {/* Floating Button */}
      {!showSettings && (
        <View style={styles.floatingMenu}>
          {isEditMode ? (
            <TouchableOpacity
              style={[styles.floatingBtn, { backgroundColor: COLORS.green }]}
              onPress={() => setIsEditMode(false)}
            >
              <IconCheck color="#000" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.floatingBtn}
              onPress={() => setShowSettings(true)}
            >
              <IconSettings />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Panel Pit Box (Library) */}
      {isEditMode &&
        (showLibrary ? (
          <View style={styles.libraryContainer}>
            <View style={styles.libraryHeader}>
              <Text style={styles.libraryTitle}>LIBRARY BUTTON</Text>
              <TouchableOpacity onPress={() => setShowLibrary(false)}>
                <Text style={styles.libraryToggleText}>▼ Tutup</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={true}
              contentContainerStyle={styles.libraryScroll}
            >
              {availableInPitBox.length === 0 ? (
                <Text style={styles.libraryEmpty}>Semua tombol terpakai</Text>
              ) : (
                availableInPitBox.map((item) => (
                  <PitBoxItem
                    key={item.id}
                    item={item}
                    screenHeight={SCREEN_H}
                    onDropAdd={addItemFromCatalog}
                  />
                ))
              )}
            </ScrollView>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.openLibraryPill}
            onPress={() => setShowLibrary(true)}
          >
            <Text style={styles.openLibraryPillText}>➕ BUKA LIBRARY</Text>
          </TouchableOpacity>
        ))}

      {/* Panel Pengaturan PC & Gyro */}
      {showSettings && (
        <View style={styles.settingsOverlay}>
          <View style={styles.settingsBox}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.settingsContent}
            >
              <Text style={styles.settingsTitle}>Pengaturan Aplikasi</Text>

              <View style={styles.connectRow}>
                <TextInput
                  style={styles.ipInput}
                  value={serverIp}
                  onChangeText={setServerIp}
                  placeholder="IP:PORT PC"
                  placeholderTextColor={COLORS.textDim}
                  editable={!isConnected}
                />
                <TouchableOpacity style={styles.connectBtn} onPress={connect}>
                  <Text style={styles.connectBtnText}>
                    {isConnected ? "Reconnect" : "Connect"}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.statusText}>
                {isConnected ? "🟢 Connected to PC Server" : "🔴 Disconnected"}
              </Text>

              <View style={styles.gyroBox}>
                <Text style={[styles.gyroLabel, { marginBottom: 4 }]}>
                  Sensor Steering (Gyro)
                </Text>
                <View style={styles.gyroRow}>
                  <Text style={styles.gyroLabel}>AKTIFKAN GYRO</Text>
                  <Switch
                    value={gyroEnabled}
                    onValueChange={setGyroEnabled}
                    trackColor={{ false: COLORS.line, true: COLORS.green }}
                    thumbColor="#fff"
                  />
                </View>
                {gyroEnabled && (
                  <View style={styles.gyroRow}>
                    <Text style={styles.gyroLabel}>INVERT KIRI/KANAN</Text>
                    <Switch
                      value={gyroInverted}
                      onValueChange={setGyroInverted}
                      trackColor={{ false: COLORS.line, true: COLORS.cyan }}
                      thumbColor="#fff"
                    />
                  </View>
                )}
              </View>

              <View style={styles.gyroBox}>
                <Text style={[styles.gyroLabel, { marginBottom: 4 }]}>
                  Data yang Diterima
                </Text>
                {Object.keys(dataToggles).map((key) => (
                  <View style={styles.gyroRow} key={key}>
                    <Text style={styles.gyroLabel}>{key.toUpperCase()}</Text>
                    <Switch
                      value={dataToggles[key]}
                      onValueChange={(v) =>
                        setDataToggles((prev) => ({ ...prev, [key]: v }))
                      }
                      trackColor={{ false: COLORS.line, true: COLORS.green }}
                      thumbColor="#fff"
                    />
                  </View>
                ))}
              </View>

              {/* Tombol Help Modal */}
              <TouchableOpacity
                style={styles.helpMenuBtn}
                onPress={() => setShowHelp(true)}
              >
                <Text style={styles.helpMenuText}>❓ Panduan Koneksi</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.editLayoutModalBtn}
                onPress={() => {
                  setShowSettings(false);
                  setIsEditMode(true);
                }}
              >
                <IconEdit color={COLORS.cyan} size={18} />
                <Text style={styles.editLayoutModalText}>
                  Ubah Tata Letak (Edit Layout)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.closeSettingsBtn}
                onPress={() => setShowSettings(false)}
              >
                <Text style={styles.closeSettingsText}>Tutup</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      )}

      {/* Render Modal Help */}
      <HelpModal visible={showHelp} onClose={() => setShowHelp(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  editDimOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    zIndex: 5,
  },
  floatingMenu: {
    position: "absolute",
    top: 25,
    right: 20,
    flexDirection: "row",
    gap: 12,
    zIndex: 999,
  },
  floatingBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(30,30,30,0.8)",
    borderWidth: 1,
    borderColor: COLORS.line,
    justifyContent: "center",
    alignItems: "center",
  },
  settingsOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  settingsBox: {
    backgroundColor: COLORS.panel,
    borderRadius: 10,
    width: "90%",
    maxWidth: 400,
    maxHeight: "90%",
    borderWidth: 1,
    borderColor: COLORS.line,
    overflow: "hidden",
  },
  settingsContent: { padding: 20, gap: 16 },
  settingsTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontFamily: FONT_MONO,
    textAlign: "center",
    marginBottom: 4,
  },
  connectRow: { flexDirection: "row", gap: 10 },
  ipInput: {
    flex: 1,
    backgroundColor: COLORS.bg,
    color: COLORS.text,
    fontFamily: FONT_MONO,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  connectBtn: {
    backgroundColor: COLORS.cyan,
    paddingHorizontal: 16,
    justifyContent: "center",
    borderRadius: 4,
  },
  connectBtnText: { color: "#000", fontWeight: "bold", fontFamily: FONT_MONO },
  statusText: {
    color: COLORS.textDim,
    fontFamily: FONT_MONO,
    textAlign: "center",
    fontSize: 12,
    marginTop: -8,
  },
  gyroBox: {
    backgroundColor: COLORS.panel2,
    padding: 12,
    borderRadius: 6,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.lineSoft,
  },
  gyroRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  gyroLabel: { color: COLORS.text, fontFamily: FONT_MONO, fontSize: 13 },
  helpMenuBtn: {
    backgroundColor: "rgba(255, 215, 0, 0.15)",
    borderWidth: 1,
    borderColor: "#FFD700",
    padding: 14,
    borderRadius: 6,
    alignItems: "center",
    marginTop: 4,
  },
  helpMenuText: {
    color: "#FFD700",
    fontFamily: FONT_MONO,
    fontWeight: "bold",
  },
  editLayoutModalBtn: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(0,229,255,0.15)",
    borderWidth: 1,
    borderColor: COLORS.cyan,
    padding: 14,
    borderRadius: 6,
    alignItems: "center",
  },
  editLayoutModalText: {
    color: COLORS.cyan,
    fontFamily: FONT_MONO,
    fontWeight: "bold",
  },
  closeSettingsBtn: {
    backgroundColor: COLORS.line,
    padding: 12,
    borderRadius: 6,
    alignItems: "center",
  },
  closeSettingsText: {
    color: COLORS.text,
    fontFamily: FONT_MONO,
    fontWeight: "bold",
  },
  libraryContainer: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    height: 130,
    backgroundColor: "rgba(15,15,15,0.95)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cyan,
    padding: 8,
    paddingBottom: 15,
    zIndex: 150,
    overflow: "hidden",
  },
  openLibraryPill: {
    position: "absolute",
    bottom: 30,
    alignSelf: "center",
    backgroundColor: "rgba(0,229,255,0.15)",
    borderWidth: 1,
    borderColor: COLORS.cyan,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    zIndex: 150,
  },
  openLibraryPillText: {
    color: COLORS.cyan,
    fontFamily: FONT_MONO,
    fontWeight: "bold",
    fontSize: 12,
  },
  libraryTitle: {
    color: COLORS.cyan,
    fontFamily: FONT_MONO,
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 6,
    marginLeft: 4,
  },
  libraryScroll: {
    alignItems: "center",
    paddingHorizontal: 5,
    paddingBottom: 20,
    gap: 12,
  },
  libraryEmpty: {
    color: COLORS.textDim,
    fontFamily: FONT_MONO,
    fontSize: 12,
    fontStyle: "italic",
    alignSelf: "center",
    marginLeft: 10,
  },
  libraryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  libraryToggleText: {
    color: COLORS.cyan,
    fontFamily: FONT_MONO,
    fontSize: 10,
    fontWeight: "bold",
  },

  /* --- Styles untuk Modal Panduan --- */
  helpOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2000,
  },
  helpContainer: {
    width: "85%",
    maxHeight: "85%",
    backgroundColor: COLORS.panel,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  helpTitle: {
    fontSize: 20,
    fontFamily: FONT_MONO,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 15,
    textAlign: "center",
  },
  methodTitle: {
    color: "#FFD700",
    fontFamily: FONT_MONO,
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    marginTop: 5,
  },
  helpScrollArea: {
    marginBottom: 15,
  },
  stepContainer: {
    flexDirection: "row",
    marginBottom: 12,
    alignItems: "flex-start",
  },
  stepNumber: {
    backgroundColor: "#E10600",
    color: "#FFF",
    width: 24,
    height: 24,
    borderRadius: 12,
    textAlign: "center",
    lineHeight: 24,
    fontWeight: "bold",
    marginRight: 10,
    marginTop: 0,
    fontFamily: FONT_MONO,
  },
  stepText: {
    color: "#CCCCCC",
    fontSize: 14,
    flex: 1,
    lineHeight: 22,
  },
  boldText: {
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  codeText: {
    fontFamily: "monospace",
    backgroundColor: "#333",
    color: "#FFD700",
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.line,
    marginVertical: 15,
  },
  helpCloseBtn: {
    backgroundColor: COLORS.line,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  helpCloseBtnText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 16,
    fontFamily: FONT_MONO,
  },
});
