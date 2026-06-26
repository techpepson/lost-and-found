import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { MapPin, Calendar, Tag } from "lucide-react-native";
import { colors, borderRadius, spacing, typography, shadows } from "../constants/theme";
import { Item } from "../types";

interface ItemCardProps {
  item: Item;
  onPress: () => void;
}

export function ItemCard({ item, onPress }: ItemCardProps) {
  const isLost = item.status === "lost";

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9} testID={`item-card-${item.id}`}>
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.image} contentFit="cover" />
      ) : (
        <View style={[styles.imagePlaceholder, { backgroundColor: isLost ? "#FEE2E2" : "#D1FAE5" }]}>
          <Tag size={32} color={isLost ? colors.lost : colors.found} />
        </View>
      )}

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <View style={[styles.statusBadge, { backgroundColor: isLost ? colors.lost : colors.found }]}>
            <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
          </View>
          <Text style={styles.category}>{item.category}</Text>
        </View>

        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.description} numberOfLines={2}>{item.description}</Text>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <MapPin size={14} color={colors.textTertiary} />
            <Text style={styles.metaText} numberOfLines={1}>{item.location}</Text>
          </View>
          <View style={styles.metaItem}>
            <Calendar size={14} color={colors.textTertiary} />
            <Text style={styles.metaText} numberOfLines={1}>{item.date}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    marginVertical: spacing.sm,
    marginHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: "hidden",
    ...shadows.sm,
  },
  image: {
    width: 110,
    height: 110,
  },
  imagePlaceholder: {
    width: 110,
    height: 110,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    padding: spacing.sm,
    justifyContent: "space-between",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusBadge: {
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    color: colors.textInverse,
    fontSize: 10,
    fontWeight: "700",
  },
  category: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  title: {
    ...typography.h4,
    color: colors.textPrimary,
    marginTop: 4,
  },
  description: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginVertical: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: 4,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  metaText: {
    fontSize: 12,
    color: colors.textTertiary,
  },
});
