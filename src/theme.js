import { Platform } from "react-native";

export const COLORS = {
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

export const FONT_MONO = Platform.select({
  ios: "Menlo-Bold",
  android: "monospace",
  default: "monospace",
});

export function fmtMs(ms) {
  if (!ms) return "00:00.000";
  const m = Math.floor(ms / 60000)
    .toString()
    .padStart(2, "0");
  const s = ((ms % 60000) / 1000).toFixed(3).padStart(6, "0");
  return `${m}:${s}`;
}

export function fmtSessionTime(seconds) {
  if (!seconds || seconds < 0) return "00:00";
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}
