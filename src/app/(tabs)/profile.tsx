import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LogOut, Trash2, Bookmark, FileText } from "lucide-react-native";
import {
  colors,
  shadows,
  spacing,
  borderRadius,
  typography,
} from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";
import { Item } from "@/types";
import { ItemCard } from "@/components/ItemCard";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

type TabType = "posts" | "saved";

export default function ProfileScreen() {
  const [activeTab, setActiveTab] = useState<TabType>("posts");
  const [myPosts, setMyPosts] = useState<Item[]>([]);
  const [savedItems, setSavedItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { user, userData, logout } = useAuth();
  const router = useRouter();

  const fetchData = useCallback(() => {
    if (!user) return () => {};

    setIsLoading(true);

    // Fetch my posts
    const postsQuery = query(
      collection(db, "items"),
      where("authorId", "==", user.uid),
      orderBy("createdAt", "desc"),
    );

    const unsubscribePosts = onSnapshot(
      postsQuery,
      (snapshot) => {
        const posts: Item[] = [];
        snapshot.forEach((doc) => {
          posts.push({ id: doc.id, ...doc.data() } as Item);
        });
        setMyPosts(posts);
        setIsLoading(false);
      },
      () => {
        setIsLoading(false);
      },
    );

    // Fetch saved items
    const fetchSaved = async () => {
      const savedQuery = query(
        collection(db, "savedItems"),
        where("userId", "==", user.uid),
      );

      const savedSnapshot = await getDocs(savedQuery);
      const itemIds: string[] = [];
      savedSnapshot.forEach((doc) => {
        itemIds.push(doc.data().itemId);
      });

      if (itemIds.length > 0) {
        const items: Item[] = [];
        for (const itemId of itemIds) {
          const itemDoc = await getDocs(
            query(collection(db, "items"), where("__name__", "==", itemId)),
          );
          itemDoc.forEach((doc) => {
            items.push({ id: doc.id, ...doc.data() } as Item);
          });
        }
        setSavedItems(items);
      } else {
        setSavedItems([]);
      }
    };

    void fetchSaved();

    return () => {
      unsubscribePosts();
    };
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      const unsubscribe = fetchData();
      return () => unsubscribe();
    }, [fetchData]),
  );

  const handleDelete = useCallback((itemId: string) => {
    Alert.alert("Delete Item", "Are you sure you want to delete this item?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "items", itemId));
            Alert.alert("Success", "Item deleted successfully");
          } catch {
            Alert.alert("Error", "Failed to delete item");
          }
        },
      },
    ]);
  }, []);

  const handleLogout = useCallback(() => {
    const performLogout = async () => {
      try {
        await logout();
        router.replace("/auth/login");
      } catch (error) {
        console.error("Logout error:", error);
        Alert.alert("Error", "Failed to logout. Please try again.");
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("Are you sure you want to logout?")) {
        void performLogout();
      }
    } else {
      Alert.alert("Logout", "Are you sure you want to logout?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: performLogout,
        },
      ]);
    }
  }, [logout, router]);

  const handleItemPress = useCallback(
    (item: Item) => {
      router.push(`/item/${item.id}`);
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: Item }) => (
      <View style={styles.itemWrapper}>
        <ItemCard item={item} onPress={() => handleItemPress(item)} />
        {activeTab === "posts" && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDelete(item.id)}
            testID={`delete-button-${item.id}`}
          >
            <Trash2 size={18} color={colors.danger} />
          </TouchableOpacity>
        )}
      </View>
    ),
    [activeTab, handleDelete, handleItemPress],
  );

  const data = activeTab === "posts" ? myPosts : savedItems;

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    const unsubscribe = fetchData();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
    return () => unsubscribe();
  }, [fetchData]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          style={styles.avatarContainer}
        >
          <Text style={styles.avatarText}>
            {userData?.email?.charAt(0).toUpperCase() || "U"}
          </Text>
        </LinearGradient>

        <Text style={styles.email}>{userData?.email}</Text>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <LogOut size={18} color={colors.danger} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "posts" && styles.activeTab]}
          onPress={() => setActiveTab("posts")}
          activeOpacity={0.8}
        >
          <FileText
            size={18}
            color={activeTab === "posts" ? colors.primary : colors.textTertiary}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === "posts" && styles.activeTabText,
            ]}
          >
            My Posts
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "saved" && styles.activeTab]}
          onPress={() => setActiveTab("saved")}
          activeOpacity={0.8}
        >
          <Bookmark
            size={18}
            color={activeTab === "saved" ? colors.primary : colors.textTertiary}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === "saved" && styles.activeTabText,
            ]}
          >
            Saved Items
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            {isLoading ? (
              <ActivityIndicator size="large" color={colors.primary} />
            ) : (
              <>
                <Text style={styles.emptyTitle}>
                  {activeTab === "posts" ? "No posts yet" : "No saved items"}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {activeTab === "posts"
                    ? "Start posting lost or found items"
                    : "Items you save will appear here"}
                </Text>
              </>
            )}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    alignItems: "center",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
    ...shadows.md,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.textInverse,
  },
  email: {
    ...typography.h4,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.danger + "10",
  },
  logoutText: {
    ...typography.bodySmall,
    color: colors.danger,
    fontWeight: "600",
  },
  tabsContainer: {
    flexDirection: "row",
    padding: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeTab: {
    backgroundColor: colors.primary + "10",
    borderColor: colors.primary,
  },
  tabText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  activeTabText: {
    color: colors.primary,
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  itemWrapper: {
    position: "relative",
  },
  deleteButton: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    padding: spacing.sm,
    ...shadows.sm,
    zIndex: 1,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
});
