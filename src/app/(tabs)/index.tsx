import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  QueryDocumentSnapshot,
  QueryConstraint,
} from "firebase/firestore";
import {
  Search,
  Plus,
  SlidersHorizontal,
  ShieldCheck,
} from "lucide-react-native";
import {
  CATEGORIES,
  LOCATIONS,
  Report,
  ReportType,
} from "../../../shared/domain";
import { db } from "../../lib/firebase";
import { errorMessage } from "../../lib/api";
import { ItemCard } from "../../components/ItemCard";
import {
  Page,
  Card,
  Field,
  Select,
  DateField,
  Button,
  Empty,
  Loading,
  Feedback,
  s,
  palette,
} from "../../components/ui";

export default function Browse() {
  const router = useRouter();
  const width = useWindowDimensions().width;
  const columns = width >= 1000 ? 3 : width >= 650 ? 2 : 1;
  const [type, setType] = useState<ReportType>("found");
  const [category, setCategory] = useState("All categories");
  const [location, setLocation] = useState("All locations");
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [items, setItems] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const cursor = useRef<QueryDocumentSnapshot | null>(null);
  const generation = useRef(0);
  useEffect(() => {
    const timer = setTimeout(
      () =>
        setTerm(
          search
            .toLowerCase()
            .replace(/[^a-z0-9 ]/g, " ")
            .trim()
            .split(/\s+/)[0]
            ?.slice(0, 24) || "",
        ),
      350,
    );
    return () => clearTimeout(timer);
  }, [search]);
  const constraints = useMemo(() => {
    const c: QueryConstraint[] = [
      where("state", "==", "open"),
      where("type", "==", type),
    ];
    if (category !== "All categories")
      c.push(where("category", "==", category));
    if (location !== "All locations") c.push(where("location", "==", location));
    if (from) c.push(where("eventDate", ">=", from));
    if (to) c.push(where("eventDate", "<=", to));
    if (term.length >= 2) c.push(where("searchTokens", "array-contains", term));
    c.push(orderBy("eventDate", "desc"), orderBy("createdAt", "desc"));
    return c;
  }, [type, category, location, from, to, term]);
  async function fetchPage(reset: boolean, run: number) {
    setLoading(true);
    setError("");
    try {
      if (from && to && from > to)
        throw new Error("The start date must be before the end date.");
      const snap = await getDocs(
        query(
          collection(db, "reports"),
          ...constraints,
          ...(!reset && cursor.current ? [startAfter(cursor.current)] : []),
          limit(18),
        ),
      );
      if (generation.current !== run) return;
      const rows = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Report);
      setItems((previous) =>
        reset
          ? rows
          : [
              ...previous,
              ...rows.filter((r) => !previous.some((p) => p.id === r.id)),
            ],
      );
      cursor.current = snap.docs.at(-1) ?? null;
      setMore(snap.size === 18);
    } catch (e) {
      if (generation.current === run) setError(errorMessage(e));
    } finally {
      if (generation.current === run) setLoading(false);
    }
  }
  useEffect(() => {
    const run = ++generation.current;
    cursor.current = null;
    setItems([]);
    void fetchPage(true, run);
    return () => {
      generation.current++;
    };
  }, [constraints, revision]);
  return (
    <Page
      title="Around campus"
      subtitle="Find your things. Help return someone else’s."
    >
      <View
        style={{
          flexDirection: "row",
          backgroundColor: "#E9EDE4",
          padding: 4,
          borderRadius: 12,
        }}
      >
        {(["found", "lost"] as const).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected: type === value }}
            onPress={() => setType(value)}
            style={{
              flex: 1,
              minHeight: 46,
              justifyContent: "center",
              alignItems: "center",
              borderRadius: 9,
              backgroundColor: type === value ? "white" : "transparent",
            }}
          >
            <Text
              style={{
                color: type === value ? palette.blue : palette.muted,
                fontSize: 15,
                fontWeight: "600",
              }}
            >
              {value === "found" ? "Found items" : "Lost items"}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={{ gap: 14 }}>
        <Field
          label="Search items"
          value={search}
          onChangeText={setSearch}
          placeholder="Try phone, keys, or a brand…"
          hint="One keyword works best — try a brand or item name."
        />
        <View style={[s.row, { justifyContent: "space-between" }]}>
          <Button
            small
            tone="secondary"
            icon={<SlidersHorizontal size={17} color={palette.blue} />}
            onPress={() => setAdvanced((v) => !v)}
          >
            {advanced ? "Hide filters" : "Filters"}
          </Button>
          <Text style={s.small}>
            {category !== "All categories" ? category : "All categories"}
          </Text>
        </View>
        {advanced && (
          <Card>
            <Select
              label="Category"
              value={category}
              options={["All categories", ...CATEGORIES]}
              onChange={setCategory}
            />
            <View style={[s.row, { alignItems: "flex-start" }]}>
              <View style={{ flex: 2, minWidth: 210 }}>
                <Select
                  label="Campus location"
                  value={location}
                  options={["All locations", ...LOCATIONS]}
                  onChange={setLocation}
                />
              </View>
              <View style={{ flex: 1, minWidth: 150 }}>
                <DateField label="From date" value={from} onChange={setFrom} />
              </View>
              <View style={{ flex: 1, minWidth: 150 }}>
                <DateField label="To date" value={to} onChange={setTo} />
              </View>
            </View>
            <Button
              small
              tone="quiet"
              onPress={() => {
                setCategory("All categories");
                setLocation("All locations");
                setFrom("");
                setTo("");
                setSearch("");
              }}
            >
              Clear all filters
            </Button>
          </Card>
        )}
      </View>
      <View style={[s.row, { justifyContent: "space-between" }]}>
        <Text style={s.h2}>
          {type === "found" ? "Found around campus" : "Still missing"}
        </Text>
        <Text style={s.small}>Newest first</Text>
      </View>
      {error && (
        <Card>
          <Feedback text={error} />
          <Button tone="secondary" onPress={() => setRevision((v) => v + 1)}>
            Try again
          </Button>
        </Card>
      )}
      {!loading && !error && !items.length && (
        <Empty
          title="No reports here yet"
          detail="Try a different search or report your item. We’ll let you know when a possible match appears."
        >
          <Button
            onPress={() =>
              router.push({
                pathname: "/post",
                params: { type: type === "found" ? "lost" : "found" },
              })
            }
          >
            Create a report
          </Button>
        </Empty>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", margin: -8 }}>
        {items.map((item) => (
          <View
            key={item.id}
            style={{ width: (100 / columns + "%") as `${number}%`, padding: 8 }}
          >
            <ItemCard
              item={item}
              onPress={() => router.push(("/item/" + item.id) as any)}
            />
          </View>
        ))}
      </View>
      {loading && <Loading />}
      {!loading && more && items.length > 0 && (
        <Button
          tone="secondary"
          onPress={() => void fetchPage(false, generation.current)}
        >
          Load more reports
        </Button>
      )}
      <View
        style={[
          s.row,
          {
            flexWrap: "nowrap",
            backgroundColor: "#EAF0E7",
            padding: 18,
            borderRadius: 12,
          },
        ]}
      >
        <ShieldCheck color={palette.blue} size={24} />
        <Text style={[s.small, { flex: 1 }]}>
          A similar item is a starting point. Ownership is checked privately
          before every confirmed handover.
        </Text>
      </View>
    </Page>
  );
}
