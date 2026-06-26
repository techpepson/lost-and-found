import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Mail,
  Bookmark,
  BookmarkCheck,
  User,
} from "lucide-react-native";
import {
  colors,
  shadows,
  spacing,
  borderRadius,
  typography,
} from "@/constants/theme";
import { Item, ItemStatus } from "@/types";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  collection,
  where,
  getDocs,
} from "firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

const statusColors: Record<
  ItemStatus,
  { bg: string; text: string; gradient: [string, string] }
> = {
  lost: {
    bg: colors.lost + "15",
    text: colors.lost,
    gradient: ["#EF4444", "#DC2626"] as [string, string],
  },
  found: {
    bg: colors.found + "15",
    text: colors.found,
    gradient: ["#10B981", "#059669"] as [string, string],
  },
};

export default function ItemDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<Item | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const fetchItem = async () => {
      if (!id) return;

      const docRef = doc(db, "items", id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setItem({ id: docSnap.id, ...docSnap.data() } as Item);
      }

      setIsLoading(false);
    };

    void fetchItem();
  }, [id]);

  useEffect(() => {
    const checkIfSaved = async () => {
      if (!user || !id) return;

      const q = query(
        collection(db, "savedItems"),
        where("userId", "==", user.uid),
        where("itemId", "==", id),
      );

      const snapshot = await getDocs(q);
      setIsSaved(!snapshot.empty);
    };

    void checkIfSaved();
  }, [user, id]);

  const toggleSave = useCallback(async () => {
    if (!user || !item) {
      Alert.alert("Error", "You must be signed in to save items");
      return;
    }

    setIsSaving(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      if (isSaved) {
        const q = query(
          collection(db, "savedItems"),
          where("userId", "==", user.uid),
          where("itemId", "==", item.id),
        );
        const snapshot = await getDocs(q);
        snapshot.forEach(async (doc) => {
          await deleteDoc(doc.ref);
        });
        setIsSaved(false);
      } else {
        await setDoc(doc(collection(db, "savedItems")), {
          userId: user.uid,
          itemId: item.id,
          savedAt: new Date(),
        });
        setIsSaved(true);
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
      }
    } catch {
      Alert.alert("Error", "Failed to save item");
    } finally {
      setIsSaving(false);
    }
  }, [isSaved, item, user]);

  const handleContact = useCallback(() => {
    if (!item?.authorEmail) {
      Alert.alert("Error", "No contact information available");
      return;
    }

    const subject = encodeURIComponent(
      item.status === "lost"
        ? `Found your ${item.title}`
        : `Claiming ${item.title}`,
    );
    const body = encodeURIComponent(
      `Hi,\n\nI saw your post about "${item.title}" on Lost & Found.\n\n`,
    );

    void Linking.openURL(
      `mailto:${item.authorEmail}?subject=${subject}&body=${body}`,
    );
  }, [item]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Item not found</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backLink}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const statusColor = statusColors[item.status];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <ArrowLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={toggleSave}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          {isSaved ? (
            <BookmarkCheck size={24} color={colors.primary} />
          ) : (
            <Bookmark size={24} color={colors.textTertiary} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.imageContainer}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.image} />
          ) : (
            <LinearGradient
              colors={statusColor.gradient}
              style={styles.placeholderImage}
            >
              <Text style={styles.placeholderText}>
                {item.title.charAt(0).toUpperCase()}
              </Text>
            </LinearGradient>
          )}
          <LinearGradient
            colors={statusColor.gradient}
            style={styles.statusBadge}
          >
            <Text style={styles.statusText}>
              {item.status === "lost" ? "Lost" : "Found"}
            </Text>
          </LinearGradient>
        </View>

        <View style={styles.content}>
          <Text style={styles.category}>{item.category}</Text>
          <Text style={styles.title}>{item.title}</Text>

          <View style={styles.infoContainer}>
            <View style={styles.infoRow}>
              <MapPin size={18} color={colors.textSecondary} />
              <Text style={styles.infoText}>{item.location}</Text>
            </View>
            <View style={styles.infoRow}>
              <Calendar size={18} color={colors.textSecondary} />
              <Text style={styles.infoText}>
                {new Date(item.date).toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <User size={18} color={colors.textSecondary} />
              <Text style={styles.infoText}>
                Posted by {item.authorEmail?.split("@")[0] || "Anonymous"}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{item.description}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.contactButton}
          onPress={handleContact}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[colors.gradientStart, colors.gradientEnd]}
            style={styles.contactGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Mail size={20} color={colors.textInverse} />
            <Text style={styles.contactButtonText}>
              Contact {item.status === "lost" ? "Owner" : "Finder"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
    ...shadows.sm,
  },
  saveButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
    ...shadows.sm,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  imageContainer: {
    position: "relative",
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.xl,
    overflow: "hidden",
    ...shadows.lg,
  },
  image: {
    width: "100%",
    height: 300,
    resizeMode: "cover",
  },
  placeholderImage: {
    width: "100%",
    height: 300,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 64,
    fontWeight: "700",
    color: colors.textInverse,
  },
  statusBadge: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  statusText: {
    ...typography.caption,
    color: colors.textInverse,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  content: {
    padding: spacing.lg,
  },
  category: {
    ...typography.caption,
    color: colors.primary,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  infoContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  infoText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  footer: {
    padding: spacing.lg,
    paddingTop: 0,
    backgroundColor: colors.background,
  },
  contactButton: {
    borderRadius: borderRadius.lg,
    overflow: "hidden",
    ...shadows.md,
  },
  contactGradient: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  contactButtonText: {
    ...typography.button,
    color: colors.textInverse,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    ...typography.h3,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  backLink: {
    ...typography.button,
    color: colors.primary,
  },
});
