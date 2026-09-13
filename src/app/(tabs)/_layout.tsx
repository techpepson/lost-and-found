import { withSession } from "../../components/SessionGate";
import { Tabs } from "expo-router";
import { Search, PlusCircle, LayoutDashboard, Bell } from "lucide-react-native";
import { palette } from "../../components/ui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.blue,
        tabBarInactiveTintColor: palette.muted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: "white",
          borderTopColor: palette.line,
          height: 72 + insets.bottom,
          paddingTop: 4,
          paddingBottom: Math.max(insets.bottom, 8),
        },
        tabBarLabelStyle: { fontSize: 12, lineHeight: 18, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Browse",
          tabBarIcon: ({ color, size }) => <Search color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="post"
        options={{
          title: "Report",
          tabBarIcon: ({ color, size }) => (
            <PlusCircle color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "My activity",
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="updates"
        options={{
          title: "Updates",
          tabBarIcon: ({ color, size }) => <Bell color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

export default withSession(TabsLayout);
