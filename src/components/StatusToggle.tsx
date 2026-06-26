import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { colors, borderRadius, spacing, typography } from "../constants/theme";
import { ItemStatus } from "../types";

interface StatusToggleProps {
  value: ItemStatus;
  onChange: (status: ItemStatus) => void;
}

export function StatusToggle({ value, onChange }: StatusToggleProps) {
  const isLost = value === "lost";

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, isLost && styles.activeLostButton]}
        onPress={() => onChange("lost")}
        activeOpacity={0.8}
        testID="status-toggle-lost"
      >
        <Text style={[styles.text, isLost && styles.activeText]}>LOST</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, !isLost && styles.activeFoundButton]}
        onPress={() => onChange("found")}
        activeOpacity={0.8}
        testID="status-toggle-found"
      >
        <Text style={[styles.text, !isLost && styles.activeText]}>FOUND</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: colors.borderLight,
    padding: 4,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
  },
  button: {
    flex: 1,
    paddingVertical: spacing.sm - 2,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: borderRadius.sm,
  },
  activeLostButton: {
    backgroundColor: colors.lost,
  },
  activeFoundButton: {
    backgroundColor: colors.found,
  },
  text: {
    ...typography.button,
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: "700",
  },
  activeText: {
    color: colors.textInverse,
  },
});
