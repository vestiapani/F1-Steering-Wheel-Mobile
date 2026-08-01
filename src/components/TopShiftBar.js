import React, { useState, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { COLORS } from "../theme";

const TOP_SEGMENTS = 22;

function TopShiftBarComponent({ litDots }) {
  const [blink, setBlink] = useState(true);

  useEffect(() => {
    const iv = setInterval(() => setBlink((b) => !b), 75);
    return () => clearInterval(iv);
  }, []);

  const isRedlining = litDots >= 16;
  const showLights = !isRedlining || blink;

  return (
    <View style={styles.topShiftBar} pointerEvents="none">
      {Array.from({ length: TOP_SEGMENTS }).map((_, i) => {
        let color = "#141414";
        if (i < litDots) {
          if (i >= 16) color = "#b34dff";
          else if (i >= 5) color = COLORS.red;
          else color = COLORS.green;
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
}

export default React.memo(TopShiftBarComponent, (prevProps, nextProps) => {
  return prevProps.litDots === nextProps.litDots;
});

const styles = StyleSheet.create({
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
});
