import { useMemo, useState } from "react";
import { View, Text, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { where, orderBy, limit, deleteDoc, doc } from "firebase/firestore";
import { Report, Claim, Match } from "../../../shared/domain";
import { useAuth } from "../../lib/auth-context";
import { useCollection, useDocument } from "../../lib/data";
import { mutate, errorMessage } from "../../lib/api";
import { db } from "../../lib/firebase";
import { ItemCard } from "../../components/ItemCard";
import {
  Page,
  SectionTabs,
  Card,
  Button,
  Badge,
  Field,
  Feedback,
  Loading,
  QueryError,
  Empty,
  s,
  palette,
} from "../../components/ui";

function SavedReport({ id, bookmarkId }: { id: string; bookmarkId: string }) {
  const report = useDocument<Report>("reports", id);
  const router = useRouter();
  const [error, setError] = useState("");
  return report.data ? (
    <ItemCard
      item={report.data}
      onPress={() => router.push(("/item/" + id) as any)}
    />
  ) : report.loading ? (
    <Loading />
  ) : (
    <Card>
      <Text style={s.h2}>Saved report unavailable</Text>
      <Text style={s.small}>
        It may have been closed or removed from browsing.
      </Text>
      <Feedback text={error} />
      <Button
        tone="secondary"
        onPress={() => {
          void deleteDoc(doc(db, "savedItems", bookmarkId)).catch((e) =>
            setError(errorMessage(e)),
          );
        }}
      >
        Remove bookmark
      </Button>
    </Card>
  );
}
export default function Activity() {
  const { user, verified, isAdmin, logout } = useAuth();
  const router = useRouter();
  const width = useWindowDimensions().width;
  const columns = width >= 1000 ? 3 : width >= 650 ? 2 : 1;
  const [tab, setTab] = useState("My reports");
  const [pageSize, setPageSize] = useState(30);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState(user?.displayName ?? "");
  const [busy, setBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const reports = useCollection<Report>(
    "reports",
    useMemo(
      () => [
        where("authorId", "==", user?.uid ?? ""),
        orderBy("createdAt", "desc"),
        limit(pageSize),
      ],
      [user?.uid, pageSize],
    ),
    !!user && tab === "My reports",
  );
  const claims = useCollection<Claim>(
    "claims",
    useMemo(
      () => [
        where("participantIds", "array-contains", user?.uid ?? ""),
        orderBy("createdAt", "desc"),
        limit(pageSize),
      ],
      [user?.uid, pageSize],
    ),
    !!user && tab === "Claims & returns",
  );
  const matches = useCollection<Match>(
    "matches",
    useMemo(
      () => [
        where("participantIds", "array-contains", user?.uid ?? ""),
        orderBy("updatedAt", "desc"),
        limit(pageSize),
      ],
      [user?.uid, pageSize],
    ),
    !!user && tab === "Possible matches",
  );
  const saved = useCollection<{ id: string; reportId: string }>(
    "savedItems",
    useMemo(
      () => [where("userId", "==", user?.uid ?? ""), limit(pageSize)],
      [user?.uid, pageSize],
    ),
    !!user && tab === "Saved",
  );
  const current =
    tab === "My reports"
      ? reports
      : tab === "Claims & returns"
        ? claims
        : tab === "Possible matches"
          ? matches
          : saved;
  return (
    <Page
      title="My activity"
      eyebrow="My activity"
      subtitle="Your reports, claims and saved items."
    >
      <SectionTabs
        options={[
          "My reports",
          "Claims & returns",
          "Possible matches",
          "Saved",
          "Account",
        ]}
        value={tab}
        onChange={(label) => {
          setTab(label);
          setPageSize(30);
          setError("");
          setMessage("");
        }}
      />
      <Feedback text={error} />
      <Feedback text={message} success />
      {tab !== "Account" && current.loading && <Loading />}
      {tab !== "Account" && current.error && (
        <QueryError error={current.error} retry={current.retry} />
      )}
      {tab !== "Account" &&
        !current.loading &&
        !current.error &&
        !current.data.length && (
          <Empty
            title={
              {
                "My reports": "Your reports will appear here",
                "Claims & returns": "No claims to follow yet",
                "Possible matches": "No possible matches yet",
                Saved: "Nothing saved yet",
              }[tab] || "Nothing here yet"
            }
            detail={
              tab === "Possible matches"
                ? "Matching runs after reports are published. We’ll notify you when a possible connection appears."
                : "Browse items or add a report to get started."
            }
          >
            <Button tone="secondary" onPress={() => router.push("/")}>
              Browse items
            </Button>
          </Empty>
        )}
      {tab === "My reports" && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", margin: -8 }}>
          {reports.data.map((report) => (
            <View
              key={report.id}
              style={{
                width: (100 / columns + "%") as `${number}%`,
                padding: 8,
                gap: 8,
              }}
            >
              <ItemCard
                item={report}
                onPress={() =>
                  report.state === "draft"
                    ? router.push({
                        pathname: "/post",
                        params: { id: report.id },
                      })
                    : router.push(("/item/" + report.id) as any)
                }
              />
            </View>
          ))}
        </View>
      )}
      {tab === "Claims & returns" &&
        claims.data.map((claim) => (
          <Card key={claim.id}>
            <View style={[s.row, { justifyContent: "space-between" }]}>
              <Text style={s.h2}>{claim.reportTitle}</Text>
              <Badge tone={claim.state === "disputed" ? "red" : "blue"}>
                {claim.state}
              </Badge>
            </View>
            <Text style={s.small}>
              {claim.claimantId === user?.uid
                ? "Your ownership claim"
                : "Someone has claimed your found item"}
              {claim.requiresAdmin ? " · Administrator review required" : ""}
            </Text>
            {claim.reviewNote && <Text style={s.body}>{claim.reviewNote}</Text>}
            <Button
              tone="secondary"
              onPress={() => router.push(("/claim/" + claim.id) as any)}
            >
              Open case and handover
            </Button>
          </Card>
        ))}
      {tab === "Possible matches" && (
        <>
          {matches.data
            .filter((m) => m.active)
            .map((match) => (
              <Card key={match.id}>
                <Badge tone="gold">
                  Possible match · not proof of ownership
                </Badge>
                <Text style={s.h2}>
                  {match.lostTitle} ↔ {match.foundTitle}
                </Text>
                <Text style={s.body}>{match.reasons.join(" · ")}</Text>
                <View style={s.row}>
                  <Button
                    onPress={() =>
                      router.push(("/item/" + match.foundReportId) as any)
                    }
                  >
                    View found item
                  </Button>
                  <Button
                    tone="secondary"
                    onPress={() =>
                      router.push(("/item/" + match.lostReportId) as any)
                    }
                  >
                    View lost report
                  </Button>
                </View>
              </Card>
            ))}
          {!matches.loading &&
            matches.data.length > 0 &&
            !matches.data.some((m) => m.active) && (
              <Empty
                title="No active suggestions"
                detail="Previous suggestions are no longer active because their reports have changed or closed."
              />
            )}
        </>
      )}
      {tab === "Saved" && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", margin: -8 }}>
          {saved.data.map((item) => (
            <View
              key={item.id}
              style={{
                width: (100 / columns + "%") as `${number}%`,
                padding: 8,
              }}
            >
              <SavedReport id={item.reportId} bookmarkId={item.id} />
            </View>
          ))}
        </View>
      )}
      {tab !== "Account" && current.data.length === pageSize && (
        <Button tone="secondary" onPress={() => setPageSize((v) => v + 30)}>
          Show more activity
        </Button>
      )}
      {tab === "Account" && (
        <View style={{ maxWidth: 650, width: "100%" }}>
          <Card>
            <Text style={s.h2}>Your account</Text>
            <Text style={s.body}>{user?.email}</Text>
            <View style={s.row}>
              <Badge tone={verified ? "green" : "gold"}>
                {verified ? "Email verified" : "Verification needed"}
              </Badge>
              {isAdmin && <Badge>Administrator</Badge>}
            </View>
            {isAdmin && (
              <Button onPress={() => router.push("/admin")}>
                Open administrator workspace
              </Button>
            )}
            <Field
              label="Display name"
              value={name}
              onChangeText={setName}
              maxLength={80}
            />
            <Button
              busy={busy}
              onPress={async () => {
                setBusy(true);
                setError("");
                try {
                  await mutate("syncProfile", { displayName: name });
                  setMessage("Your profile has been updated.");
                } catch (e) {
                  setError(errorMessage(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Save profile
            </Button>
            <Button tone="secondary" onPress={() => router.push("/auth/reset")}>
              Reset password
            </Button>
            <Button tone="quiet" onPress={() => router.push("/help")}>
              Privacy and support
            </Button>
            {signingOut ? (
              <>
                <Text style={s.body}>Sign out of this device?</Text>
                <View style={s.row}>
                  <Button
                    tone="danger"
                    onPress={() => {
                      void logout().catch((e) => setError(errorMessage(e)));
                    }}
                  >
                    Confirm sign out
                  </Button>
                  <Button tone="secondary" onPress={() => setSigningOut(false)}>
                    Stay signed in
                  </Button>
                </View>
              </>
            ) : (
              <Button tone="quiet" onPress={() => setSigningOut(true)}>
                Sign out
              </Button>
            )}
          </Card>
        </View>
      )}
    </Page>
  );
}
