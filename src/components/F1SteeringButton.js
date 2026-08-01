import React from "react";
import { TouchableOpacity, Text, View, StyleSheet } from "react-native";
import { COLORS, FONT_MONO } from "../theme";

export default function F1SteeringButton({
  label,
  color = COLORS.blue,
  onPress,
  size = 60,
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPress={onPress}
      style={[
        styles.outerBezel,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <View
        style={[
          styles.innerButton,
          { backgroundColor: color, borderRadius: (size - 10) / 2 },
        ]}
      >
        <Text style={styles.label} numberOfLines={1} adjustsFontSizeToFit>
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  outerBezel: {
    backgroundColor: COLORS.line, // Warna bezel abu-abu gelap dari theme.js
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: COLORS.bg,
    margin: 4,
    // Efek timbul standar
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
  },
  innerButton: {
    width: "82%",
    height: "82%",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.2)", // Biar warna dalamnya ada sedikit dimensi
  },
  label: {
    color: "#ffffff", // Putih solid untuk teks
    fontFamily: FONT_MONO, // Ngikutin platform (Menlo/monospace)
    fontSize: 18,
    fontWeight: "bold",
    // Bikin teks lebih pop-up di atas warna terang
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
