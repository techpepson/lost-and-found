import { ReactNode, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  TextInputProps,
  Platform,
  Modal,
  KeyboardAvoidingView,
  FlatList,
} from "react-native";
import { usePathname, useRouter } from "expo-router";
import {
  Search,
  ChevronDown,
  ChevronLeft,
  Check as CheckIcon,
  X,
  CalendarDays,
  CircleHelp,
} from "lucide-react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";

export const palette = {
  navy: "#1C332A",
  blue: "#285541",
  gold: "#8B631D",
  ink: "#26382E",
  muted: "#667068",
  line: "#E0E4DC",
  bg: "#F7F8F3",
  white: "#FFFFFF",
  green: "#146C50",
  red: "#B42338",
};
export const s = StyleSheet.create({
  page: {
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
    padding: 20,
    gap: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 30,
    lineHeight: 37,
    fontWeight: "700",
    color: palette.navy,
    letterSpacing: -0.7,
  },
  h2: {
    fontSize: 19,
    fontWeight: "600",
    color: palette.navy,
    lineHeight: 26,
    flexShrink: 1,
  },
  body: { fontSize: 16, lineHeight: 25, color: palette.muted },
  small: { fontSize: 14, lineHeight: 21, color: palette.muted },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: palette.ink,
    lineHeight: 21,
  },
  card: {
    padding: 16,
    backgroundColor: palette.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: "#B6C0B6",
    borderRadius: 11,
    backgroundColor: palette.white,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: palette.ink,
  },
  separator: { height: 1, backgroundColor: palette.line },
});
export function Button({
  children,
  onPress,
  tone = "primary",
  disabled,
  busy,
  small,
  icon,
}: {
  children: ReactNode;
  onPress: () => void;
  tone?: "primary" | "secondary" | "danger" | "quiet";
  disabled?: boolean;
  busy?: boolean;
  small?: boolean;
  icon?: ReactNode;
}) {
  const filled = tone === "primary" || tone === "danger";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!busy, busy: !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: small ? 44 : 50,
        paddingHorizontal: small ? 14 : 18,
        paddingVertical: 11,
        borderRadius: 11,
        borderWidth: 1,
        borderColor: tone === "secondary" ? palette.line : "transparent",
        backgroundColor:
          tone === "primary"
            ? palette.blue
            : tone === "danger"
              ? palette.red
              : tone === "secondary"
                ? "#FFF"
                : "transparent",
        opacity: disabled || busy ? 0.5 : pressed ? 0.78 : 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        maxWidth: "100%",
      })}
    >
      {busy ? (
        <ActivityIndicator color={filled ? "#FFF" : palette.blue} />
      ) : (
        icon
      )}
      <Text
        style={{
          fontSize: 15,
          fontWeight: "600",
          color: filled ? "#FFF" : palette.blue,
          flexShrink: 1,
          textAlign: "center",
        }}
      >
        {children}
      </Text>
    </Pressable>
  );
}
export function Field({
  label,
  hint,
  ...props
}: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={{ gap: 7, width: "100%", minWidth: 0 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#758077"
        {...props}
        style={[
          s.input,
          props.multiline && { minHeight: 120, textAlignVertical: "top" },
          props.style,
        ]}
      />
      {hint ? <Text style={s.small}>{hint}</Text> : null}
    </View>
  );
}
export function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const insets = useSafeAreaInsets();
  return (
    <View style={{ gap: 7, width: "100%", minWidth: 0 }}>
      <Text style={s.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label + ": " + value}
        onPress={() => {
          setSearch("");
          setOpen(true);
        }}
        style={[
          s.input,
          s.row,
          { justifyContent: "space-between", flexWrap: "nowrap" },
        ]}
      >
        <Text style={[s.body, { color: palette.ink, flex: 1 }]}>
          {value.replaceAll("_", " ")}
        </Text>
        <ChevronDown size={18} color={palette.muted} />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "#102A4380",
          }}
        >
          <Pressable
            accessibilityLabel="Close selection"
            accessibilityRole="button"
            onPress={() => setOpen(false)}
            style={{ flex: 1 }}
          />
          <View
            accessibilityViewIsModal
            style={{
              backgroundColor: "white",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 22,
              paddingBottom: Math.max(insets.bottom, 22),
              maxHeight: "75%",
              gap: 16,
            }}
          >
            <View style={[s.row, { justifyContent: "space-between" }]}>
              <Text style={[s.h2, { flex: 1 }]}>{label}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={() => setOpen(false)}
                style={{ padding: 12 }}
              >
                <X color={palette.muted} size={22} />
              </Pressable>
            </View>
            {options.length > 6 && (
              <Field
                label="Find an option"
                value={search}
                onChangeText={setSearch}
                autoCorrect={false}
              />
            )}
            <FlatList
              keyboardShouldPersistTaps="handled"
              data={options.filter((option) =>
                option.toLowerCase().includes(search.toLowerCase()),
              )}
              keyExtractor={(option) => option}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected: item === value }}
                  onPress={() => {
                    onChange(item);
                    setOpen(false);
                  }}
                  style={{
                    minHeight: 52,
                    paddingVertical: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    borderBottomWidth: 1,
                    borderColor: palette.line,
                  }}
                >
                  <Text
                    style={[
                      s.body,
                      {
                        flex: 1,
                        color: item === value ? palette.blue : palette.ink,
                      },
                    ]}
                  >
                    {item.replaceAll("_", " ")}
                  </Text>
                  {item === value && (
                    <CheckIcon size={20} color={palette.blue} />
                  )}
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={s.body}>No matching options.</Text>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
function localDate(date: Date) {
  return (
    date.getFullYear() +
    "-" +
    String(date.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(date.getDate()).padStart(2, "0")
  );
}
export function DateField({
  label,
  value,
  onChange,
  time = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  time?: boolean;
}) {
  const [mode, setMode] = useState<"date" | "time" | null>(null);
  const date = value
    ? new Date(value.length === 10 ? value + "T12:00:00" : value)
    : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  function changed(selected: Date) {
    const next = new Date(safeDate);
    if (mode === "time")
      next.setHours(selected.getHours(), selected.getMinutes());
    else
      next.setFullYear(
        selected.getFullYear(),
        selected.getMonth(),
        selected.getDate(),
      );
    onChange(
      localDate(next) +
        (time
          ? "T" +
            String(next.getHours()).padStart(2, "0") +
            ":" +
            String(next.getMinutes()).padStart(2, "0")
          : ""),
    );
  }
  return (
    <View style={{ gap: 7, width: "100%", minWidth: 0 }}>
      <Text style={s.label}>{label}</Text>
      {Platform.OS === "web" ? (
        <TextInput
          accessibilityLabel={label}
          style={s.input}
          value={value}
          onChangeText={onChange}
          placeholder={time ? "YYYY-MM-DDTHH:mm" : "YYYY-MM-DD"}
        />
      ) : (
        <View style={s.row}>
          <Button
            tone="secondary"
            icon={<CalendarDays size={18} color={palette.blue} />}
            onPress={() => setMode("date")}
          >
            {value ? safeDate.toLocaleDateString("en-GB") : "Choose date"}
          </Button>
          {time && (
            <Button tone="secondary" onPress={() => setMode("time")}>
              {value
                ? safeDate.toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Choose time"}
            </Button>
          )}
          {value && !time && (
            <Button small tone="quiet" onPress={() => onChange("")}>
              Clear
            </Button>
          )}
        </View>
      )}
      {mode && Platform.OS === "android" && (
        <DateTimePicker
          value={safeDate}
          mode={mode}
          display="default"
          onChange={(event, selected) => {
            if (event.type === "set" && selected) changed(selected);
            setMode(null);
          }}
        />
      )}
      {Platform.OS === "ios" && (
        <Modal
          visible={!!mode}
          transparent
          animationType="slide"
          onRequestClose={() => setMode(null)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "#102A4380",
              justifyContent: "flex-end",
            }}
          >
            <Pressable
              accessibilityLabel="Close date picker"
              accessibilityRole="button"
              style={{ flex: 1 }}
              onPress={() => setMode(null)}
            />
            <View
              style={{
                backgroundColor: "white",
                padding: 24,
                paddingBottom: 40,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
              }}
            >
              <Text style={s.h2}>{label}</Text>
              <DateTimePicker
                value={safeDate}
                mode={mode || "date"}
                display="spinner"
                themeVariant="light"
                onChange={(_, selected) => {
                  if (selected) changed(selected);
                }}
              />
              <Button
                onPress={() => {
                  if (!value) changed(safeDate);
                  setMode(null);
                }}
              >
                Done
              </Button>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}
export function Check({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={[s.row, { minHeight: 48 }]}
    >
      <View
        style={{
          width: 23,
          height: 23,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: value ? palette.blue : "#8BA0B4",
          backgroundColor: value ? palette.blue : "white",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {value && <CheckIcon size={17} color="white" />}
      </View>
      <Text style={[s.body, { flex: 1 }]}>{label}</Text>
    </Pressable>
  );
}
export function Card({ children }: { children: ReactNode }) {
  return <View style={s.card}>{children}</View>;
}
export function Page({
  title,
  subtitle,
  eyebrow,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const deep = !["/", "/post", "/profile", "/updates"].includes(pathname);
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: palette.bg }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <View
            style={[
              s.page,
              {
                padding: width < 400 ? 16 : 20,
                paddingBottom: Math.max(insets.bottom + 24, 40),
              },
            ]}
          >
            <View style={[s.row, { justifyContent: "space-between" }]}>
              {deep ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                  onPress={() =>
                    router.canGoBack() ? router.back() : router.replace("/")
                  }
                  style={{
                    minHeight: 44,
                    minWidth: 44,
                    justifyContent: "center",
                  }}
                >
                  <ChevronLeft color={palette.navy} size={27} />
                </Pressable>
              ) : (
                <Text
                  style={{
                    color: palette.navy,
                    fontSize: 15,
                    fontWeight: "700",
                  }}
                >
                  Legon{" "}
                  <Text style={{ color: palette.muted, fontWeight: "400" }}>
                    Lost & Found
                  </Text>
                </Text>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="How recovery works"
                onPress={() => router.push("/help")}
                style={{ padding: 11 }}
              >
                <CircleHelp color={palette.muted} size={22} />
              </Pressable>
            </View>
            <View style={{ gap: 12 }}>
              <View style={{ gap: 6 }}>
                {eyebrow &&
                  ![
                    "/",
                    "/post",
                    "/profile",
                    "/updates",
                    "/notifications",
                  ].includes(pathname) &&
                  !pathname.startsWith("/auth") && (
                    <Text
                      style={{
                        color: palette.blue,
                        letterSpacing: 0.5,
                        fontSize: 12,
                        fontWeight: "700",
                      }}
                    >
                      {eyebrow}
                    </Text>
                  )}
                <Text accessibilityRole="header" style={s.title}>
                  {title}
                </Text>
                {subtitle && <Text style={s.body}>{subtitle}</Text>}
              </View>
              {actions}
            </View>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Badge({
  children,
  tone = "blue",
}: {
  children: ReactNode;
  tone?: "blue" | "green" | "gold" | "red" | "gray";
}) {
  const color = {
    blue: palette.blue,
    green: palette.green,
    gold: "#855500",
    red: palette.red,
    gray: palette.muted,
  }[tone];
  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderRadius: 7,
        paddingHorizontal: 9,
        paddingVertical: 5,
        backgroundColor: {
          blue: "#EAF0E7",
          green: "#E8F5EF",
          gold: "#FFF4D8",
          red: "#FFF0F1",
          gray: "#EEF0EB",
        }[tone],
      }}
    >
      <Text
        style={{
          fontSize: 13,
          color,
          fontWeight: "600",
          textTransform: "capitalize",
        }}
      >
        {typeof children === "string"
          ? children.replaceAll("_", " ")
          : children}
      </Text>
    </View>
  );
}
export function Feedback({
  text,
  success = false,
}: {
  text?: string;
  success?: boolean;
}) {
  return text ? (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        padding: 14,
        borderRadius: 11,
        backgroundColor: success ? "#E8F5EF" : "#FFF0F1",
      }}
    >
      <Text style={[s.body, { color: success ? palette.green : palette.red }]}>
        {text}
      </Text>
    </View>
  ) : null;
}
export function Empty({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children?: ReactNode;
}) {
  return (
    <Card>
      <View style={{ paddingVertical: 16, gap: 12, alignItems: "flex-start" }}>
        <Search size={28} color={palette.blue} />
        <Text style={s.h2}>{title}</Text>
        <Text style={s.body}>{detail}</Text>
        {children}
      </View>
    </Card>
  );
}
export function Loading() {
  return (
    <View
      accessibilityLabel="Loading"
      style={{
        flex: 1,
        minHeight: 180,
        padding: 40,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: palette.bg,
      }}
    >
      <ActivityIndicator size="large" color={palette.blue} />
    </View>
  );
}
export function SectionTabs({
  options,
  value,
  onChange,
}: {
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        gap: 24,
        borderBottomWidth: 1,
        borderBottomColor: palette.line,
      }}
    >
      {options.map((option) => (
        <Pressable
          key={option}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === option }}
          onPress={() => onChange(option)}
          style={{
            minHeight: 48,
            justifyContent: "center",
            paddingHorizontal: 2,
            borderBottomWidth: 2,
            borderBottomColor: value === option ? palette.blue : "transparent",
          }}
        >
          <Text
            style={{
              color: value === option ? palette.blue : palette.muted,
              fontWeight: value === option ? "700" : "500",
              fontSize: 15,
            }}
          >
            {option}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
export function QueryError({
  error,
  retry,
}: {
  error: string;
  retry: () => void;
}) {
  return (
    <Card>
      <Feedback text={error} />
      <Button tone="secondary" onPress={retry}>
        Try again
      </Button>
    </Card>
  );
}
export function Shell({ children }: { children: ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>{children}</View>
  );
}
