import { View, Text, StyleSheet } from "react-native";
import { COLORS, FONT_MONO } from "../../theme";

export const FaceButton = ({ label, color, pressed }) => (
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

export const R2Button = ({ pressed }) => (
  <View style={[styles.r2Button, pressed && styles.r2ButtonActive]}>
    <Text style={[styles.r2Text, pressed && { color: COLORS.bg }]}>R2</Text>
  </View>
);

export const GasSlider = ({ percent }) => (
  <View style={styles.pedalContainer}>
    <Text style={styles.pedalLabel}>GAS</Text>
    <View style={styles.pedalTrack}>
      <View style={[styles.pedalFill, { height: `${percent * 100}%` }]} />
    </View>
    <Text style={styles.pedalPercent}>{Math.round(percent * 100)}%</Text>
  </View>
);

export const PaddleShift = ({ label, pressed, side }) => (
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

export const DrsIndicator = ({ active }) => (
  <View style={[styles.drsBox, active && styles.drsActive]}>
    <Text style={[styles.drsText, active && styles.drsTextActive]}>DRS</Text>
  </View>
);

export const FlagIndicator = ({ flag }) => {
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

const styles = StyleSheet.create({
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
  flagBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 6,
    borderWidth: 2,
  },
  flagText: { fontFamily: FONT_MONO, fontWeight: "900", fontSize: 16 },
});
