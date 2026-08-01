import { useEffect, useRef } from "react";
import {
  Animated,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { COLORS } from "../theme";
import useDragResizeResponders from "../hooks/useDragResize";
import { IconClose } from "./icons/Icons";

export default function EditableItem({
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

const styles = StyleSheet.create({
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
});
