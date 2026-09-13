import { useRouter } from "expo-router";
import { Page, Empty, Button } from "../components/ui";
export default function NotFoundScreen() {
  const router = useRouter();
  return (
    <Page title="Nothing here">
      <Empty
        title="This link is no longer available"
        detail="Head back to browse or check the link you were sent."
      >
        <Button onPress={() => router.replace("/")}>Back to browse</Button>
      </Empty>
    </Page>
  );
}
