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
  ScrollView,
} from "react-native";
import { io } from "socket.io-client";
import Svg, { Path } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ---------------------------------------------------------------------------
// Tema Dashboard "Sim Racing MFD"
// ---------------------------------------------------------------------------
const COLORS = {
  bg: "#050505",
  panel: "#0d0d0d",
  panel2: "#141414",
  line: "#333333",
  lineSoft: "#1a1a1a",
  text: "#ffffff",
  textDim: "#888888",
  green: "#00ff00",
  yellow: "#ffcc00",
  red: "#ff2b4d",
  redDark: "#800000",
  cyan: "#00e5ff",
  blue: "#3d7bfd",
  purple: "#b34dff",
};

const FONT_MONO = Platform.select({
  ios: "Menlo-Bold",
  android: "monospace",
  default: "monospace",
});

function fmtMs(ms) {
  if (!ms) return "00:00.000";
  const m = Math.floor(ms / 60000)
    .toString()
    .padStart(2, "0");
  const s = ((ms % 60000) / 1000).toFixed(3).padStart(6, "0");
  return `${m}:${s}`;
}

function fmtSessionTime(seconds) {
  if (!seconds || seconds < 0) return "00:00";
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

// ---------------------------------------------------------------------------
// SVG Icons Replacement
// ---------------------------------------------------------------------------
const IconSettings = ({ color = "#fff", size = 24 }) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" />
    <Path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
  </Svg>
);

const IconCheck = ({ color = "#fff", size = 24 }) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M20 6L9 17l-5-5" />
  </Svg>
);

const IconClose = ({ color = "#fff", size = 24 }) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M18 6L6 18M6 6l12 12" />
  </Svg>
);

const IconEdit = ({ color = "#fff", size = 24 }) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <Path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </Svg>
);

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
        style={{ width: "100%", height: "100%", opacity: isEditMode ? 0.7 : 1 }}
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
          <IconClose size={16} color="#fff" />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Pit Box / Library Item
