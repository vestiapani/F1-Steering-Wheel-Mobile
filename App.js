import * as Haptics from "expo-haptics";
import { DeviceMotion } from "expo-sensors";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  useWindowDimensions,
  PanResponder,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { io } from "socket.io-client";

// ---------------------------------------------------------------------------
// Hook Drag & Resize
// ---------------------------------------------------------------------------
function useDragResizeResponders({
  id,
  pan,
  sizeAnim,
  posRef,
  sizeRef,
  isEditModeRef,
  minW,
  minH,
  onUpdateLayout,
}) {
  const shouldSet = () => isEditModeRef.current;

  const dragResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: shouldSet,
      onStartShouldSetPanResponderCapture: shouldSet,
      onMoveShouldSetPanResponder: shouldSet,
      onMoveShouldSetPanResponderCapture: shouldSet,
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

  const resizeResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: shouldSet,
      onStartShouldSetPanResponderCapture: shouldSet,
      onMoveShouldSetPanResponder: shouldSet,
      onMoveShouldSetPanResponderCapture: shouldSet,
      onPanResponderGrant: () => {
        sizeAnim.setOffset({ x: sizeRef.current.w, y: sizeRef.current.h });
        sizeAnim.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: sizeAnim.x, dy: sizeAnim.y }],
        { useNativeDriver: false },
      ),
      onPanResponderRelease: () => {
        sizeAnim.flattenOffset();
        const w = Math.max(minW, sizeRef.current.w);
        const h = Math.max(minH, sizeRef.current.h);
        sizeAnim.setValue({ x: w, y: h });
        sizeRef.current = { w, h };
        onUpdateLayout(id, { x: posRef.current.x, y: posRef.current.y, w, h });
      },
    }),
  ).current;

  return { dragResponder, resizeResponder };
}

function EditableItem({
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
}) {
  const pan = useRef(new Animated.ValueXY({ x, y })).current;
  const sizeAnim = useRef(new Animated.ValueXY({ x: w, y: h })).current;
  const posRef = useRef({ x, y });
  const sizeRef = useRef({ w, h });
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

  const { dragResponder, resizeResponder } = useDragResizeResponders({
    id,
    pan,
    sizeAnim,
    posRef,
    sizeRef,
    isEditModeRef,
    minW,
    minH,
    onUpdateLayout,
  });

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
        zIndex: isEditMode ? 100 : 10,
      }}
    >
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
}

// ---------------------------------------------------------------------------
// Komponen Visual Murni
// ---------------------------------------------------------------------------
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

const ShiftLight = ({ litDots, totalDots }) => {
  const [blink, setBlink] = useState(true);

  useEffect(() => {
    // Interval kedipan 75ms (sangat cepat, khas mobil balap)
    const interval = setInterval(() => setBlink((b) => !b), 75);
    return () => clearInterval(interval);
  }, []);

  // Trigger kedip saat nyala 13 lampu atau lebih (mendekati ujung merah / masuk biru)
  const isRedlining = litDots >= 13;
  // Jika sedang redline, lampu akan nyala/mati mengikuti state blink
  const showLights = !isRedlining || blink;

  return (
    <View style={styles.rpmRow}>
      {Array.from({ length: totalDots }).map((_, i) => {
        let color = "#333"; // Warna dasar (mati)

        if (i < litDots) {
          if (i >= 12)
            color = "#3d27fd"; // Biru
          else if (i >= 7)
            color = "#ff1744"; // Merah
          else color = "#00e676"; // Hijau
        }

        // Kalau lagi redlining dan masuk fase kedip "mati", kembalikan warnanya ke #333
        const finalColor = showLights ? color : "#333";

        return (
          <View
            key={i}
            style={[styles.rpmDot, { backgroundColor: finalColor }]}
          />
        );
      })}
    </View>
  );
};

// --- KOMPONEN BARU UNTUK F1 TELEMETRY ---

const DrsIndicator = ({ active }) => (
  <View style={[styles.drsBox, active && styles.drsActive]}>
    <Text style={[styles.drsText, active && styles.drsTextActive]}>DRS</Text>
  </View>
);

