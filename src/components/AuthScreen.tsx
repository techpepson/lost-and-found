import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { useRouter, useLocalSearchParams, Href } from "expo-router";
import { ArrowRight } from "lucide-react-native";
import { useAuth } from "../lib/auth-context";
import { errorMessage } from "../lib/api";
import { Page, Card, Field, Button, Feedback, Check, s, palette } from "./ui";

export function AuthScreen({
  mode,
}: {
  mode: "login" | "signup" | "reset" | "verify";
}) {
  const auth = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (auth.isLoading) return;
    if (mode === "verify" && !auth.user) {
      router.replace({ pathname: "/auth/login", params });
      return;
    }
    if (mode === "reset" || !auth.user) return;
    if (auth.verified) {
      const target = params.returnTo;
      router.replace(
        (target &&
        target.startsWith("/") &&
        !target.startsWith("//") &&
        !target.startsWith("/auth")
          ? target
          : "/") as Href,
      );
    } else if (mode === "login")
      router.replace({ pathname: "/auth/verify", params });
  }, [auth.isLoading, auth.user, auth.verified, mode, params.returnTo, router]);
  const execute = async (work: () => Promise<void>, success = "") => {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await work();
      if (success) setMessage(success);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const submit = () =>
    execute(async () => {
      if (mode === "signup") {
        if (name.trim().length < 2) throw new Error("Enter your name.");
        if (password.length < 10)
          throw new Error("Use at least 10 characters for your password.");
        if (password !== confirm)
          throw new Error("The passwords do not match.");
        if (!accepted)
          throw new Error(
            "Please acknowledge how the service uses your information.",
          );
        await auth.signUp(email, password, name);
        router.replace({ pathname: "/auth/verify", params });
      } else if (mode === "reset") {
        await auth.reset(email);
        setMessage(
          "If an account exists for this email, a password reset link has been sent.",
        );
      } else await auth.signIn(email, password);
    });
  const title = {
    login: "Welcome back",
    signup: "Create your account",
    reset: "Reset your password",
    verify: "Check your inbox",
  }[mode];
  return (
    <Page title={title}>
      <View style={{ width: "100%", maxWidth: 460, alignSelf: "center" }}>
        <View style={{ gap: 22 }}>
          <Text style={s.body}>
            {mode === "verify"
              ? "Verify your email before reporting or claiming an item. This checks your account, not ownership of an item."
              : mode === "signup"
                ? "Create an account to report an item and follow its recovery."
                : mode === "reset"
                  ? "Enter the email address you use for this service."
                  : "Pick up where you left off."}
          </Text>
          <Feedback text={error || auth.error} />
          <Feedback text={message} success />
          {mode === "verify" ? (
            <>
              <Text style={s.label}>{auth.user?.email}</Text>
              <Button
                busy={busy}
                onPress={() =>
                  execute(
                    auth.refresh,
                    "Email status refreshed. If your link has not been opened, verify it first.",
                  )
                }
              >
                I have verified my email
              </Button>
              <Button
                disabled={busy}
                tone="secondary"
                onPress={() =>
                  execute(auth.verify, "A new verification link has been sent.")
                }
              >
                Resend verification email
              </Button>
              <Button tone="quiet" onPress={() => execute(auth.logout)}>
                Use another account
              </Button>
            </>
          ) : (
            <>
              {mode === "signup" && (
                <Field
                  label="Your name"
                  autoComplete="name"
                  value={name}
                  onChangeText={setName}
                  maxLength={80}
                />
              )}
              <Field
                label="Email address"
                autoComplete="email"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
              />
              {mode !== "reset" && (
                <>
                  <Field
                    label="Password"
                    autoComplete={
                      mode === "signup" ? "new-password" : "current-password"
                    }
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry={!show}
                    value={password}
                    onChangeText={setPassword}
                    onSubmitEditing={mode === "login" ? submit : undefined}
                    hint={
                      mode === "signup"
                        ? "Use at least 10 characters."
                        : undefined
                    }
                  />
                  {mode === "signup" && (
                    <Field
                      label="Confirm password"
                      secureTextEntry={!show}
                      value={confirm}
                      onChangeText={setConfirm}
                    />
                  )}
                  <Check
                    label="Show password"
                    value={show}
                    onChange={setShow}
                  />
                </>
              )}
              {mode === "signup" && (
                <Check
                  label="I understand that safe report details are shared with verified users, while private evidence is restricted to the recovery process."
                  value={accepted}
                  onChange={setAccepted}
                />
              )}
              <Button
                busy={busy}
                icon={<ArrowRight color="white" size={18} />}
                onPress={submit}
              >
                {mode === "signup"
                  ? "Create account"
                  : mode === "reset"
                    ? "Send reset link"
                    : "Sign in"}
              </Button>
              {mode === "login" && (
                <Button tone="quiet" onPress={() => router.push("/auth/reset")}>
                  Forgot your password?
                </Button>
              )}
              <View style={s.separator} />
              <Button
                tone="secondary"
                onPress={() =>
                  router.push({
                    pathname: mode === "login" ? "/auth/signup" : "/auth/login",
                    params,
                  })
                }
              >
                {mode === "login" ? "Create an account" : "Back to sign in"}
              </Button>
            </>
          )}
          <Button tone="quiet" onPress={() => router.push("/help")}>
            How recovery and privacy work
          </Button>
        </View>
      </View>
    </Page>
  );
}
