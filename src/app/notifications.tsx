import { withSession } from "../components/SessionGate";
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useRouter, Href } from "expo-router";
import { where, orderBy, limit, doc, updateDoc } from "firebase/firestore";
import { Notice } from "../../shared/domain";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth-context";
import { useCollection } from "../lib/data";
import { errorMessage } from "../lib/api";
import { formatDate } from "../components/ItemCard";
import {
  Page,
  Card,
  Button,
  Badge,
  Empty,
  Loading,
  QueryError,
  Feedback,
  s,
} from "../components/ui";
function Notifications() {
  const { user } = useAuth();
  const router = useRouter();
  const [size, setSize] = useState(30);
  const [error, setError] = useState("");
  const notices = useCollection<Notice>(
    "notifications",
    useMemo(
      () => [
        where("userId", "==", user?.uid ?? ""),
        orderBy("createdAt", "desc"),
        limit(size),
      ],
      [user?.uid, size],
    ),
    !!user,
  );
  return (
    <Page
      title="Updates"
      eyebrow="Stay in the loop"
      subtitle="The latest on your reports and claims."
    >
      <Feedback text={error} />
      {notices.loading ? (
        <Loading />
      ) : notices.error ? (
        <QueryError error={notices.error} retry={notices.retry} />
      ) : !notices.data.length ? (
        <Empty
          title="You’re all caught up"
          detail="Updates will appear here when a report matches or your recovery case changes."
        />
      ) : (
        notices.data.map((notice) => (
          <Card key={notice.id}>
            <View style={[s.row, { justifyContent: "space-between" }]}>
              <Text style={s.h2}>{notice.title}</Text>
              {!notice.read && <Badge>New</Badge>}
            </View>
            <Text style={s.body}>{notice.body}</Text>
            <Text style={s.small}>{formatDate(notice.createdAt)}</Text>
            <View style={s.row}>
              <Button
                tone="secondary"
                onPress={() => {
                  void updateDoc(doc(db, "notifications", notice.id), {
                    read: true,
                  }).catch((e) => setError(errorMessage(e)));
                  if (/^\/(item|claim)\/[a-zA-Z0-9_-]+$/.test(notice.href))
                    router.push(notice.href as Href);
                }}
              >
                View update
              </Button>
              {!notice.read && (
                <Button
                  tone="quiet"
                  onPress={() => {
                    void updateDoc(doc(db, "notifications", notice.id), {
                      read: true,
                    }).catch((e) => setError(errorMessage(e)));
                  }}
                >
                  Mark as read
                </Button>
              )}
            </View>
          </Card>
        ))
      )}
      {notices.data.length === size && (
        <Button tone="secondary" onPress={() => setSize((v) => v + 30)}>
          Load older updates
        </Button>
      )}
    </Page>
  );
}

export default withSession(Notifications);
