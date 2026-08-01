import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, FONT_MONO, fmtMs, fmtSessionTime } from "../theme";

function MfdDashComponent({ telemetry, gearLabel, showDelta = true }) {
  const temps = telemetry.tyreTemp || [0, 0, 0, 0];

  const deltaVal = telemetry.delta != null ? parseFloat(telemetry.delta) : 0;
  const deltaColor = !showDelta
    ? COLORS.textDim
    : deltaVal < 0
      ? COLORS.green
      : deltaVal > 0
        ? COLORS.red
        : COLORS.text;
  const deltaStr = !showDelta
    ? "—"
    : deltaVal !== 0
      ? `${deltaVal > 0 ? "+" : ""}${deltaVal.toFixed(3)}`
      : "0.000";
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
}

export default React.memo(MfdDashComponent, (prevProps, nextProps) => {
  return (
    prevProps.gearLabel === nextProps.gearLabel &&
    prevProps.showDelta === nextProps.showDelta &&
    prevProps.telemetry.speed === nextProps.telemetry.speed &&
    prevProps.telemetry.rpm === nextProps.telemetry.rpm &&
    prevProps.telemetry.delta === nextProps.telemetry.delta &&
    prevProps.telemetry.lapNum === nextProps.telemetry.lapNum &&
    prevProps.telemetry.lastLapMs === nextProps.telemetry.lastLapMs
  );
});

const styles = StyleSheet.create({
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
});
