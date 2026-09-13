import { withSession } from "../../components/SessionGate";
import { chooseImage } from "../../lib/pick-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { limit, orderBy, where } from "firebase/firestore";
import {
  CheckCircle2,
  Clock,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Image, Text, useWindowDimensions, View } from "react-native";
import { AuditEvent, Claim, Dispute, Handover } from "../../../shared/domain";
import { formatDate } from "../../components/ItemCard";
import {
  Badge,
  Button,
  Card,
  Check,
  DateField,
  Empty,
  Feedback,
  Field,
  Loading,
  Page,
  palette,
  QueryError,
  s,
  Select,
} from "../../components/ui";
import {
  errorMessage,
  mutate,
  uploadImage,
  useProtectedImage,
} from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { useCollection, useDocument } from "../../lib/data";

function EvidenceImage({ path }: { path: string }) {
  const { uri, error } = useProtectedImage(path);
  return (
    <View style={{ gap: 8 }}>
      {uri ? (
        <Image
          accessibilityLabel="Private ownership evidence"
          source={{ uri }}
          style={{
            width: "100%",
            height: 260,
            backgroundColor: "#F7F8F3",
            borderRadius: 8,
          }}
          resizeMode="contain"
        />
      ) : error ? (
        <Text style={s.small}>
          Evidence unavailable or removed under the retention policy.
        </Text>
      ) : (
        <Loading />
      )}
    </View>
  );
}
function CaseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const wide = useWindowDimensions().width >= 900;
  const claim = useDocument<Claim>("claims", id);
  const handover = useDocument<Handover>("handovers", claim.data ? id : null);
  const privateReport = useDocument<{ privateDetails: string }>(
    "reportPrivate",
    claim.data && (isAdmin || claim.data.finderId === user?.uid)
      ? claim.data.reportId
      : null,
  );
  const dispute = useDocument<Dispute>(
    "disputes",
    claim.data?.state === "disputed" ? id : null,
  );
  const [historyLimit, setHistoryLimit] = useState(50);
  const history = useCollection<AuditEvent>(
    "auditEvents",
    useMemo(
      () => [
        where("caseId", "==", id),
        ...(isAdmin
          ? []
          : [where("participantIds", "array-contains", user?.uid ?? "")]),
        orderBy("createdAt", "asc"),
        limit(historyLimit),
      ],
      [id, isAdmin, user?.uid, historyLimit],
    ),
    !!claim.data,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");
  const [decision, setDecision] = useState("needs_information");
  const [answers, setAnswers] = useState("");
  const [circumstances, setCircumstances] = useState("");
  const [location, setLocation] = useState("");
  const [time, setTime] = useState("");
  const [code, setCode] = useState("");
  const [issued, setIssued] = useState<{
    code: string;
    expiresAt: number;
  } | null>(null);
  const [physical, setPhysical] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [reason, setReason] = useState("");
  const [resolution, setResolution] = useState("resume");
  const [tick, setTick] = useState(Date.now());
  useEffect(() => {
    if (claim.data) {
      setAnswers(claim.data.answers);
      setCircumstances(claim.data.circumstances);
    }
  }, [claim.data?.answers, claim.data?.circumstances]);
  useEffect(() => {
    if (!issued) return;
    const timer = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [issued]);
  async function work(
    task: () => Promise<void>,
    success = "Your case has been updated.",
  ) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await task();
      setMessage(success);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function action(
    name: string,
    data: Record<string, unknown> = {},
    success?: string,
  ) {
    return work(async () => {
      await mutate(name, { id, ...data });
    }, success);
  }
  async function addEvidence() {
    setError("");
    let uri: string | null;
    try {
      uri = await chooseImage();
    } catch (e) {
      setError(errorMessage(e));
      return;
    }
    if (!uri) return;
    await work(async () => {
      const path = await uploadImage(uri, user!.uid, id);
      await mutate("attachEvidence", { id, path });
    }, "Evidence uploaded. Only you and administrators can view the image.");
  }
  if (claim.loading) return <Loading />;
  if (claim.error)
    return (
      <Page title="Couldn’t open this case">
        <QueryError error={claim.error} retry={claim.retry} />
      </Page>
    );
  if (!claim.data)
    return (
      <Page title="Claim unavailable">
        <Empty
          title="We couldn’t open this case"
          detail="Check the link or return to your activity."
        />
      </Page>
    );
  const c = claim.data;
  const h = handover.data;
  const owner = c.claimantId === user?.uid;
  const finder = c.finderId === user?.uid;
  const pending = ["submitted", "under_review", "needs_information"].includes(
    c.state,
  );
  const reviewer =
    !owner && (isAdmin || finder) && (!c.requiresAdmin || (isAdmin && !finder));
  const participant = owner || finder;
  const completed = h?.state === "completed";
  const stages = [
    "Claim submitted",
    "Ownership reviewed",
    "Collection arranged",
    "Return confirmed",
  ];
  const stage = completed
    ? 4
    : h?.state === "code_verified" || h?.state === "awaiting_confirmation"
      ? 3
      : h?.state === "scheduled"
        ? 2
        : c.state === "approved"
          ? 1
          : 0;
  return (
    <Page
      title={c.reportTitle}
      eyebrow="Recovery case"
      subtitle={"Case " + id.slice(0, 10).toUpperCase()}
    >
      <Feedback text={error} />
      <Feedback text={message} success />
      <View style={s.row}>
        <Badge
          tone={completed ? "green" : c.state === "disputed" ? "red" : "blue"}
        >
          {completed ? "Recovered" : c.state}
        </Badge>
        {c.requiresAdmin && <Badge tone="gold">Administrator review</Badge>}
        <Text style={s.small}>
          {owner
            ? "You are the claimant"
            : finder
              ? "You are the finder"
              : "Administrative review"}
        </Text>
      </View>
      <View style={{ gap: 10 }}>
        <Text style={s.label}>
          {completed
            ? "Return confirmed"
            : [
                "Claim review",
                "Arrange collection",
                "Verify collection",
                "Confirm return",
              ][Math.min(stage, 3)]}
        </Text>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {stages.map((label, i) => (
            <View
              key={label}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                backgroundColor: i <= stage ? palette.blue : palette.line,
              }}
            />
          ))}
        </View>
      </View>
      <View style={{ flexDirection: wide ? "row" : "column", gap: 24 }}>
        <View style={{ flex: 1.2, gap: 20 }}>
          <Card>
            <View style={s.row}>
              <LockKeyhole color={palette.blue} size={22} />
              <Text style={s.h2}>Ownership claim</Text>
            </View>
            <Text style={s.label}>Private identifying details</Text>
            <Text style={s.body}>{c.answers}</Text>
            <Text style={s.label}>Circumstances of loss</Text>
            <Text style={s.body}>{c.circumstances}</Text>
            {c.lostReportId && (
              <Button
                tone="quiet"
                onPress={() => router.push(("/item/" + c.lostReportId) as any)}
              >
                View linked lost report
              </Button>
            )}
            <Button
              tone="secondary"
              onPress={() => router.push(("/item/" + c.reportId) as any)}
            >
              View found report
            </Button>
            {c.reviewNote && (
              <>
                <View style={s.separator} />
                <Text style={s.label}>Latest review note</Text>
                <Text style={s.body}>{c.reviewNote}</Text>
              </>
            )}
          </Card>
          {(finder || isAdmin) && (
            <Card>
              <Text style={s.h2}>Finder’s recorded reference</Text>
              <Feedback text={privateReport.error} />
              <Text style={s.body}>
                {privateReport.data?.privateDetails || "Loading…"}
              </Text>
              <Text style={s.small}>
                Compare this pre-existing reference with the claimant’s
                independently supplied details. Never approve from a match score
                alone.
              </Text>
            </Card>
          )}
          <Card>
            <Text style={s.h2}>Supporting evidence</Text>
            <Text style={s.body}>
              Earlier photographs, redacted receipts, or identifying marks can
              support a claim. Never upload passwords, banking details or device
              unlock codes.
            </Text>
            {owner || isAdmin ? (
              c.evidencePaths.map((path) => (
                <EvidenceImage key={path} path={path} />
              ))
            ) : (
              <Text style={s.small}>
                {c.evidencePaths.length} evidence image(s). Original files are
                restricted to the claimant and administrators.
              </Text>
            )}
            {!c.evidencePaths.length && (
              <Text style={s.small}>
                No evidence images attached. Evidence can also be established
                through private characteristics and review.
              </Text>
            )}
            {owner && pending && (
              <Button
                busy={busy}
                disabled={c.evidencePaths.length >= 5}
                tone="secondary"
                onPress={() => void addEvidence()}
              >
                Add evidence image
              </Button>
            )}
          </Card>
          {owner && c.state === "needs_information" && (
            <Card>
              <Text style={s.h2}>Provide more information</Text>
              <Field
                label="Updated private description"
                value={answers}
                onChangeText={setAnswers}
                multiline
                maxLength={2000}
              />
              <Field
                label="Updated circumstances"
                value={circumstances}
                onChangeText={setCircumstances}
                multiline
                maxLength={1500}
              />
              <Button
                busy={busy}
                onPress={() =>
                  void action("provideInformation", { answers, circumstances })
                }
              >
                Resubmit for review
              </Button>
            </Card>
          )}
          {reviewer && pending && (
            <Card>
              <Text style={s.h2}>Review ownership</Text>
              <Text style={s.body}>
                A verified account identifies a user. Ownership still requires
                convincing private details or evidence. Escalate if the evidence
                conflicts.
              </Text>
              <Select
                label="Decision"
                value={decision}
                options={[
                  "under_review",
                  "needs_information",
                  "approved",
                  "rejected",
                ]}
                onChange={setDecision}
              />
              <Field
                label="Reason or information required"
                value={note}
                onChangeText={setNote}
                multiline
                maxLength={1000}
                hint="This note is shared with the claimant. Do not reveal the correct private answers."
              />
              <Button
                busy={busy}
                onPress={() => void action("reviewClaim", { decision, note })}
              >
                Save review decision
              </Button>
            </Card>
          )}
          {finder && c.requiresAdmin && !isAdmin && pending && (
            <Card>
              <ShieldCheck color={palette.blue} />
              <Text style={s.h2}>An administrator will review this claim</Text>
              <Text style={s.body}>
                Sensitive items and competing claims need an independent review
                before collection.
              </Text>
            </Card>
          )}
          {c.state === "disputed" && (
            <Card>
              <Text style={s.h2}>Dispute under review</Text>
              <Feedback text={dispute.error} />
              <Text style={s.body}>{dispute.data?.reason}</Text>
              <Text style={s.small}>
                Completion is paused. The reservation stays in place while an
                administrator reviews the case.
              </Text>
              {isAdmin && !participant && (
                <>
                  <Select
                    label="Resolution"
                    value={resolution}
                    options={["resume", "cancel"]}
                    onChange={setResolution}
                  />
                  <Field
                    label="Resolution and supporting reasons"
                    value={note}
                    onChangeText={setNote}
                    multiline
                  />
                  <Button
                    busy={busy}
                    onPress={() =>
                      void action("resolveDispute", { resolution, note })
                    }
                  >
                    Record resolution
                  </Button>
                </>
              )}
            </Card>
          )}
        </View>
        <View style={{ flex: 1, gap: 20 }}>
          {handover.error && (
            <QueryError error={handover.error} retry={handover.retry} />
          )}
          {h && c.state === "approved" && (
            <Card>
              <View style={s.row}>
                <CheckCircle2 color={palette.green} />
                <Text style={s.h2}>
                  {completed
                    ? "Returned and confirmed"
                    : "Your secure handover"}
                </Text>
              </View>
              <Badge tone={completed ? "green" : "blue"}>{h.state}</Badge>
              {completed ? (
                <Text style={s.body}>
                  Both the finder and owner confirmed the physical transfer.
                  This case is recorded as one verified recovery.
                </Text>
              ) : (
                <>
                  <Text style={s.small}>
                    Choose a public campus meeting place. No location listed by
                    the app is represented as a staffed collection desk.
                  </Text>
                  {h.location && (
                    <>
                      <Text style={s.label}>{h.location}</Text>
                      <Text style={s.body}>
                        {new Date(h.scheduledAt).toLocaleString("en-GB")}
                      </Text>
                      <Text style={s.small}>
                        {h.scheduleAccepted
                          ? "Collection details accepted by the owner."
                          : "Waiting for the owner to accept."}
                      </Text>
                    </>
                  )}
                  {finder && ["pending", "scheduled"].includes(h.state) && (
                    <>
                      <Field
                        label="Proposed collection place"
                        value={location}
                        onChangeText={setLocation}
                        placeholder="Public campus location and meeting point"
                        maxLength={200}
                      />
                      <DateField
                        label="Proposed collection time"
                        value={time}
                        onChange={setTime}
                        time
                      />
                      <Button
                        busy={busy}
                        onPress={() =>
                          void work(async () => {
                            const date = new Date(time);
                            if (!time || Number.isNaN(date.getTime()))
                              throw new Error(
                                "Choose a valid collection date and time.",
                              );
                            await mutate("scheduleHandover", {
                              id,
                              location,
                              scheduledAt: date.toISOString(),
                            });
                          })
                        }
                      >
                        {h.location
                          ? "Propose new details"
                          : "Propose collection"}
                      </Button>
                    </>
                  )}
                  {owner && h.state === "scheduled" && !h.scheduleAccepted && (
                    <Button
                      busy={busy}
                      onPress={() => void action("acceptSchedule")}
                    >
                      Accept collection details
                    </Button>
                  )}
                  {owner && h.state === "scheduled" && h.scheduleAccepted && (
                    <>
                      <Text style={s.small}>
                        Generate your code when you meet the finder. It lasts 10
                        minutes. Only share it at the agreed handover.
                      </Text>
                      {issued && (
                        <View
                          style={{
                            backgroundColor: "#EAF0E7",
                            padding: 22,
                            borderRadius: 12,
                            gap: 8,
                          }}
                        >
                          <Text
                            selectable
                            style={{
                              fontSize: 36,
                              fontWeight: "700",
                              letterSpacing: 7,
                              color: palette.navy,
                            }}
                          >
                            {tick < issued.expiresAt ? issued.code : "Expired"}
                          </Text>
                          <Text style={s.small}>
                            {Math.max(
                              0,
                              Math.ceil((issued.expiresAt - tick) / 1000),
                            )}{" "}
                            seconds remaining
                          </Text>
                        </View>
                      )}
                      <Button
                        busy={busy}
                        onPress={() =>
                          work(async () => {
                            const result = await mutate("issueCode", { id });
                            if (!result.code || !result.expiresAt)
                              throw new Error(
                                "A code was already issued. Request a replacement after one minute.",
                              );
                            setTick(Date.now());
                            setIssued({
                              code: result.code,
                              expiresAt: result.expiresAt,
                            });
                          }, "Show the code to the finder only when you meet.")
                        }
                      >
                        {issued
                          ? "Generate replacement code"
                          : "Generate collection code"}
                      </Button>
                    </>
                  )}
                  {finder && h.state === "scheduled" && h.scheduleAccepted && (
                    <>
                      <Field
                        label="Owner’s six-digit code"
                        value={code}
                        onChangeText={(v) =>
                          setCode(v.replace(/\D/g, "").slice(0, 6))
                        }
                        keyboardType="number-pad"
                        maxLength={6}
                      />
                      <Button
                        busy={busy}
                        onPress={() => void action("verifyCode", { code })}
                      >
                        Verify collection code
                      </Button>
                    </>
                  )}
                  {participant &&
                    ["code_verified", "awaiting_confirmation"].includes(
                      h.state,
                    ) && (
                      <>
                        <Text style={s.body}>
                          Code verified. Confirm only after the item has
                          physically changed hands.
                        </Text>
                        <Text style={s.small}>
                          Finder: {h.finderConfirmed ? "confirmed" : "waiting"}{" "}
                          · Owner: {h.ownerConfirmed ? "confirmed" : "waiting"}
                        </Text>
                        {!(owner ? h.ownerConfirmed : h.finderConfirmed) && (
                          <>
                            <Check
                              label={
                                owner
                                  ? "I have received my item."
                                  : "I have handed the item to the verified claimant."
                              }
                              value={physical}
                              onChange={setPhysical}
                            />
                            <Button
                              busy={busy}
                              disabled={!physical}
                              onPress={() => void action("confirmHandover")}
                            >
                              Confirm physical transfer
                            </Button>
                          </>
                        )}
                      </>
                    )}
                </>
              )}
            </Card>
          )}
          {participant && (
            <Card>
              <Text style={s.h2}>Need to change course?</Text>
              {owner && pending && (
                <Button
                  busy={busy}
                  tone="secondary"
                  onPress={() => void action("withdrawClaim")}
                >
                  Withdraw my claim
                </Button>
              )}
              {!["withdrawn", "disputed"].includes(c.state) && (
                <Button tone="quiet" onPress={() => setDisputing((v) => !v)}>
                  Report a problem or request cancellation
                </Button>
              )}
              {disputing && (
                <>
                  <Field
                    label="What happened?"
                    value={reason}
                    onChangeText={setReason}
                    multiline
                    maxLength={2000}
                    hint="Explain the issue in at least 20 characters. An administrator will review it."
                  />
                  <Button
                    tone="danger"
                    busy={busy}
                    onPress={() => void action("openDispute", { note: reason })}
                  >
                    Open dispute
                  </Button>
                </>
              )}
            </Card>
          )}
          <Card>
            <View style={s.row}>
              <Clock color={palette.blue} size={20} />
              <Text style={s.h2}>Case history</Text>
            </View>
            {history.loading ? (
              <Loading />
            ) : history.error ? (
              <Feedback text={history.error} />
            ) : (
              history.data.map((event) => (
                <View
                  key={event.id}
                  style={{
                    borderLeftWidth: 2,
                    borderColor: palette.line,
                    paddingLeft: 14,
                    gap: 4,
                  }}
                >
                  <Text style={s.label}>{event.note || event.action}</Text>
                  <Text style={s.small}>
                    {formatDate(event.createdAt)} ·{" "}
                    {new Date(event.createdAt).toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              ))
            )}
            {history.data.length === historyLimit && (
              <Button
                tone="quiet"
                onPress={() => setHistoryLimit((v) => v + 50)}
              >
                Show more history
              </Button>
            )}
          </Card>
        </View>
      </View>
    </Page>
  );
}

export default withSession(CaseDetail);
