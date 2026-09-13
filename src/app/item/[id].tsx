import { withSession } from "../../components/SessionGate";
import { useMemo, useState } from "react";
import { View, Text, useWindowDimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  doc,
  setDoc,
  deleteDoc,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { ShieldCheck, Bookmark, LockKeyhole } from "lucide-react-native";
import { Report } from "../../../shared/domain";
import { useDocument, useCollection } from "../../lib/data";
import { useAuth } from "../../lib/auth-context";
import { db } from "../../lib/firebase";
import { mutate, errorMessage } from "../../lib/api";
import { ReportPhoto, formatDate } from "../../components/ItemCard";
import {
  Page,
  Card,
  Button,
  Badge,
  Field,
  Select,
  Check,
  Feedback,
  Loading,
  QueryError,
  Empty,
  s,
  palette,
} from "../../components/ui";

function ItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const report = useDocument<Report>("reports", id);
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const wide = useWindowDimensions().width >= 850;
  const bookmarks = useCollection<{ id: string }>(
    "savedItems",
    useMemo(
      () => [
        where("userId", "==", user?.uid ?? ""),
        where("reportId", "==", id),
      ],
      [id, user?.uid],
    ),
    !!user,
  );
  const own = report.data?.authorId === user?.uid;
  const secret = useDocument<{ privateDetails: string }>(
    "reportPrivate",
    own || isAdmin ? id : null,
  );
  const lostReports = useCollection<Report>(
    "reports",
    useMemo(
      () => [
        where("authorId", "==", user?.uid ?? ""),
        orderBy("createdAt", "desc"),
        limit(100),
      ],
      [user?.uid],
    ),
    !!user,
  );
  const [claiming, setClaiming] = useState(false);
  const [answers, setAnswers] = useState("");
  const [circumstances, setCircumstances] = useState("");
  const [linked, setLinked] = useState("No previous report");
  const [accepted, setAccepted] = useState(false);
  const [closing, setClosing] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function execute(work: () => Promise<void>) {
    setError("");
    setBusy(true);
    try {
      await work();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  if (report.loading) return <Loading />;
  if (report.error)
    return (
      <Page title="Couldn’t open this report">
        <QueryError error={report.error} retry={report.retry} />
      </Page>
    );
  if (!report.data)
    return (
      <Page title="Report unavailable">
        <Empty
          title="This report could not be found"
          detail="It may have been closed or may belong to the earlier version of the service."
        >
          <Button onPress={() => router.push("/")}>Browse reports</Button>
        </Empty>
      </Page>
    );
  const item = report.data;
  const availableLost = lostReports.data.filter(
    (r) => r.type === "lost" && r.state === "open",
  );
  return (
    <Page title={item.title} eyebrow="Item report">
      <Feedback text={error} />
      <View style={{ flexDirection: wide ? "row" : "column", gap: 24 }}>
        <View style={{ flex: 1.4, gap: 20 }}>
          <Card>
            <ReportPhoto report={item} large />
            <View style={s.row}>
              <Badge tone={item.type === "found" ? "green" : "gold"}>
                {item.type === "found" ? "Found item" : "Lost item"}
              </Badge>
              <Badge tone="gray">{item.state}</Badge>
              <Badge>{item.category}</Badge>
            </View>
            <Text style={s.body}>{item.description}</Text>
            <View style={s.separator} />
            {[
              ["Location", item.location],
              ["Nearby", item.locationDetail],
              [
                "Date",
                formatDate(item.eventDate) +
                  (item.approximateDate ? " · approximate" : ""),
              ],
              ["Brand / model", item.brand],
              ["Color", item.color],
            ]
              .filter(([, v]) => v)
              .map(([label, value]) => (
                <View
                  key={label}
                  style={[s.row, { justifyContent: "space-between" }]}
                >
                  <Text style={s.label}>{label}</Text>
                  <Text style={[s.body, { flexShrink: 1 }]}>{value}</Text>
                </View>
              ))}
          </Card>
          {(own || isAdmin) && (
            <Card>
              <View style={s.row}>
                <LockKeyhole size={21} color={palette.blue} />
                <Text style={s.h2}>Private reference details</Text>
              </View>
              {secret.error ? (
                <Feedback text={secret.error} />
              ) : (
                <Text style={s.body}>
                  {secret.data?.privateDetails || "Loading private details…"}
                </Text>
              )}
              <Text style={s.small}>
                Visible only to the report author and authorized administrators.
              </Text>
            </Card>
          )}
        </View>
        <View style={{ flex: 1, gap: 20 }}>
          <Card>
            <ShieldCheck size={30} color={palette.blue} />
            <Text style={s.h2}>
              {own
                ? "Your report"
                : item.type === "found"
                  ? "Could this be yours?"
                  : "Have you found this item?"}
            </Text>
            <Text style={s.body}>
              {own
                ? "Follow your claims and possible matches from My activity."
                : item.type === "found"
                  ? "Describe details that were not shown publicly. The finder or an administrator will review your claim."
                  : "Create a found report with your own observations and private clues. The owner can then claim it through a verified process."}
            </Text>
            {own ? (
              <>
                <Button onPress={() => router.push("/profile")}>
                  Open my activity
                </Button>
                {["open", "draft"].includes(item.state) && (
                  <Button
                    tone="secondary"
                    onPress={() =>
                      router.push({ pathname: "/post", params: { id } })
                    }
                  >
                    Edit report
                  </Button>
                )}
                {["open", "draft"].includes(item.state) && (
                  <Button tone="quiet" onPress={() => setClosing((v) => !v)}>
                    Close this report
                  </Button>
                )}
              </>
            ) : item.type === "found" ? (
              <Button
                disabled={item.state !== "open"}
                onPress={() => setClaiming((v) => !v)}
              >
                {item.state === "open"
                  ? claiming
                    ? "Hide claim form"
                    : "Start an ownership claim"
                  : "This item is " + item.state}
              </Button>
            ) : (
              <Button
                onPress={() =>
                  router.push({ pathname: "/post", params: { type: "found" } })
                }
              >
                Report what I found
              </Button>
            )}
            {!own && (
              <Button
                tone="secondary"
                disabled={busy || !!bookmarks.error}
                icon={<Bookmark size={18} color={palette.blue} />}
                onPress={() =>
                  execute(async () => {
                    const r = doc(db, "savedItems", user!.uid + "_" + id);
                    if (bookmarks.data.length) await deleteDoc(r);
                    else
                      await setDoc(r, {
                        userId: user!.uid,
                        reportId: id,
                        createdAt: serverTimestamp(),
                      });
                  })
                }
              >
                {bookmarks.data.length
                  ? "Remove from saved"
                  : "Save this report"}
              </Button>
            )}
            <Feedback text={bookmarks.error} />
            {item.requiresAdmin && (
              <Text style={s.small}>
                This item requires administrative ownership review.
              </Text>
            )}
          </Card>
          {closing && (
            <Card>
              <Text style={s.h2}>Close without verified recovery</Text>
              <Text style={s.body}>
                Use this when the report is no longer needed or the item was
                returned outside this service. It will not count as a verified
                recovery.
              </Text>
              <Field
                label="Reason for closing"
                value={reason}
                onChangeText={setReason}
                multiline
              />
              <Button
                tone="danger"
                busy={busy}
                onPress={() =>
                  execute(async () => {
                    await mutate("closeReport", { id, note: reason });
                    setClosing(false);
                  })
                }
              >
                Confirm close
              </Button>
            </Card>
          )}
          {claiming && (
            <Card>
              <Text style={s.h2}>Make your ownership claim</Text>
              <Field
                label="Private identifying details"
                value={answers}
                onChangeText={setAnswers}
                multiline
                maxLength={2000}
                placeholder="Describe unique marks, an inscription, or other details only the owner would know."
                hint="Do not include passwords or device unlock codes."
              />
              <Field
                label="Where and how did you lose it?"
                value={circumstances}
                onChangeText={setCircumstances}
                multiline
                maxLength={1500}
              />
              <Select
                label="Link your lost report (optional)"
                value={linked}
                options={[
                  "No previous report",
                  ...availableLost.map((r) => r.title + " · " + r.id),
                ]}
                onChange={setLinked}
              />
              <Text style={s.small}>
                After submitting, you can upload earlier photos or receipts.
                Evidence images are visible only to you and administrators; the
                finder sees your written claim.
              </Text>
              <Check
                label="These details are accurate to the best of my knowledge, and I understand that this claim will be reviewed."
                value={accepted}
                onChange={setAccepted}
              />
              <Button
                busy={busy}
                disabled={!accepted}
                onPress={() =>
                  execute(async () => {
                    const linkedReport = availableLost.find(
                      (r) => r.title + " · " + r.id === linked,
                    );
                    const result = await mutate("submitClaim", {
                      reportId: id,
                      answers,
                      circumstances,
                      lostReportId: linkedReport?.id ?? null,
                    });
                    router.push(("/claim/" + result.id) as any);
                  })
                }
              >
                Submit claim
              </Button>
            </Card>
          )}
        </View>
      </View>
    </Page>
  );
}

export default withSession(ItemDetail);
