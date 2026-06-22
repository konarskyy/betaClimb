import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme";
import type { RouteGrade } from "../types";

/**
 * Znacznik trudności trasy: stopień w skali V + kropka z kolorem skali sali
 * (z opcjonalną nazwą koloru). `size="sm"` na listę, `size="md"` na ekran trasy.
 */
export function GradeBadge({
  grade,
  size = "md",
}: {
  grade: RouteGrade;
  size?: "sm" | "md";
}) {
  const small = size === "sm";
  return (
    <View style={[styles.wrap, small ? styles.wrapSm : styles.wrapMd]}>
      <Text style={[styles.v, small ? styles.vSm : styles.vMd]}>{grade.vScale}</Text>
      <View style={[styles.dot, { backgroundColor: grade.color.hex }, small && styles.dotSm]} />
      {!small && <Text style={styles.colorLabel}>{grade.color.label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
  },
  wrapSm: { paddingHorizontal: spacing.xs, paddingVertical: 2 },
  wrapMd: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  v: { color: colors.text, fontWeight: "800" },
  vSm: { fontSize: 13 },
  vMd: { fontSize: 18 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: "rgba(0,0,0,0.4)" },
  dotSm: { width: 10, height: 10, borderRadius: 5 },
  colorLabel: { color: colors.textMuted, fontWeight: "600" },
});
