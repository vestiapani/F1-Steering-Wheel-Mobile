import { useRef } from "react";
import { Animated, PanResponder, Text, StyleSheet } from "react-native";
import { COLORS, FONT_MONO } from "../theme";

export default function PitBoxItem({ item, screenHeight, onDropAdd }) {
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

const styles = StyleSheet.create({
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
});