// ---------------------------------------------------------------------------
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
        if (gesture.moveY < screenHeight - 90) {
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
      <Text style={styles.pitBoxItemText}>{item.label || item.id}</Text>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// TOP SHIFT BAR
// ---------------------------------------------------------------------------
const TOP_SEGMENTS = 22;
const TopShiftBar = ({ litDots }) => {
  const [blink, setBlink] = useState(true);

  useEffect(() => {
    const iv = setInterval(() => setBlink((b) => !b), 75);
    return () => clearInterval(iv);
  }, []);

  // Animasi kedip (redlining) mulai aktif waktu lampu udah masuk area ungu
  const isRedlining = litDots >= 16;
  const showLights = !isRedlining || blink;

  return (
    <View style={styles.topShiftBar} pointerEvents="none">
      {Array.from({ length: TOP_SEGMENTS }).map((_, i) => {
        let color = "#141414";
        if (i < litDots) {
          // Atur proporsi warna: ujungnya ungu semua, hijau disunat, merah dibanyakin
          if (i >= 16)
            color = "#b34dff"; // 6 bar ujung ungu
          else if (i >= 5)
            color = COLORS.red; // 11 bar tengah merah
          else color = COLORS.green; // 5 bar pertama hijau
        }
        return (
          <View
            key={i}
            style={[
              styles.topShiftSeg,
              { backgroundColor: showLights ? color : "#141414" },
            ]}
          />
        );
      })}
    </View>
  );
};

// ---------------------------------------------------------------------------
// Komponen Visual UI
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
// DYNAMIC FLAG INDICATOR
// ---------------------------------------------------------------------------
const FlagIndicator = ({ flag }) => {
  let bgColor = COLORS.panel2;
  let textColor = COLORS.textDim;
  let text = "FLAG";

  if (flag === "RED") {
    bgColor = COLORS.red;
    textColor = "#000";
    text = "RED";
  } else if (flag === "DOUBLE_YELLOW") {
    bgColor = COLORS.yellow;
    textColor = "#000";
    text = "2x YLW";
  } else if (flag === "YELLOW") {
    bgColor = COLORS.yellow;
    textColor = "#000";
    text = "YELLOW";
  } else if (flag === "BLUE") {
    bgColor = COLORS.blue;
    textColor = "#fff";
    text = "BLUE";
  } else if (flag === "GREEN") {
    bgColor = COLORS.green;
    textColor = "#000";
    text = "GREEN";
  }

  return (
    <View
      style={[
        styles.flagBox,
        {
          backgroundColor: bgColor,
          borderColor: flag === "NONE" ? COLORS.line : bgColor,
        },
      ]}
    >
      <Text style={[styles.flagText, { color: textColor }]}>{text}</Text>
    </View>
  );
};

// ---------------------------------------------------------------------------
// CENTER DASH — MFD Sim Racing Redesign
// ---------------------------------------------------------------------------
const MfdDash = ({ telemetry, gearLabel }) => {
  const temps = telemetry.tyreTemp || [0, 0, 0, 0];

  const deltaVal = telemetry.delta != null ? parseFloat(telemetry.delta) : 0;
  const deltaColor =
    deltaVal < 0 ? COLORS.green : deltaVal > 0 ? COLORS.red : COLORS.text;
  const deltaStr = deltaVal !== 0 ? `+${deltaVal.toFixed(1)}m` : "0.0";

  const ersPct = Math.min(
    100,
    Math.max(0, Math.round(((telemetry.ersEnergy || 0) / 4000000) * 100)),
  );
  const rpmDisplay = Math.round(telemetry.rpm || 0).toString();
  const speedDisplay = Math.round(telemetry.speed || 0).toString();
  const lapDisplay = telemetry.lapNum ? telemetry.lapNum.toString() : "-";
  const bbalDisplay = telemetry.brakeBias ? `${telemetry.brakeBias}%` : "-";
  const sessionTimeDisplay = fmtSessionTime(telemetry.sessionTime);
  return (
    <View style={styles.mfdContainer}>
      <View style={styles.mfdRowTop}>
        <View style={styles.mfdCellTop}>
          <Text style={[styles.mfdTextTop, { color: COLORS.green }]}>
            {fmtMs(telemetry.lastLapMs)}
          </Text>
        </View>
        <View style={[styles.mfdCellTop, styles.borderSidesRed]}>
          <Text style={[styles.mfdTextTop, { color: COLORS.red }]}>
            {rpmDisplay}
          </Text>
        </View>
        <View style={styles.mfdCellTop}>
          <Text style={[styles.mfdTextTop, { color: deltaColor }]}>
            {deltaStr}
          </Text>
        </View>
      </View>
      <View style={styles.mfdRowMiddle}>
        <View style={styles.mfdColLeft}>
          <View style={styles.mfdSubCell}>
            <Text style={styles.mfdMiniLabel}>SPEED</Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "baseline",
                marginTop: 8,
              }}
            >
              <Text style={[styles.mfdWhiteBig, { marginTop: 0 }]}>
                {speedDisplay}
              </Text>
              <Text
                style={{
                  color: COLORS.textDim,
                  fontFamily: FONT_MONO,
                  fontSize: 10,
                  marginLeft: 2,
                }}
              >
                KM/H
              </Text>
            </View>
          </View>
          <View style={[styles.mfdSubCell, styles.borderTopWhite]}>
            <Text style={styles.mfdMiniLabel}>LAP</Text>
            <Text style={styles.mfdWhiteBig}>{lapDisplay}</Text>
          </View>
          <View style={[styles.mfdSubCell, styles.borderTopWhite]}>
            <Text style={styles.mfdMiniLabel}>SOC</Text>
            <Text style={[styles.mfdWhiteBig, { color: COLORS.green }]}>
              {ersPct}
            </Text>
          </View>
        </View>
        <View style={styles.mfdColCenter}>
          <Text style={styles.mfdGearLabel}>GEAR</Text>
          <Text style={styles.mfdGearNumber}>{gearLabel}</Text>
        </View>
        <View style={styles.mfdColRight}>
          <View style={styles.mfdTyreGrid}>
            <View style={styles.mfdTyreBox}>
              <Text style={styles.mfdTyreText}>{temps[2] || 21}</Text>
            </View>
            <View style={styles.mfdTyreBox}>
              <Text style={styles.mfdTyreText}>{temps[3] || 21}</Text>
            </View>
            <View style={styles.mfdTyreBox}>
              <Text style={styles.mfdTyreText}>{temps[0] || 17}</Text>
            </View>
            <View style={styles.mfdTyreBox}>
              <Text style={styles.mfdTyreText}>{temps[1] || 17}</Text>
            </View>
          </View>
          <View
            style={[styles.mfdSubCell, styles.borderTopWhite, { flex: 0.5 }]}
          >
            <Text style={styles.mfdMiniLabel}>BBAL</Text>
            <Text style={styles.mfdWhiteBig}>{bbalDisplay}</Text>
          </View>
        </View>
      </View>
      <View style={styles.mfdRowBottom}>
        <Text style={styles.mfdYellowTime}>{sessionTimeDisplay}</Text>
        <View style={styles.mfdBottomBar}>
          <View style={[styles.mfdBarFill, { width: `${ersPct}%` }]}></View>
        </View>
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Katalog Library & Layout Awal
// ---------------------------------------------------------------------------
const MIN_SIZE = {
  button: { w: 40, h: 40 },
  gas: { w: 40, h: 100 },
  mfd: { w: 320, h: 220 },
  drs: { w: 60, h: 40 },
  paddle: { w: 90, h: 46 },
  flag: { w: 70, h: 40 },
  default: { w: 60, h: 30 },
};

function buildCatalog() {
  return [
    { id: "X", type: "button", label: "X", color: COLORS.cyan, w: 65, h: 65 },
    { id: "Y", type: "button", label: "Y", color: COLORS.yellow, w: 55, h: 55 },
    { id: "A", type: "button", label: "A", color: COLORS.green, w: 60, h: 60 },
    { id: "B", type: "button", label: "B", color: COLORS.red, w: 60, h: 60 },
    {
      id: "Dpad_Up",
      type: "button",
      label: "⇧",
      color: COLORS.textDim,
      w: 50,
      h: 50,
    },
    {
      id: "Dpad_Dn",
      type: "button",
      label: "⇩",
      color: COLORS.textDim,
      w: 50,
      h: 50,
    },
    {
      id: "Dpad_L",
      type: "button",
      label: "⇦",
      color: COLORS.textDim,
      w: 50,
      h: 50,
    },
    {
      id: "Dpad_R",
      type: "button",
      label: "⇨",
      color: COLORS.textDim,
      w: 50,
      h: 50,
    },
    { id: "LB", type: "paddle", label: "－", side: "left", w: 100, h: 50 },
    { id: "RB", type: "paddle", label: "＋", side: "right", w: 100, h: 50 },
    { id: "R2", type: "r2", label: "R2", w: 180, h: 180 },
    { id: "GAS", type: "gas", label: "GAS", w: 60, h: 180 },
    { id: "DASH", type: "mfd", label: "MFD", w: 350, h: 230 },
    { id: "DRS", type: "drs", label: "DRS", w: 70, h: 40 },
    { id: "FLAG", type: "flag", label: "FLAG", w: 90, h: 45 },
  ];
}

function buildInitialLayout(SCREEN_W, SCREEN_H) {
  return [
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
    {
      id: "DASH",
      type: "mfd",
      label: "MFD",
      x: SCREEN_W / 2 - 175,
      y: SCREEN_H / 2 - 120,
      w: 350,
      h: 230,
    },
    {
      id: "DRS",
      type: "drs",
      label: "DRS",
      x: SCREEN_W / 2 + 100,
      y: 35,
      w: 70,
      h: 40,
    },
    {
      id: "FLAG",
      type: "flag",
      label: "FLAG",
      x: SCREEN_W / 2 - 45,
      y: 35,
      w: 90,
      h: 45,
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
    ersEnergy: 0,
    delta: 0,
    lastLapMs: 0,
  });
  const [flagState, setFlagState] = useState({ active: "NONE", ts: 0 });
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
  const gyroInvertedRef = useRef(false);
  const layoutRef = useRef(layout);
  const isEditModeRef = useRef(isEditMode);
  const showSettingsRef = useRef(showSettings);
  const activeTouches = useRef({});
  const gasPercentRef = useRef(0);

  const LAYOUT_KEY = "@f1_mfd_layout";

  // --- AUTOMATIC LOAD LAYOUT DARI ASYNC STORAGE ---
  useEffect(() => {
    const initLayout = async () => {
      if (SCREEN_W === 0) return;
      try {
        const savedLayout = await AsyncStorage.getItem(LAYOUT_KEY);
        if (savedLayout !== null) {
          setLayout(JSON.parse(savedLayout));
        } else {
          setLayout(buildInitialLayout(SCREEN_W, SCREEN_H));
        }
      } catch (e) {
        console.error("Gagal load layout:", e);
        setLayout(buildInitialLayout(SCREEN_W, SCREEN_H));
      }
    };

    if (layout.length === 0) {
      initLayout();
    }
  }, [SCREEN_W, SCREEN_H]);

  useEffect(() => {
    gyroInvertedRef.current = gyroInverted;
  }, [gyroInverted]);

  // --- AUTOMATIC SAVE LAYOUT KE ASYNC STORAGE ---
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

  const connect = () => {
    if (socketRef.current) socketRef.current.disconnect();
    const url = serverIp.startsWith("http") ? serverIp : `http://${serverIp}`;
    const socket = io(url, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));

    socket.on("telemetry", (data) => {
      setTelemetry((prev) => ({ ...prev, ...data }));
    });
    socket.on("leaderboard", (rows) => {
      const me = rows.find((r) => r.isPlayer);
      if (me) {
        setTelemetry((prev) => ({
          ...prev,
          lastLapMs: me.lastLapMs || prev.lastLapMs,
          delta: me.intervalM != null ? me.intervalM : prev.delta,
          lapNum: me.lapNum,
        }));
      }
    });

    socket.on("session-info", (data) => {
      setTelemetry((prev) => ({
        ...prev,
        sessionTime: data.timeLeft,
      }));
    });
    socket.on("flags", (data) => {
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
    }, 33);
    return () => {
      clearInterval(interval);
      socketRef.current?.disconnect();
    };
  }, []);

  // Gyro Handling
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
        if (beta > 0) {
          beta = Math.PI - beta;
        } else {
          beta = -Math.PI - beta;
        }
      }

      const dir = gyroInvertedRef.current ? -1 : 1;
      const MAX_TILT = 1.0;

      inputRef.current.LX = Math.max(-1, Math.min(1, (beta / MAX_TILT) * dir));
    });

    return () => {
      gyroSubscription.current?.remove();
      gyroSubscription.current = null;
    };
  }, [gyroEnabled]);

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
  if (rpmPercentage >= 74) {
    const fillRatio = Math.min(1, (rpmPercentage - 74) / 21);
    topLitDots = Math.round(fillRatio * TOP_SEGMENTS);
  }

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
      case "mfd":
        return <MfdDash telemetry={telemetry} gearLabel={gearLabel} />;
      case "drs":
        return <DrsIndicator active={telemetry.drs === 1} />;
      case "flag":
        return <FlagIndicator flag={flagState.active} />;
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
      {isEditMode && (
        <View style={styles.libraryContainer}>
          <Text style={styles.libraryTitle}>LIBRARY BUTTON (Drag ke Atas)</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
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
      )}

      {/* Panel Pengaturan PC & Gyro (RESPONSIF DENGAN SCROLLVIEW) */}
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
                    trackColor={{ false: COLORS.line, true: COLORS.yellow }}
                    thumbColor="#fff"
                  />
                </View>
              </View>

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

  // --- MODAL SETTINGS (RESPONSIF HEIGHT & SCROLL) ---
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
    marginTop: 4,
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

  // --- LIBRARY / PIT BOX ---
  libraryContainer: {
    position: "absolute",
    bottom: 10,
    left: 20,
    right: 20,
    height: 90,
    backgroundColor: "rgba(15,15,15,0.9)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cyan,
    padding: 8,
    zIndex: 150,
  },
  libraryTitle: {
    color: COLORS.cyan,
    fontFamily: FONT_MONO,
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 6,
    marginLeft: 4,
  },
  libraryScroll: { alignItems: "center", paddingHorizontal: 4, gap: 12 },
  libraryEmpty: {
    color: COLORS.textDim,
    fontFamily: FONT_MONO,
    fontSize: 12,
    fontStyle: "italic",
    alignSelf: "center",
    marginLeft: 10,
  },
  pitBoxItem: {
    width: 50,
    height: 50,
    backgroundColor: COLORS.panel2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.line,
    justifyContent: "center",
    alignItems: "center",
  },
  pitBoxItemText: {
    color: COLORS.text,
    fontFamily: FONT_MONO,
    fontSize: 11,
    fontWeight: "bold",
  },

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
    left: -12,
    top: -12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.red,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 41,
    borderWidth: 2,
    borderColor: COLORS.bg,
  },

  // --- CONTROLS ---
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
    fontSize: 18,
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
  r2ButtonActive: { backgroundColor: COLORS.red, borderColor: COLORS.red },
  r2Text: {
    color: COLORS.textDim,
    fontWeight: "bold",
    fontFamily: FONT_MONO,
    fontSize: 20,
  },
  pedalContainer: { flex: 1, alignItems: "center" },
  pedalLabel: {
    color: COLORS.textDim,
    fontFamily: FONT_MONO,
    fontSize: 11,
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
  pedalFill: { width: "100%", backgroundColor: COLORS.cyan },
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
  paddleShiftActive: { backgroundColor: COLORS.cyan, borderColor: COLORS.cyan },
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
  drsActive: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  drsText: {
    color: COLORS.textDim,
    fontFamily: FONT_MONO,
    fontWeight: "900",
    fontSize: 17,
  },
  drsTextActive: { color: "#000" },

  mfdContainer: {
    flex: 1,
    backgroundColor: "#000",
    borderWidth: 2,
    borderColor: "#333",
    borderRadius: 8,
    overflow: "hidden",
  },
  mfdRowTop: {
    flexDirection: "row",
    height: 35,
    borderBottomWidth: 2,
    borderColor: "#333",
  },
  mfdCellTop: { flex: 1, justifyContent: "center", alignItems: "center" },
  borderSidesRed: {
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: COLORS.red,
  },
  mfdTextTop: { fontFamily: FONT_MONO, fontSize: 18, fontWeight: "bold" },
  mfdRowMiddle: { flex: 1, flexDirection: "row" },
  mfdColLeft: { flex: 1, borderRightWidth: 2, borderColor: COLORS.red },
  mfdColCenter: { flex: 1.5, justifyContent: "center", alignItems: "center" },
  mfdColRight: { flex: 1, borderLeftWidth: 2, borderColor: COLORS.red },
  mfdSubCell: { flex: 1, justifyContent: "center", alignItems: "center" },
  borderTopWhite: { borderTopWidth: 1, borderColor: "#555" },
  mfdMiniLabel: {
    color: "#fff",
    fontFamily: FONT_MONO,
    fontSize: 9,
    position: "absolute",
    top: 2,
    left: 4,
  },
  mfdWhiteBig: {
    color: "#fff",
    fontFamily: FONT_MONO,
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 8,
  },
  mfdGearLabel: {
    color: "#fff",
    fontFamily: FONT_MONO,
    fontSize: 12,
    position: "absolute",
    top: 5,
  },
  mfdGearNumber: {
    color: "#fff",
    fontFamily: FONT_MONO,
    fontSize: 90,
    fontWeight: "bold",
    includeFontPadding: false,
  },
  mfdTyreGrid: {
    flex: 1,
    flexWrap: "wrap",
    flexDirection: "row",
    padding: 4,
    gap: 4,
    justifyContent: "center",
    alignContent: "center",
  },
  mfdTyreBox: {
    width: "45%",
    height: "40%",
    backgroundColor: COLORS.redDark,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 2,
  },
  mfdTyreText: {
    color: "#fff",
    fontFamily: FONT_MONO,
    fontSize: 14,
    fontWeight: "bold",
  },
  mfdRowBottom: {
    height: 30,
    borderTopWidth: 2,
    borderColor: "#333",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    justifyContent: "space-between",
  },
  mfdYellowTime: {
    color: COLORS.yellow,
    fontFamily: FONT_MONO,
    fontSize: 14,
    fontWeight: "bold",
  },
  mfdBottomBar: {
    flex: 1,
    height: 10,
    backgroundColor: "#222",
    marginLeft: 15,
    borderRadius: 2,
    overflow: "hidden",
  },
  mfdBarFill: { width: "40%", height: "100%", backgroundColor: COLORS.purple },
  // --- FLAGS ---
  flagBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 6,
    borderWidth: 2,
  },
  flagText: { fontFamily: FONT_MONO, fontWeight: "900", fontSize: 16 },
});
