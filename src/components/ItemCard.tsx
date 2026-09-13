import { View, Text, Pressable, Image } from "react-native";
import {
  MapPin,
  CalendarDays,
  Smartphone,
  Laptop,
  Wallet,
  KeyRound,
  Package,
  CreditCard,
  ArrowUpRight,
} from "lucide-react-native";
import { Report } from "../../shared/domain";
import { Badge, palette, s } from "./ui";
import { useProtectedImage } from "../lib/api";
export function ReportPhoto({
  report,
  large = false,
}: {
  report: Report;
  large?: boolean;
}) {
  const { uri, error } = useProtectedImage(report.photoPath);
  const Icon =
    (
      {
        Phone: Smartphone,
        Laptop,
        Wallet,
        Keys: KeyRound,
        "ID Card": CreditCard,
      } as Record<string, typeof Package>
    )[report.category] || Package;
  return (
    <View
      style={{
        height: large ? 260 : report.photoPath ? 180 : 108,
        backgroundColor: report.type === "found" ? "#E9EDE4" : "#FFF3D8",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {uri ? (
        <Image
          accessibilityLabel={report.title}
          source={{ uri }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="cover"
        />
      ) : (
        <>
          <Icon
            size={large ? 72 : 48}
            strokeWidth={1.3}
            color={report.type === "found" ? "#738475" : "#9D762C"}
          />
          {error && (
            <Text style={[s.small, { paddingTop: 10 }]}>Photo unavailable</Text>
          )}
        </>
      )}
    </View>
  );
}
export function ItemCard({
  item,
  onPress,
}: {
  item: Report;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={item.title + ", " + item.type + ", " + item.location}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: "white",
        borderWidth: 1,
        borderColor: palette.line,
        borderRadius: 16,
        padding: 12,
        gap: 14,
        opacity: pressed ? 0.8 : 1,
        height: "100%",
      })}
    >
      <ReportPhoto report={item} />
      <View style={{ padding: 5, gap: 10 }}>
        <View style={[s.row, { justifyContent: "space-between" }]}>
          <Badge tone={item.type === "found" ? "green" : "gold"}>
            {item.type === "found" ? "Found item" : "Lost item"}
          </Badge>
          <Text style={s.small}>{item.category}</Text>
        </View>
        <View style={[s.row, { flexWrap: "nowrap" }]}>
          <Text style={[s.h2, { flex: 1, fontSize: 19 }]} numberOfLines={2}>
            {item.title}
          </Text>
          <ArrowUpRight size={19} color={palette.muted} />
        </View>
        <Text style={s.small} numberOfLines={2}>
          {item.description}
        </Text>
        <View style={[s.row, { gap: 7 }]}>
          <MapPin size={15} color={palette.muted} />
          <Text style={[s.small, { flex: 1 }]} numberOfLines={1}>
            {item.location}
          </Text>
        </View>
        <View style={[s.row, { gap: 7 }]}>
          <CalendarDays size={15} color={palette.muted} />
          <Text style={s.small}>
            {formatDate(item.eventDate)}
            {item.approximateDate ? " · approximate" : ""}
          </Text>
          {item.state !== "open" && <Badge tone="gray">{item.state}</Badge>}
        </View>
      </View>
    </Pressable>
  );
}
export function formatDate(value: string | number) {
  const date = new Date(
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? value + "T12:00:00Z"
      : value,
  );
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}