// Desain Baru: F1 Car Top-Down Tyres Widget
const TyresWidget = ({ temps }) => {
  const fl = temps[2] || 0;
  const fr = temps[3] || 0;
  const rl = temps[0] || 0;
  const rr = temps[1] || 0;

  const getColor = (temp) => {
    if (temp < 85) return "#29b6f6";
    if (temp <= 105) return "#00e676";
    return "#ff1744";
  };

  return (
    <View style={styles.f1CarContainer}>
      <View style={styles.tempCol}>
        <Text style={styles.tyreTempText}>{Math.round(fl)}°</Text>
        <Text style={[styles.tyreTempText, { marginTop: 32 }]}>
          {Math.round(rl)}°
        </Text>
      </View>

      <View style={styles.carGraphicBody}>
        <View style={styles.carNose} />
        <View style={styles.carCockpit} />
        <View
          style={[
            styles.tire,
            styles.tireFL,
            { backgroundColor: getColor(fl) },
          ]}
        />
        <View
          style={[
            styles.tire,
            styles.tireFR,
            { backgroundColor: getColor(fr) },
          ]}
        />
        <View
          style={[
            styles.tire,
            styles.tireRL,
            { backgroundColor: getColor(rl) },
          ]}
        />
        <View
          style={[
            styles.tire,
            styles.tireRR,
            { backgroundColor: getColor(rr) },
          ]}
        />
      </View>

      <View style={styles.tempColRight}>
        <Text style={styles.tyreTempText}>{Math.round(fr)}°</Text>
        <Text style={[styles.tyreTempText, { marginTop: 32 }]}>
          {Math.round(rr)}°
        </Text>
      </View>
    </View>
  );
};

const DashWidget = ({ ersMode, ersEnergy, fuel, delta }) => {
  const ersModes = ["NONE", "MED", "HOTLAP", "OVERTAKE"];
  const ersPct =
    Math.min(100, Math.max(0, Math.round((ersEnergy / 4000000) * 100))) || 0;

  let deltaColor = "#fff";
  if (delta < 0) deltaColor = "#00e676";
  else if (delta > 0) deltaColor = "#ff1744";
  const deltaSec = delta ? parseFloat(delta).toFixed(3) : "0.000";
  const deltaPrefix = delta > 0 ? "+" : "";

  return (
    <View style={styles.dashContainer}>
      <View style={styles.dashRow}>
        <Text style={styles.dashLabel}>ERS: </Text>
        <Text style={{ color: "#ffd600", fontSize: 11, fontWeight: "bold" }}>
          {ersModes[ersMode] || "NONE"} ({ersPct}%)
        </Text>
      </View>
      <View style={styles.dashRow}>
        <Text style={styles.dashLabel}>FUEL: </Text>
        <Text style={{ color: "#fff", fontSize: 11, fontWeight: "bold" }}>
          {(fuel || 0).toFixed(1)} KG
        </Text>
      </View>
      <View style={styles.dashRow}>
        <Text style={styles.dashLabel}>DELTA: </Text>
        <Text style={{ color: deltaColor, fontSize: 11, fontWeight: "bold" }}>
          {deltaPrefix}
          {deltaSec}
        </Text>
      </View>
    </View>
  );
};

// --- MFD (Multi Function Display) ala setir F1 asli ---

function fmtMfdMs(ms) {
  if (!ms) return "--:--.---";
  const m = Math.floor(ms / 60000);
  const s = ((ms % 60000) / 1000).toFixed(3).padStart(6, "0");
  return `${m}:${s}`;
}

const MFD_SEGMENTS = 16;

function MfdShiftBar({ rpm, maxRpm }) {
  const pct = Math.min(100, ((rpm || 0) / (maxRpm || 1)) * 100);
  const lit = Math.round((pct / 100) * MFD_SEGMENTS);
  return (
    <View style={styles.mfdShiftBar}>
      {Array.from({ length: MFD_SEGMENTS }).map((_, i) => {
        let color = "#161616";
        if (i < lit) {
          if (i < 5) color = "#29b6f6";
          else if (i < 11) color = "#00e676";
          else if (i < 14) color = "#ff1744";
          else color = "#c86dfd";
        }
        return (
          <View
            key={i}
            style={[styles.mfdShiftDot, { backgroundColor: color }]}
          />
        );
      })}
    </View>
  );
}

