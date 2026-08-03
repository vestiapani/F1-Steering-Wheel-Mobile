import React, { useState, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { COLORS } from "../theme";

// F1-style shiftlight: 15 round LEDs. Fill range is RPM 75%→90% (see the
// (pct - 75) / 15 math in App.js), colour zones are green (0-4) → red (5-9)
// → purple (10-14), and once the purple zone is reached all lit LEDs strobe
// together instead of staying solid.
const TOTAL_LEDS = 15;
const PURPLE_START = 10;
const RED_START = 5;

function TopShiftBarComponent({ litDots }) {
  const isRedlining = litDots >= PURPLE_START;

  // Strobe timing: a hard 50ms-on/50ms-off alternation, driven by its own
  // interval rather than piggybacking on however often telemetry re-renders
  // this component — that's what keeps the blink crisp and consistent
  // instead of drifting with the phone's telemetry throttle. Only runs
  // while actually in the purple zone, so it's not ticking (and re-
  // rendering) for nothing the rest of the time.
  const [blinkOff, setBlinkOff] = useState(false);

  useEffect(() => {
    if (!isRedlining) {
      setBlinkOff(false);
      return;
    }
    let on = true;
    const iv = setInterval(() => {
      on = !on;
      setBlinkOff(!on);
    }, 50);
    return () => clearInterval(iv);
  }, [isRedlining]);

  return (
    <View style={styles.topShiftBar} pointerEvents="none">
      {Array.from({ length: TOTAL_LEDS }).map((_, i) => {
        let color = "#1a1f28";
        if (i < litDots) {
          if (isRedlining && blinkOff) {
            color = "#1a1f28";
          } else if (i >= PURPLE_START) {
            color = COLORS.purple;
          } else if (i >= RED_START) {
            color = COLORS.red;
          } else {
            color = COLORS.green;
          }
        }
        const isLit = color !== "#1a1f28";
        return (
          <View
            key={i}
            style={[
              styles.topShiftLed,
              {
                backgroundColor: color,
                shadowColor: isLit ? color : "transparent",
                shadowOpacity: isLit ? 0.9 : 0,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

export default React.memo(TopShiftBarComponent, (prevProps, nextProps) => {
  return prevProps.litDots === nextProps.litDots;
});

const styles = StyleSheet.create({
  topShiftBar: {
    position: "absolute",
    top: 0,
    left: -65,
    right: 0,
    height: 22,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    zIndex: 300,
    backgroundColor: "#000",
  },
  topShiftLed: {
    width: 14,
    height: 14,
    borderRadius: 7,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 6,
    elevation: 4,
  },
});
