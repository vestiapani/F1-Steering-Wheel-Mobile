import { useRef } from "react";
import { PanResponder, Animated } from "react-native";

export default function useDragResizeResponders({
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
