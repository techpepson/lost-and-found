import { Stack } from "expo-router";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "../lib/auth-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { OnboardingProvider } from "../lib/onboarding-context";
import { palette } from "../components/ui";

export default function RootLayout() {
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);
  // Keep the root navigator mounted while individual routes resolve their session.
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <OnboardingProvider>
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: palette.bg },
                animation: "slide_from_right",
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="onboarding" options={{ animation: "fade" }} />
              <Stack.Screen name="auth" />
              <Stack.Screen name="item/[id]" />
              <Stack.Screen name="claim/[id]" />
              <Stack.Screen name="admin" />
              <Stack.Screen name="help" />
              <Stack.Screen name="notifications" />
            </Stack>
          </OnboardingProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