function MfdCell({ label, value, valueColor = "#fff", size = 14 }) {
  return (
    <View style={styles.mfdCell}>
      {label ? <Text style={styles.mfdCellLabel}>{label}</Text> : null}
      <Text
        style={[styles.mfdCellValue, { color: valueColor, fontSize: size }]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const MFDWidget = ({ telemetry, gearLabel }) => {
  const deltaVal = telemetry.delta != null ? parseFloat(telemetry.delta) : null;
  const deltaColor =
    deltaVal == null
      ? "#9a9a9a"
      : deltaVal < 0
        ? "#00e676"
        : deltaVal > 0
          ? "#ff1744"
          : "#9a9a9a";
  const deltaStr =
    deltaVal == null ? "—" : `${deltaVal > 0 ? "+" : ""}${deltaVal.toFixed(2)}`;
  const ersPct = Math.min(
    100,
    Math.max(0, Math.round(((telemetry.ersEnergy || 0) / 4000000) * 100)),
  );

  return (
    <View style={styles.mfdContainer}>
      <MfdShiftBar rpm={telemetry.rpm} maxRpm={telemetry.maxRpm} />

      <View style={styles.mfdGridRow}>
        <MfdCell
          label="LAP"
          value={fmtMfdMs(telemetry.lastLapMs)}
          valueColor="#00e676"
          size={12}
        />
        <MfdCell
          label="RPM"
          value={Math.round(telemetry.rpm || 0)}
          valueColor="#ff1744"
          size={15}
        />
        <MfdCell
          label="DELTA"
          value={deltaStr}
          valueColor={deltaColor}
          size={15}
        />
      </View>

      <View style={styles.mfdGridRowMain}>
        <MfdCell
          label="SPEED"
          value={Math.round(telemetry.speed || 0)}
          size={22}
        />
        <View style={styles.mfdGearBox}>
          <Text style={styles.mfdGearLabel}>GEAR</Text>
          <Text style={styles.mfdGearText}>{gearLabel}</Text>
        </View>
        <MfdCell
          label="BBAL"
          value={
            telemetry.brakeBias
              ? `${telemetry.brakeBias}/${100 - telemetry.brakeBias}`
              : "—"
          }
          size={12}
        />
      </View>

      <View style={styles.mfdGridRow}>
        <MfdCell
          label="SOC"
          value={`${ersPct}`}
          valueColor="#00e676"
          size={16}
        />
        <MfdCell
          label="FUEL"
          value={telemetry.fuel != null ? telemetry.fuel.toFixed(1) : "—"}
          size={13}
        />
        <View style={styles.mfdCell}>
          <View style={styles.mfdStrategyIcon} />
        </View>
      </View>

      <View style={styles.mfdBottomStrip}>
        {Array.from({ length: 14 }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.mfdStripSeg,
              { backgroundColor: i % 4 === 0 ? "#c86dfd" : "#5cff5c" },
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const PaddleShift = ({ label, pressed, side }) => (
  <View
    style={[
      styles.paddleShift,
      side === "left" ? styles.paddleLeft : styles.paddleRight,
      { opacity: pressed ? 0.55 : 1 },
    ]}
  >
    <Text style={styles.paddleShiftText}>{label}</Text>
  </View>
);

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------

const MIN_SIZE = {
  button: { w: 40, h: 40 },
  gas: { w: 40, h: 100 },
  shiftlight: { w: 180, h: 20 },
  mfd: { w: 240, h: 210 },
  paddle: { w: 90, h: 46 },
  drs: { w: 60, h: 40 },
  tyres: { w: 140, h: 100 }, // Diperbesar untuk menampung desain mobil baru
  dash: { w: 140, h: 70 },
  default: { w: 60, h: 30 },
};

export default function App() {
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();
  const [serverIp, setServerIp] = useState("127.0.0.1:3000");
  const [isConnected, setIsConnected] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [gyroEnabled, setGyroEnabled] = useState(false);
  const [gyroInverted, setGyroInverted] = useState(false);

  const [telemetry, setTelemetry] = useState({
    speed: 0,
    gear: 0,
    rpm: 0,
    maxRpm: 13000,
    drs: 0,
    tyreTemp: [0, 0, 0, 0],
    ersMode: 0,
    ersEnergy: 0,
    fuel: 0,
    delta: 0,
    lastLapMs: 0,
    brakeBias: 0,
  });

  const [layout, setLayout] = useState([]);
  const [pressedIds, setPressedIds] = useState({});
  const [gasPercent, setGasPercent] = useState(0);

  const inputRef = useRef({
    A: false,
    B: false,
    X: false,
    Y: false,
    LB: false,
    RB: false,
    RT: 0,
    LT: 0,
    LX: 0,
  });
  const socketRef = useRef(null);
  const gyroSubscription = useRef(null);
  const neutralGamma = useRef(null);
  const gyroInvertedRef = useRef(false);
  const layoutRef = useRef(layout);
  const isEditModeRef = useRef(isEditMode);
  const showSettingsRef = useRef(showSettings);
  const activeTouches = useRef({});
  const gasPercentRef = useRef(0);

  useEffect(() => {
    if (layout.length === 0 && SCREEN_W > 0) {
      setLayout([
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
          type: "paddle",
          label: "－",
          side: "left",
          x: 20,
          y: 20,
          w: 100,
          h: 50,
        },
        {
          id: "RB",
          type: "paddle",
          label: "＋",
          side: "right",
          x: SCREEN_W - 120,
          y: 20,
          w: 100,
          h: 50,
        },
        { id: "R2", type: "r2", x: 40, y: SCREEN_H - 220, w: 180, h: 180 },
        {
          id: "GAS",
          type: "gas",
          x: SCREEN_W - 100,
          y: SCREEN_H / 2 - 100,
          w: 60,
          h: 180,
        },
        {
          id: "MFD",
          type: "mfd",
          x: SCREEN_W / 2 - 140,
          y: SCREEN_H / 2 - 110,
          w: 280,
          h: 220,
        },
        { id: "DRS", type: "drs", x: SCREEN_W / 2 + 140, y: 20, w: 70, h: 40 },
        {
          id: "TYRES",
          type: "tyres",
          x: SCREEN_W / 2 + 120,
          y: 70,
          w: 140,
          h: 110,
        },
        {
          id: "DASH",
          type: "dash",
          x: SCREEN_W / 2 - 250,
          y: 20,
          w: 150,
          h: 70,
        },
      ]);
    }
  }, [SCREEN_W, SCREEN_H]);

  useEffect(() => {
    gyroInvertedRef.current = gyroInverted;
  }, [gyroInverted]);
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);
  useEffect(() => {
    isEditModeRef.current = isEditMode;
  }, [isEditMode]);
  useEffect(() => {
    showSettingsRef.current = showSettings;
  }, [showSettings]);

  const connect = () => {
    if (socketRef.current) socketRef.current.disconnect();

    const url = serverIp.startsWith("http") ? serverIp : `http://${serverIp}`;
    const socket = io(url, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));

    socket.on("f1Data", (data) =>
      setTelemetry((prev) => ({ ...prev, ...data })),
    );

    let lastVibrationAt = 0;
    socket.on("vibrationData", ({ large, small }) => {
      const intensity = Math.max(large, small);
      if (intensity <= 5) return;
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
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (socketRef.current?.connected) {
        socketRef.current.volatile.emit("controllerInput", inputRef.current);
      }
    }, 33);

    return () => {
      clearInterval(interval);
      socketRef.current?.disconnect();
    };
  }, []);

  const updateItemLayout = (id, newLayout) => {
    setLayout((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...newLayout } : item)),
    );
  };

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
      const { beta } = motion.rotation;

      const dir = gyroInvertedRef.current ? -1 : 1;
      const MAX_TILT = 0.8;

      inputRef.current.LX = Math.max(-1, Math.min(1, (beta / MAX_TILT) * dir));
    });

    return () => {
      gyroSubscription.current?.remove();
      gyroSubscription.current = null;
    };
  }, [gyroEnabled]);

  const rpmPercentage = Math.min((telemetry.rpm / telemetry.maxRpm) * 100, 100);
  const totalDots = 15;
  const litDots = Math.round((rpmPercentage / 100) * totalDots);
  const gearLabel =
    telemetry.gear === -1 ? "R" : telemetry.gear === 0 ? "N" : telemetry.gear;

  const hitTest = (px, py) => {
    const items = layoutRef.current;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (
        it.type === "shiftlight" ||
        it.type === "mfd" ||
        it.type === "drs" ||
        it.type === "tyres" ||
        it.type === "dash"
      )
        continue;
      if (px >= it.x && px <= it.x + it.w && py >= it.y && py <= it.y + it.h)
        return it;
    }
    return null;
  };

  const applyPressToItem = (item, active, py) => {
    if (!item) return;
    if (item.type === "button" || item.type === "paddle") {
      inputRef.current[item.id] = active;
      setPressedIds((prev) => ({ ...prev, [item.id]: active }));
      // Getar hanya untuk face button & paddle shift
      if (active) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else if (item.type === "r2") {
      inputRef.current.LT = active ? 1 : 0;
      setPressedIds((prev) => ({ ...prev, [item.id]: active }));
      // Getar dimatikan di trigger agar CPU gak lag
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
      case "mfd":
        return <MFDWidget telemetry={telemetry} gearLabel={gearLabel} />;
      case "paddle":
        return (
          <PaddleShift
            label={item.label}
            side={item.side}
            pressed={!!pressedIds[item.id]}
          />
        );
      case "drs":
        return <DrsIndicator active={telemetry.drs === 1} />;
      case "tyres":
        return <TyresWidget temps={telemetry.tyreTemp} />;
      case "dash":
        return (
          <DashWidget
            ersMode={telemetry.ersMode}
            ersEnergy={telemetry.ersEnergy}
            fuel={telemetry.fuel}
            delta={telemetry.delta}
          />
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

      {layout.map((item) => (
        <EditableItem
          key={item.id}
          {...item}
          {...(MIN_SIZE[item.type] ?? MIN_SIZE.default)}
          isEditMode={isEditMode}
          onUpdateLayout={updateItemLayout}
        >
          {renderContent(item)}
        </EditableItem>
      ))}

      {showSettings && (
        <View style={styles.settingsOverlay}>
          <View style={styles.settingsBox}>
            <Text style={styles.settingsTitle}>
              Pengaturan Koneksi & Sensor
            </Text>

            <View style={styles.connectRow}>
              <TextInput
                style={styles.ipInput}
                value={serverIp}
                onChangeText={setServerIp}
                placeholder="IP:PORT laptop, mis. 127.0.0.1:3000"
                placeholderTextColor="#777"
                editable={!isConnected}
              />
              <TouchableOpacity style={styles.connectBtn} onPress={connect}>
                <Text style={styles.connectBtnText}>
                  {isConnected ? "Reconnect" : "Connect"}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.statusText}>
              Status: {isConnected ? "🟢 Terhubung ke PC" : "🔴 Terputus"}
            </Text>

            <View style={styles.gyroBox}>
              <View style={styles.gyroRow}>
                <Text style={styles.gyroLabel}>Aktifkan Gyro (Setir)</Text>
                <Switch
                  value={gyroEnabled}
                  onValueChange={setGyroEnabled}
                  trackColor={{ false: "#333", true: "#00e676" }}
                  thumbColor="#fff"
                />
              </View>
              <View style={styles.gyroRow}>
                <Text style={styles.gyroLabel}>Invert Gyro (Kiri/Kanan)</Text>
                <Switch
                  value={gyroInverted}
                  onValueChange={setGyroInverted}
                  trackColor={{ false: "#333", true: "#ff9800" }}
                  thumbColor="#fff"
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.closeSettingsBtn}
              onPress={() => setShowSettings(false)}
            >
              <Text style={styles.closeSettingsText}>Tutup Pengaturan</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.bottomMenu}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => {
            setShowSettings(true);
            setIsEditMode(false);
          }}
        >
          <Text style={styles.actionBtnText}>⚙️ Pengaturan</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionBtn,
            { backgroundColor: isEditMode ? "#ff9800" : "#424242" },
          ]}
          onPress={() => {
            setIsEditMode(!isEditMode);
            setShowSettings(false);
          }}
        >
          <Text style={styles.actionBtnText}>
            {isEditMode ? "💾 Simpan Layout" : "✏️ Edit Layout"}
          </Text>
        </TouchableOpacity>
      </View>

      {isEditMode && (
        <Text style={styles.editHint}>
          Mode Edit Aktif: Geser elemen untuk memindah posisi. Geser ujung ⤡
          untuk ubah ukuran.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0d0d" },
  settingsOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 200,
  },
  settingsBox: {
    backgroundColor: "#1b1b1b",
    padding: 24,
    borderRadius: 16,
    width: 400,
    maxWidth: "90%",
    gap: 16,
    borderWidth: 1,
    borderColor: "#333",
  },
  settingsTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  connectRow: { flexDirection: "row", gap: 10 },
  ipInput: {
    flex: 1,
    backgroundColor: "#0d0d0d",
    color: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#444",
  },
  connectBtn: {
    backgroundColor: "#00e676",
    paddingHorizontal: 20,
    justifyContent: "center",
    borderRadius: 8,
  },
  connectBtnText: { color: "#000", fontWeight: "bold", fontSize: 14 },
  statusText: { color: "#aaa", fontSize: 13, textAlign: "center" },
  gyroBox: { backgroundColor: "#222", padding: 12, borderRadius: 8, gap: 12 },
  gyroRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  gyroLabel: { color: "#fff", fontSize: 14 },
  closeSettingsBtn: {
    backgroundColor: "#424242",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  closeSettingsText: { color: "#fff", fontWeight: "bold" },
  bottomMenu: {
    position: "absolute",
    bottom: 15,
    left: 15,
    flexDirection: "row",
    gap: 12,
    zIndex: 150,
  },
  actionBtn: {
    backgroundColor: "#424242",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#555",
  },
  actionBtnText: { color: "#fff", fontWeight: "bold", fontSize: 13 },
  editHint: {
    position: "absolute",
    bottom: 15,
    right: 15,
    color: "#ff9800",
    fontSize: 12,
    fontWeight: "bold",
    zIndex: 100,
  },
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

  drsBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1b1b1b",
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#333",
  },
  drsActive: {
    backgroundColor: "#00e676",
    borderColor: "#00e676",
    elevation: 10,
  },
  drsText: { color: "#555", fontWeight: "900", fontSize: 20 },
  drsTextActive: { color: "#000" },

  dashContainer: {
    flex: 1,
    backgroundColor: "#1b1b1b",
    borderRadius: 8,
    padding: 8,
    justifyContent: "space-evenly",
  },
  dashRow: { flexDirection: "row", alignItems: "center" },
  dashLabel: { color: "#aaa", fontSize: 11, fontWeight: "bold" },

  resizeHandle: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 34,
    height: 34,
    backgroundColor: "#00e5ff",
    borderTopLeftRadius: 16,
    borderBottomRightRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 40,
  },
  resizeHandleText: { color: "#000", fontWeight: "bold", fontSize: 16 },

  // --- STYLING BARU UNTUK GRAFIK MOBIL F1 & BAN ---
  f1CarContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1b1b1b",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#333",
    paddingHorizontal: 10,
  },
  tempCol: {
    alignItems: "flex-end",
    paddingRight: 10,
    justifyContent: "center",
  },
  tempColRight: {
    alignItems: "flex-start",
    paddingLeft: 10,
    justifyContent: "center",
  },
  tyreTempText: { color: "#fff", fontSize: 12, fontWeight: "bold" },
  carGraphicBody: {
    width: 28,
    height: 80,
    borderColor: "#555",
    borderWidth: 2,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  carNose: {
    position: "absolute",
    top: -8,
    width: 16,
    height: 12,
    backgroundColor: "#555",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  carCockpit: {
    width: 14,
    height: 20,
    backgroundColor: "#222",
    borderRadius: 4,
  },
  tire: {
    width: 10,
    height: 22,
    borderRadius: 3,
    position: "absolute",
    borderWidth: 1,
    borderColor: "#000",
  },
  tireFL: { left: -14, top: 8 },
  tireFR: { right: -14, top: 8 },
  tireRL: { left: -14, bottom: 8 },
  tireRR: { right: -14, bottom: 8 },

  // --- STYLING BARU UNTUK MFD & PADDLE SHIFT ---
  mfdContainer: {
    flex: 1,
    backgroundColor: "#050505",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    padding: 6,
    justifyContent: "space-between",
  },
  mfdShiftBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    height: 10,
    marginBottom: 5,
  },
  mfdShiftDot: { flex: 1, marginHorizontal: 1, borderRadius: 2 },
  mfdGridRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderColor: "#1c1c1c",
    paddingVertical: 3,
  },
  mfdGridRowMain: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderColor: "#1c1c1c",
    paddingVertical: 4,
  },
  mfdCell: { flex: 1, alignItems: "center" },
  mfdCellLabel: {
    color: "#666",
    fontSize: 8,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  mfdCellValue: { fontWeight: "800" },
  mfdGearBox: { flex: 1, alignItems: "center" },
  mfdGearLabel: { color: "#666", fontSize: 8, fontWeight: "bold" },
  mfdGearText: {
    color: "#fff",
    fontSize: 46,
    fontWeight: "900",
    includeFontPadding: false,
  },
  mfdStrategyIcon: {
    width: 14,
    height: 14,
    borderWidth: 1.5,
    borderColor: "#888",
    transform: [{ rotate: "45deg" }],
  },
  mfdBottomStrip: {
    flexDirection: "row",
    height: 6,
    marginTop: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  mfdStripSeg: { flex: 1 },
  paddleShift: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: "#1b1b1b",
    borderWidth: 2,
    borderColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },
  paddleLeft: { transform: [{ skewX: "-8deg" }] },
  paddleRight: { transform: [{ skewX: "8deg" }] },
  paddleShiftText: { color: "#00e5ff", fontSize: 22, fontWeight: "900" },
});
