import { ReactNode, ComponentType, useEffect, useState } from "react";
import { Href, usePathname, useRouter } from "expo-router";
import { useAuth } from "../lib/auth-context";
import { Page, Card, Button, Feedback, Loading } from "./ui";
import { errorMessage } from "../lib/api";
import { useOnboarding } from "../lib/onboarding-context";

export function SessionGate({ children }: { children: ReactNode }) {
  const { user, verified, isLoading, error, refresh, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const onboarding = useOnboarding();
  const [retryError, setRetryError] = useState("");
  useEffect(() => {
    if (isLoading || !onboarding.ready) return;
    if (!user)
      router.replace({
        pathname: onboarding.seen ? "/auth/login" : "/onboarding",
        params: { returnTo: pathname },
      } as Href);
    else if (!verified)
      router.replace({
        pathname: "/auth/verify",
        params: { returnTo: pathname },
      });
  }, [
    isLoading,
    user,
    verified,
    pathname,
    router,
    onboarding.ready,
    onboarding.seen,
  ]);
  if (isLoading || !onboarding.ready || !user || !verified) return <Loading />;
  if (error)
    return (
      <Page title="We couldn’t open your workspace">
        <Card>
          <Feedback text={retryError || error} />
          <Button
            onPress={() => {
              setRetryError("");
              void refresh().catch((e) => setRetryError(errorMessage(e)));
            }}
          >
            Try again
          </Button>
          <Button
            tone="secondary"
            onPress={() => {
              void logout().catch((e) => setRetryError(errorMessage(e)));
            }}
          >
            Sign out
          </Button>
        </Card>
      </Page>
    );
  return children;
}
export function withSession(Screen: ComponentType) {
  return function ProtectedScreen() {
    return (
      <SessionGate>
        <Screen />
      </SessionGate>
    );
  };
}
