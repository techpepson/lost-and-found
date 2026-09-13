import { withSession } from "../components/SessionGate";
import { useEffect, useMemo, useState } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import {
  collection,
  getCountFromServer,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { Claim, Report, Dispute } from "../../shared/domain";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth-context";
import { useCollection } from "../lib/data";
import { mutate, errorMessage } from "../lib/api";
import {
  Page,
  SectionTabs,
  Card,
  Button,
  Badge,
  Field,
  Feedback,
  Empty,
  Loading,
  QueryError,
  s,
  palette,
} from "../components/ui";

interface Member {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  verified: boolean;
  suspended?: boolean;
}
function Admin() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState("Review queue");
  const [size, setSize] = useState(30);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [statsError, setStatsError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<{
    kind: "report" | "user";
    id: string;
    label: string;
    suspended?: boolean;
  } | null>(null);
  const [note, setNote] = useState("");
  const [revision, setRevision] = useState(0);
  const claims = useCollection<Claim>(
    "claims",
    useMemo(
      () => [
        where("requiresAdmin", "==", true),
        where("state", "in", [
          "submitted",
          "under_review",
          "needs_information",
        ]),
        orderBy("createdAt", "desc"),
        limit(size),
      ],
      [size],
    ),
    isAdmin && tab === "Review queue",
  );
  const disputes = useCollection<Dispute>(
    "disputes",
    useMemo(
      () => [
        where("state", "==", "open"),
        orderBy("createdAt", "desc"),
        limit(size),
      ],
      [size],
    ),
    isAdmin && tab === "Disputes",
  );
  const reports = useCollection<Report>(
    "reports",
    useMemo(() => [orderBy("updatedAt", "desc"), limit(size)], [size]),
    isAdmin && tab === "Reports",
  );
  const users = useCollection<Member>(
    "users",
    useMemo(() => [orderBy("updatedAt", "desc"), limit(size)], [size]),
    isAdmin && tab === "Users",
  );
  const current =
    tab === "Review queue"
      ? claims
      : tab === "Disputes"
        ? disputes
        : tab === "Reports"
          ? reports
          : users;
  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    setStatsError("");
    const cutoff = Date.now() - 30 * 86400000;
    Promise.all([
      getCountFromServer(
        query(collection(db, "reports"), where("state", "==", "open")),
      ),
      getCountFromServer(
        query(collection(db, "recoveries"), where("completedAt", ">=", cutoff)),
      ),
      getCountFromServer(
        query(
          collection(db, "claims"),
          where("requiresAdmin", "==", true),
          where("state", "in", [
            "submitted",
            "under_review",
            "needs_information",
          ]),
        ),
      ),
      getCountFromServer(
        query(collection(db, "disputes"), where("state", "==", "open")),
      ),
    ])
      .then((values) => {
        if (active)
          setStats(
            Object.fromEntries(
              [
                "Open reports",
                "Verified returns · 30 days",
                "Claims awaiting admin",
                "Open disputes",
              ].map((key, i) => [key, values[i].data().count]),
            ),
          );
      })
      .catch((e) => {
        if (active) setStatsError(errorMessage(e));
      });
    return () => {
      active = false;
    };
  }, [isAdmin, revision]);
  async function moderate() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await mutate(
        selected.kind === "report" ? "moderateReport" : "setUserSuspended",
        selected.kind === "report"
          ? { id: selected.id, note }
          : { userId: selected.id, suspended: !selected.suspended, note },
      );
      setSelected(null);
      setNote("");
      setRevision((v) => v + 1);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  if (!isAdmin)
    return (
      <Page title="Administrator access required">
        <Empty
          title="This workspace is restricted"
          detail="Administrative privileges are assigned by the operator, never through a profile setting."
        >
          <Button onPress={() => router.push("/")}>Back to browse</Button>
        </Empty>
      </Page>
    );
  return (
    <Page
      title="Admin"
      eyebrow="Administrator workspace"
      subtitle="Review claims and keep collections on track."
      actions={
        <Button
          tone="secondary"
          onPress={() => {
            current.retry();
            setRevision((v) => v + 1);
          }}
        >
          Refresh overview
        </Button>
      }
    >
      <Feedback text={statsError} />
      <View style={[s.row, { alignItems: "stretch" }]}>
        {Object.entries(stats).map(([label, count]) => (
          <View key={label} style={{ flex: 1, minWidth: 120 }}>
            <Card>
              <Text
                style={{ fontSize: 32, color: palette.navy, fontWeight: "700" }}
              >
                {count}
              </Text>
              <Text style={s.small}>{label}</Text>
            </Card>
          </View>
        ))}
      </View>
      <Text style={s.small}>
        Returns count unique completed handovers, not both linked reports. The
        30-day window is based on completion time. Closed reports are not
        counted as verified returns.
      </Text>
      <SectionTabs
        options={["Review queue", "Disputes", "Reports", "Users"]}
        value={tab}
        onChange={(label) => {
          setTab(label);
          setSize(30);
          setSelected(null);
        }}
      />
      <Feedback text={error} />
      {selected && (
        <Card>
          <Text style={s.h2}>
            {selected.kind === "report"
              ? "Archive report"
              : selected.suspended
                ? "Restore account access"
                : "Suspend account"}
          </Text>
          <Text style={s.body}>{selected.label}</Text>
          <Field
            label="Reason for the audit record"
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={1000}
          />
          <View style={s.row}>
            <Button tone="danger" busy={busy} onPress={() => void moderate()}>
              Confirm action
            </Button>
            <Button
              tone="secondary"
              disabled={busy}
              onPress={() => setSelected(null)}
            >
              Cancel
            </Button>
          </View>
        </Card>
      )}
      {current.loading ? (
        <Loading />
      ) : current.error ? (
        <QueryError error={current.error} retry={current.retry} />
      ) : !current.data.length ? (
        <Empty
          title="Nothing in this queue"
          detail="New records requiring attention will appear here."
        />
      ) : null}
      {tab === "Review queue" &&
        claims.data.map((c) => (
          <Card key={c.id}>
            <View style={[s.row, { justifyContent: "space-between" }]}>
              <Text style={s.h2}>{c.reportTitle}</Text>
              <Badge>{c.state}</Badge>
            </View>
            <Text style={s.small}>
              {c.evidencePaths.length} private evidence image(s) · Review
              private clues before deciding.
            </Text>
            <Button onPress={() => router.push(("/claim/" + c.id) as any)}>
              Review claim
            </Button>
          </Card>
        ))}
      {tab === "Disputes" &&
        disputes.data.map((d) => (
          <Card key={d.id}>
            <Badge tone="red">Open dispute</Badge>
            <Text style={s.body}>{d.reason}</Text>
            <Button onPress={() => router.push(("/claim/" + d.claimId) as any)}>
              Review dispute and case history
            </Button>
          </Card>
        ))}
      {tab === "Reports" &&
        reports.data.map((r) => (
          <Card key={r.id}>
            <View style={[s.row, { justifyContent: "space-between" }]}>
              <Text style={s.h2}>{r.title}</Text>
              <Badge tone="gray">{r.state}</Badge>
            </View>
            <Text style={s.small}>
              {r.type} · {r.category} · {r.location}
            </Text>
            <View style={s.row}>
              <Button
                tone="secondary"
                onPress={() => router.push(("/item/" + r.id) as any)}
              >
                View report
              </Button>
              <Button
                disabled={!!r.activeClaimId || r.state === "recovered"}
                tone="quiet"
                onPress={() => {
                  setSelected({ kind: "report", id: r.id, label: r.title });
                  setNote("");
                }}
              >
                Archive with reason
              </Button>
            </View>
          </Card>
        ))}
      {tab === "Users" &&
        users.data.map((u) => (
          <Card key={u.id}>
            <View style={[s.row, { justifyContent: "space-between" }]}>
              <Text style={s.h2}>{u.displayName || "Community member"}</Text>
              <Badge tone={u.suspended ? "red" : "green"}>
                {u.suspended ? "Suspended" : "Active"}
              </Badge>
            </View>
            <Text style={s.body}>{u.email}</Text>
            <Text style={s.small}>
              {u.verified ? "Email verified" : "Email unverified"}
            </Text>
            <Button
              tone="secondary"
              onPress={() => {
                setSelected({
                  kind: "user",
                  id: u.uid,
                  label: u.email,
                  suspended: u.suspended,
                });
                setNote("");
              }}
            >
              {u.suspended ? "Restore access" : "Suspend access"}
            </Button>
          </Card>
        ))}
      {current.data.length === size && (
        <Button tone="secondary" onPress={() => setSize((v) => v + 30)}>
          Load more
        </Button>
      )}
    </Page>
  );
}

export default withSession(Admin);
