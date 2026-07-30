import * as Haptics from "expo-haptics";
import { DeviceMotion } from "expo-sensors";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Platform,
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
// Tema Dashboard "Pitwall Mobile" — matte black, aksen neon ala setir F1
// ---------------------------------------------------------------------------
const COLORS = {
  bg: "#050505",
  panel: "#0d0d0d",
  panel2: "#141414",
  line: "#232323",
  lineSoft: "#1a1a1a",
  text: "#e6e6e6",
  textDim: "#6b6b6b",
  green: "#17e88f",
  yellow: "#f5d90a",
  red: "#ff2b4d",
  amber: "#ffb020",
  cyan: "#00e5ff",
  blue: "#3d7bfd",
  purple: "#b34dff",
};

const FONT_MONO = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});

function fmtMs(ms) {
  if (!ms) return "—:—.—";
  const m = Math.floor(ms / 60000);
  const s = ((ms % 60000) / 1000).toFixed(3).padStart(6, "0");
  return `${m}:${s}`;
}

// ---------------------------------------------------------------------------
// Hook Drag & Resize (tidak berubah dari logika aslinya)
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
  onDelete,
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
        borderColor: COLORS.cyan,
        borderStyle: "dashed",
        borderRadius: 8,
        zIndex: isEditMode ? 100 : 10,
      }}
    >
      <View
        style={{
          width: "100%",
          height: "100%",
          opacity: isEditMode ? 0.7 : 1,
        }}
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
      {isEditMode && (
        <TouchableOpacity
          style={styles.deleteHandle}
          onPress={() => onDelete(id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.deleteHandleText}>×</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Komponen Visual — kontrol tepi (SVG-style, presisi, subtle saat idle)
// ---------------------------------------------------------------------------
const FaceButton = ({ label, color, pressed }) => (
  <View
    style={[
      styles.faceButton,
      pressed && { backgroundColor: color, borderColor: color },
    ]}
  >
    <Text style={[styles.faceButtonText, pressed && { color: "#000" }]}>
      {label}
    </Text>
  </View>
);

const R2Button = ({ pressed }) => (
  <View style={[styles.r2Button, pressed && styles.r2ButtonActive]}>
    <Text style={[styles.r2Text, pressed && { color: COLORS.bg }]}>R2</Text>
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

const PaddleShift = ({ label, pressed, side }) => (
  <View
    style={[
      styles.paddleShift,
      side === "left" ? styles.paddleLeft : styles.paddleRight,
      pressed && styles.paddleShiftActive,
    ]}
  >
    <Text style={[styles.paddleShiftText, pressed && { color: COLORS.bg }]}>
      {label}
    </Text>
  </View>
);

const DrsIndicator = ({ active }) => (
  <View style={[styles.drsBox, active && styles.drsActive]}>
    <Text style={[styles.drsText, active && styles.drsTextActive]}>DRS</Text>
  </View>
);

// ---------------------------------------------------------------------------
// TOP SHIFT BAR — deretan LED persis di bibir atas layar, kedip saat redline
// ---------------------------------------------------------------------------
const TOP_SEGMENTS = 22;

const TopShiftBar = ({ litDots }) => {
  const [blink, setBlink] = useState(true);

  useEffect(() => {
    const iv = setInterval(() => setBlink((b) => !b), 75);
    return () => clearInterval(iv);
  }, []);

  const isRedlining = litDots >= TOP_SEGMENTS - 3;
  const showLights = !isRedlining || blink;

  return (
    <View style={styles.topShiftBar} pointerEvents="none">
      {Array.from({ length: TOP_SEGMENTS }).map((_, i) => {
        let color = "#141414";
        if (i < litDots) {
          if (i >= TOP_SEGMENTS - 3) color = COLORS.blue;
          else if (i >= TOP_SEGMENTS * 0.6) color = COLORS.red;
          else color = COLORS.green;
        }
        const finalColor = showLights ? color : "#141414";
        return (
          <View
            key={i}
            style={[styles.topShiftSeg, { backgroundColor: finalColor }]}
          />
        );
      })}
    </View>
  );
};

// ---------------------------------------------------------------------------
// CENTER DASH — jantung MFD: gear (kiri) · siluet F1 + 4 ban (tengah) · speed (kanan)
// ---------------------------------------------------------------------------
const tyreTempColor = (t) => {
  if (!t) return "#1a1f28";
  if (t < 85) return COLORS.cyan;
  if (t <= 105) return COLORS.green;
  return COLORS.red;
};

const CenterDash = ({ telemetry, gearLabel }) => {
  const temps = telemetry.tyreTemp || [0, 0, 0, 0];
  const fl = temps[2] || 0;
  const fr = temps[3] || 0;
  const rl = temps[0] || 0;
  const rr = temps[1] || 0;

  const deltaVal = telemetry.delta != null ? parseFloat(telemetry.delta) : null;
  const deltaColor =
    deltaVal == null
      ? COLORS.textDim
      : deltaVal < 0
        ? COLORS.green
        : deltaVal > 0
          ? COLORS.red
          : COLORS.textDim;
  const deltaStr =
    deltaVal == null ? "—" : `${deltaVal > 0 ? "+" : ""}${deltaVal.toFixed(2)}`;
  const ersPct = Math.min(
    100,
    Math.max(0, Math.round(((telemetry.ersEnergy || 0) / 4000000) * 100)),
  );

  return (
    <View style={styles.centerDash}>
      <View style={styles.centerDashMain}>
        <View style={styles.gearSpeedCol}>
          <Text style={styles.dashMiniLabel}>GEAR</Text>
          <Text style={styles.gearBig}>{gearLabel}</Text>
        </View>

        <View style={styles.carSilhouetteWrap}>
          <View
            style={[
              styles.tireCorner,
              styles.tireFL,
              { backgroundColor: tyreTempColor(fl) },
            ]}
          />
          <View
            style={[
              styles.tireCorner,
              styles.tireFR,
              { backgroundColor: tyreTempColor(fr) },
            ]}
          />
          <View style={styles.carBody}>
            <View style={styles.carNoseShape} />
            <View style={styles.carCockpitShape} />
          </View>
          <View
            style={[
              styles.tireCorner,
              styles.tireRL,
              { backgroundColor: tyreTempColor(rl) },
            ]}
          />
          <View
            style={[
              styles.tireCorner,
              styles.tireRR,
              { backgroundColor: tyreTempColor(rr) },
            ]}
          />
        </View>

        <View style={styles.gearSpeedCol}>
          <Text style={styles.dashMiniLabel}>KM/H</Text>
          <Text style={styles.speedBig}>
            {Math.round(telemetry.speed || 0)}
          </Text>
        </View>
      </View>

      <View style={styles.centerDashStats}>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>LAP</Text>
          <Text style={[styles.statVal, { color: COLORS.green }]}>
            {fmtMs(telemetry.lastLapMs)}
          </Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>DELTA</Text>
          <Text style={[styles.statVal, { color: deltaColor }]}>
            {deltaStr}
          </Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>SOC</Text>
          <Text style={[styles.statVal, { color: COLORS.cyan }]}>
            {ersPct}%
          </Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>FUEL</Text>
          <Text style={styles.statVal}>{(telemetry.fuel || 0).toFixed(1)}</Text>
        </View>
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// PIT BOX — laci komponen yang belum terpakai, drag ke kanvas untuk pasang
// ---------------------------------------------------------------------------
const PIT_BOX_HEIGHT = 128;

function PitBoxItem({ item, screenHeight, onDropAdd }) {
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const scale = useRef(new Animated.Value(1)).current;

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        Animated.spring(scale, {
          toValue: 1.18,
          useNativeDriver: false,
        }).start();
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (evt, gesture) => {
        Animated.spring(scale, { toValue: 1, useNativeDriver: false }).start();
        const droppedAbovePitBox =
          gesture.moveY < screenHeight - PIT_BOX_HEIGHT;
        if (droppedAbovePitBox && gesture.moveY > 0) {
          onDropAdd(item, gesture.moveX, gesture.moveY);
        }
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
        }).start();
      },
    }),
  ).current;

  return (
    <Animated.View
      {...responder.panHandlers}
      style={[
        styles.pitBoxItem,
        {
          transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale }],
        },
      ]}
    >
      <Text style={styles.pitBoxItemText}>{item.label}</Text>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Katalog default semua komponen yang bisa berada di kanvas
// ---------------------------------------------------------------------------
const MIN_SIZE = {
  button: { w: 40, h: 40 },
  gas: { w: 40, h: 100 },
  centerdash: { w: 220, h: 150 },
  paddle: { w: 90, h: 46 },
  drs: { w: 60, h: 40 },
  default: { w: 60, h: 30 },
};

function buildDefaultItems(SCREEN_W, SCREEN_H) {
  return [
    {
      id: "X",
      type: "button",
      label: "X",
      color: COLORS.cyan,
      x: SCREEN_W - 230,
      y: 40,
      w: 65,
      h: 65,
    },
    {
      id: "Y",
      type: "button",
      label: "Y",
      color: COLORS.yellow,
      x: SCREEN_W - 150,
      y: 220,
      w: 55,
      h: 55,
    },
    {
      id: "A",
      type: "button",
      label: "A",
      color: COLORS.green,
      x: SCREEN_W - 90,
      y: 90,
      w: 60,
      h: 60,
    },
    {
      id: "B",
      type: "button",
      label: "B",
      color: COLORS.red,
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
      y: 26,
      w: 100,
      h: 50,
    },
    {
      id: "RB",
      type: "paddle",
      label: "＋",
      side: "right",
      x: SCREEN_W - 120,
      y: 26,
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
      id: "DASH",
      type: "centerdash",
      label: "MFD",
      x: SCREEN_W / 2 - 150,
      y: SCREEN_H / 2 - 100,
      w: 300,
      h: 190,
    },
    {
      id: "DRS",
      type: "drs",
      label: "DRS",
      x: SCREEN_W / 2 + 160,
      y: 30,
      w: 70,
      h: 40,
    },
  ];
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
      setLayout(buildDefaultItems(SCREEN_W, SCREEN_H));
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

  // Katalog referensi lengkap (posisi default) untuk mengisi Pit Box
  const catalog = useMemo(
    () => (SCREEN_W > 0 ? buildDefaultItems(SCREEN_W, SCREEN_H) : []),
    [SCREEN_W, SCREEN_H],
  );
  const availableInPitBox = catalog.filter(
    (c) => !layout.some((l) => l.id === c.id),
  );

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

  const removeItem = (id) => {
    setLayout((prev) => prev.filter((item) => item.id !== id));
  };

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
  const topLitDots = Math.round((rpmPercentage / 100) * TOP_SEGMENTS);
  const gearLabel =
    telemetry.gear === -1 ? "R" : telemetry.gear === 0 ? "N" : telemetry.gear;

  const hitTest = (px, py) => {
    const items = layoutRef.current;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it.type === "centerdash" || it.type === "drs") continue;
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
      case "drs":
        return <DrsIndicator active={telemetry.drs === 1} />;
      case "centerdash":
        return <CenterDash telemetry={telemetry} gearLabel={gearLabel} />;
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

      {layout.map((item) => (
        <EditableItem
          key={item.id}
          {...item}
          {...(MIN_SIZE[item.type] ?? MIN_SIZE.default)}
          isEditMode={isEditMode}
          onUpdateLayout={updateItemLayout}
          onDelete={removeItem}
        >
          {renderContent(item)}
        </EditableItem>
      ))}

      {showSettings && (
        <View style={styles.settingsOverlay}>
          <View style={styles.settingsBox}>
            <Text style={styles.settingsTitle}>
              Pengaturan Koneksi &amp; Sensor
            </Text>

            <View style={styles.connectRow}>
              <TextInput
                style={styles.ipInput}
                value={serverIp}
                onChangeText={setServerIp}
                placeholder="IP:PORT laptop, mis. 127.0.0.1:3000"
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
              Status: {isConnected ? "🟢 Terhubung ke PC" : "🔴 Terputus"}
            </Text>

            <View style={styles.gyroBox}>
              <View style={styles.gyroRow}>
                <Text style={styles.gyroLabel}>Aktifkan Gyro (Setir)</Text>
                <Switch
                  value={gyroEnabled}
                  onValueChange={setGyroEnabled}
                  trackColor={{ false: COLORS.line, true: COLORS.green }}
                  thumbColor="#fff"
                />
              </View>
              <View style={styles.gyroRow}>
                <Text style={styles.gyroLabel}>Invert Gyro (Kiri/Kanan)</Text>
                <Switch
                  value={gyroInverted}
                  onValueChange={setGyroInverted}
                  trackColor={{ false: COLORS.line, true: COLORS.amber }}
                  thumbColor="#fff"
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.editLayoutBtn}
              onPress={() => {
                setShowSettings(false);
                setIsEditMode(true);
              }}
            >
              <Text style={styles.editLayoutBtnText}>✏️ Ubah Layout</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeSettingsBtn}
              onPress={() => setShowSettings(false)}
            >
              <Text style={styles.closeSettingsText}>Tutup Pengaturan</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!isEditMode && !showSettings && (
        <View style={styles.bottomMenu}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setShowSettings(true)}
          >
            <Text style={styles.actionBtnText}>⚙️ Pengaturan</Text>
          </TouchableOpacity>
        </View>
      )}

      {isEditMode && (
        <>
          <View style={styles.bottomMenu}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnDone]}
              onPress={() => setIsEditMode(false)}
            >
              <Text style={styles.actionBtnText}>✓ Selesai Edit</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.editHint}>
            Geser komponen untuk memindah. Tarik ⤡ untuk ubah ukuran. Tekan ×
            untuk melepas ke Pit Box.
          </Text>

          <View style={styles.pitBox}>
            <Text style={styles.pitBoxTitle}>PIT BOX</Text>
            <View style={styles.pitBoxRow}>
              {availableInPitBox.length === 0 ? (
                <Text style={styles.pitBoxEmpty}>Semua komponen aktif</Text>
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
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  // ---- top shift bar ----
  topShiftBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 14,
    flexDirection: "row",
    gap: 2,
    paddingHorizontal: 2,
    zIndex: 300,
    backgroundColor: "#000",
  },
  topShiftSeg: { flex: 1, marginVertical: 2, borderRadius: 1 },

  editDimOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    zIndex: 5,
  },

  // ---- settings ----
  settingsOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.82)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 200,
  },
  settingsBox: {
    backgroundColor: COLORS.panel,
    padding: 24,
    borderRadius: 10,
    width: 400,
    maxWidth: "90%",
    gap: 16,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  settingsTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "bold",
    fontFamily: FONT_MONO,
    textAlign: "center",
    letterSpacing: 1,
    marginBottom: 8,
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
    fontSize: 13,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  connectBtn: {
    backgroundColor: COLORS.green,
    paddingHorizontal: 20,
    justifyContent: "center",
    borderRadius: 4,
  },
  connectBtnText: {
    color: "#000",
    fontWeight: "bold",
    fontFamily: FONT_MONO,
    fontSize: 13,
  },
  statusText: {
    color: COLORS.textDim,
    fontFamily: FONT_MONO,
    fontSize: 12,
    textAlign: "center",
  },
  gyroBox: {
    backgroundColor: COLORS.panel2,
    padding: 12,
    borderRadius: 4,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.lineSoft,
  },
  gyroRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  gyroLabel: { color: COLORS.text, fontFamily: FONT_MONO, fontSize: 13 },
  editLayoutBtn: {
    backgroundColor: "rgba(0,229,255,0.12)",
    borderWidth: 1,
    borderColor: COLORS.cyan,
    padding: 12,
    borderRadius: 4,
    alignItems: "center",
  },
  editLayoutBtnText: {
    color: COLORS.cyan,
    fontWeight: "bold",
    fontFamily: FONT_MONO,
    letterSpacing: 0.5,
  },
  closeSettingsBtn: {
    backgroundColor: COLORS.panel2,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 12,
    borderRadius: 4,
    alignItems: "center",
  },
  closeSettingsText: {
    color: COLORS.text,
    fontWeight: "bold",
    fontFamily: FONT_MONO,
  },

  // ---- bottom menu ----
  bottomMenu: {
    position: "absolute",
    bottom: 15,
    left: 15,
    flexDirection: "row",
    gap: 12,
    zIndex: 150,
  },
  actionBtn: {
    backgroundColor: COLORS.panel2,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  actionBtnDone: {
    borderColor: COLORS.green,
    backgroundColor: "rgba(23,232,143,0.12)",
  },
  actionBtnText: {
    color: COLORS.text,
    fontWeight: "bold",
    fontFamily: FONT_MONO,
    fontSize: 12,
  },
  editHint: {
    position: "absolute",
    bottom: 15,
    right: 15,
    maxWidth: 220,
    color: COLORS.amber,
    fontFamily: FONT_MONO,
    fontSize: 10,
    fontWeight: "bold",
    zIndex: 150,
    textAlign: "right",
  },

  // ---- resize / delete handles ----
  resizeHandle: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 34,
    height: 34,
    backgroundColor: COLORS.cyan,
    borderTopLeftRadius: 16,
    borderBottomRightRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 40,
  },
  resizeHandleText: { color: "#000", fontWeight: "bold", fontSize: 16 },
  deleteHandle: {
    position: "absolute",
    left: -10,
    top: -10,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.red,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 41,
    borderWidth: 2,
    borderColor: COLORS.bg,
  },
  deleteHandleText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
    lineHeight: 16,
    marginTop: -1,
  },

  // ---- face buttons / paddles / triggers ----
  faceButton: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  faceButtonText: {
    color: COLORS.textDim,
    fontWeight: "bold",
    fontFamily: FONT_MONO,
    fontSize: 16,
  },
  r2Button: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.14)",
    justifyContent: "center",
    alignItems: "center",
  },
  r2ButtonActive: {
    backgroundColor: COLORS.red,
    borderColor: COLORS.red,
  },
  r2Text: {
    color: COLORS.textDim,
    fontWeight: "bold",
    fontFamily: FONT_MONO,
    fontSize: 20,
  },
  pedalContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  pedalLabel: {
    color: COLORS.textDim,
    fontFamily: FONT_MONO,
    fontSize: 11,
    fontWeight: "bold",
    letterSpacing: 1,
    marginBottom: 4,
  },
  pedalTrack: {
    flex: 1,
    width: 36,
    backgroundColor: COLORS.panel2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.line,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  pedalFill: { width: "100%", backgroundColor: COLORS.green },
  pedalPercent: {
    color: COLORS.text,
    fontFamily: FONT_MONO,
    fontSize: 11,
    marginTop: 4,
  },
  paddleShift: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.14)",
    justifyContent: "center",
    alignItems: "center",
  },
  paddleLeft: { transform: [{ skewX: "-8deg" }] },
  paddleRight: { transform: [{ skewX: "8deg" }] },
  paddleShiftActive: {
    backgroundColor: COLORS.cyan,
    borderColor: COLORS.cyan,
  },
  paddleShiftText: {
    color: COLORS.cyan,
    fontFamily: FONT_MONO,
    fontSize: 20,
    fontWeight: "900",
  },

  drsBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.panel2,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.line,
  },
  drsActive: {
    backgroundColor: COLORS.green,
    borderColor: COLORS.green,
  },
  drsText: {
    color: COLORS.textDim,
    fontFamily: FONT_MONO,
    fontWeight: "900",
    fontSize: 17,
  },
  drsTextActive: { color: "#000" },

  // ---- center dash (gear · car silhouette · speed) ----
  centerDash: {
    flex: 1,
    backgroundColor: "#050505",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.lineSoft,
    padding: 8,
    justifyContent: "space-between",
  },
  centerDashMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  gearSpeedCol: { alignItems: "center", width: 68 },
  dashMiniLabel: {
    color: COLORS.textDim,
    fontFamily: FONT_MONO,
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: "bold",
  },
  gearBig: {
    color: COLORS.yellow,
    fontFamily: FONT_MONO,
    fontSize: 46,
    fontWeight: "900",
    includeFontPadding: false,
  },
  speedBig: {
    color: COLORS.text,
    fontFamily: FONT_MONO,
    fontSize: 34,
    fontWeight: "900",
    includeFontPadding: false,
  },

  carSilhouetteWrap: {
    flex: 1,
    height: 100,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  carBody: {
    width: 30,
    height: 86,
    borderColor: "rgba(255,255,255,0.35)",
    borderWidth: 2,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  carNoseShape: {
    position: "absolute",
    top: -9,
    width: 16,
    height: 13,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },
  carCockpitShape: {
    width: 14,
    height: 22,
    backgroundColor: "#101318",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  tireCorner: {
    width: 11,
    height: 24,
    borderRadius: 3,
    position: "absolute",
    borderWidth: 1,
    borderColor: "#000",
  },
  tireFL: { left: -2, top: 6 },
  tireFR: { right: -2, top: 6 },
  tireRL: { left: -2, bottom: 6 },
  tireRR: { right: -2, bottom: 6 },

  centerDashStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderColor: COLORS.lineSoft,
    paddingTop: 6,
    marginTop: 4,
  },
  statCell: { alignItems: "center", flex: 1 },
  statLabel: {
    color: COLORS.textDim,
    fontFamily: FONT_MONO,
    fontSize: 8,
    letterSpacing: 1,
    fontWeight: "bold",
  },
  statVal: {
    color: COLORS.text,
    fontFamily: FONT_MONO,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },

  // ---- pit box drawer ----
  pitBox: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: PIT_BOX_HEIGHT,
    backgroundColor: "rgba(10,10,10,0.96)",
    borderTopWidth: 2,
    borderColor: COLORS.cyan,
    paddingHorizontal: 14,
    paddingTop: 8,
    zIndex: 250,
  },
  pitBoxTitle: {
    color: COLORS.cyan,
    fontFamily: FONT_MONO,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "bold",
    marginBottom: 6,
  },
  pitBoxRow: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  pitBoxEmpty: {
    color: COLORS.textDim,
    fontFamily: FONT_MONO,
    fontSize: 12,
  },
  pitBoxItem: {
    width: 62,
    height: 62,
    borderRadius: 10,
    backgroundColor: COLORS.panel2,
    borderWidth: 1,
    borderColor: COLORS.line,
    alignItems: "center",
    justifyContent: "center",
  },
  pitBoxItemText: {
    color: COLORS.text,
    fontFamily: FONT_MONO,
    fontWeight: "bold",
    fontSize: 12,
  },
});
