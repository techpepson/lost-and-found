import { useState } from "react";
import {
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowRight, MapPin } from "lucide-react-native";
import { useOnboarding } from "../lib/onboarding-context";
import { useAuth } from "../lib/auth-context";
import { appPath } from "../../shared/navigation";

export default function Onboarding() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const { complete } = useOnboarding();
  const { user } = useAuth();
  const { height, width } = useWindowDimensions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function enter(signIn: boolean) {
    setBusy(true);
    setError("");
    try {
      await complete();
      const destination = appPath(returnTo || "/");
      if (user) router.replace(destination as any);
      else
        router.replace({
          pathname: signIn ? "/auth/login" : "/auth/signup",
          params: { returnTo: destination },
        });
    } catch {
      setError("Couldn’t save your preference. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ImageBackground
        source={require("../../assets/images/onboarding-campus.png")}
        resizeMode="cover"
        style={StyleSheet.absoluteFill}
        imageStyle={{ width: "100%", height: "100%" }}
        accessible={false}
      />
      <LinearGradient
        colors={[
          "rgba(15,29,22,0.30)",
          "rgba(15,29,22,0.02)",
          "rgba(15,29,22,0.84)",
          "#101E17",
        ]}
        locations={height < 650 ? [0, 0.12, 0.36, 1] : [0, 0.35, 0.7, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            padding: width < 360 ? 22 : 28,
            paddingBottom: 20,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <Text style={styles.brandText}>Legon</Text>
            <Text style={styles.brandSub}>LOST & FOUND</Text>
          </View>
          <View style={{ flex: 1, minHeight: height < 650 ? 95 : 180 }} />
          <View style={styles.content}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <MapPin color="#D9DBCB" size={15} />
              <Text style={styles.kicker}>A little help from your campus.</Text>
            </View>
            <Text
              accessibilityRole="header"
              style={[
                styles.title,
                width < 360 && { fontSize: 40, lineHeight: 44 },
              ]}
            >
              Lost things.{"\n"}Found people.
            </Text>
            <Text style={styles.body}>
              Left it at the library? Found it on your way home? Help someone
              get their day back.
            </Text>
            {error ? (
              <Text
                accessibilityRole="alert"
                style={{ color: "#FFD7CF", lineHeight: 22 }}
              >
                {error}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              accessibilityState={{ busy, disabled: busy }}
              onPress={() => void enter(false)}
              style={({ pressed }) => [
                styles.cta,
                { opacity: busy ? 0.6 : pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={styles.ctaText}>
                {busy ? "Opening…" : "Get started"}
              </Text>
              <ArrowRight color="#183F31" size={22} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void enter(true)}
              style={styles.signIn}
            >
              <Text style={styles.signInText}>
                Already have an account?{" "}
                <Text
                  style={{ fontWeight: "700", textDecorationLine: "underline" }}
                >
                  Sign in
                </Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#101E17", overflow: "hidden" },
  brand: { alignSelf: "flex-start", gap: 2, paddingTop: 12 },
  brandText: {
    color: "#FFFDF5",
    fontSize: 30,
    letterSpacing: -1.1,
    fontWeight: "700",
  },
  brandSub: {
    color: "#FFFDF5",
    fontSize: 10,
    letterSpacing: 2.5,
    fontWeight: "600",
  },
  content: { gap: 18, maxWidth: 460, width: "100%", alignSelf: "center" },
  kicker: { color: "#D9DBCB", fontSize: 13, fontWeight: "500" },
  title: {
    color: "#FFFDF5",
    fontSize: 48,
    lineHeight: 51,
    letterSpacing: -1.8,
    fontWeight: "600",
  },
  body: { color: "#E3E5DB", fontSize: 16, lineHeight: 25, maxWidth: 330 },
  cta: {
    minHeight: 56,
    borderRadius: 12,
    backgroundColor: "#F1E9CF",
    paddingHorizontal: 22,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  ctaText: { color: "#183F31", fontSize: 16, fontWeight: "700" },
  signIn: { minHeight: 44, justifyContent: "center", alignItems: "center" },
  signInText: {
    color: "#F0F0E8",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
});
