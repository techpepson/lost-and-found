import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { Page, Card, Button, s } from "../components/ui";
export default function Help() {
  const router = useRouter();
  return (
    <Page
      title="How it works"
      eyebrow="How it works"
      subtitle="For the University of Ghana campus community."
      actions={
        <Button tone="secondary" onPress={() => router.push("/")}>
          Back to the app
        </Button>
      }
    >
      <Card>
        <Text style={s.h2}>From report to recovery</Text>
        {[
          "Report what you lost or found. Keep the public description general and record unique clues privately.",
          "Browse reports and possible matches. A suggestion is not proof of ownership.",
          "Submit an ownership claim. Describe private details and add available evidence; receipts are not the only way to establish ownership.",
          "The finder reviews ordinary claims. Sensitive items, competing claims and disputes require an administrator.",
          "Agree on a public collection place and time. The owner accepts the details and generates a short-lived code when meeting the finder.",
          "The finder verifies the code. Each person confirms the physical transfer separately; only then is the item recorded as recovered.",
        ].map((text, index) => (
          <View key={text} style={[s.row, { alignItems: "flex-start" }]}>
            <Text style={s.label}>{index + 1}.</Text>
            <Text style={[s.body, { flex: 1 }]}>{text}</Text>
          </View>
        ))}
      </Card>
      <Card>
        <Text style={s.h2}>Who can see your information?</Text>
        <Text style={s.body}>
          Verified signed-in users can browse safe report details and public
          photos. Your email is not included in reports. Private report clues
          are visible only to the author and authorized administrators.
        </Text>
        <Text style={s.body}>
          Written ownership claims are shared with the claimant, finder and
          administrators. Evidence images are restricted to the claimant and
          administrators. Case histories, disputes and handovers are limited to
          their participants and administrators.
        </Text>
        <Text style={s.body}>
          Do not put student numbers, names from ID cards, serial numbers, phone
          numbers, passwords, device passcodes or banking details in public
          descriptions or photos. ID cards use generic images. Evidence should
          be redacted to show only what is needed.
        </Text>
      </Card>
      <Card>
        <Text style={s.h2}>Collection and disputes</Text>
        <Text style={s.body}>
          Meet in a public campus location you both agree on. This project does
          not imply that a listed location has staff or an official collection
          desk. Do not share your collection code before you meet, and do not
          confirm receipt before you have your item.
        </Text>
        <Text style={s.body}>
          If evidence conflicts, a person is unresponsive, or the transfer goes
          wrong, open the case and choose “Report a problem or request
          cancellation”. Completion pauses while an independent administrator
          reviews the dispute. Expired reservations are also routed for review.
        </Text>
        <Text style={s.body}>
          A rejected claim is not automatically evidence of fraud. You can
          explain a disagreement through the dispute process. No payments or
          rewards are processed by this service.
        </Text>
      </Card>
      <Card>
        <Text style={s.h2}>Data retention and account support</Text>
        <Text style={s.body}>
          Evidence images are eligible for deletion 90 days after a claim is
          rejected or withdrawn, or a handover is completed, provided there is
          no open dispute. Minimal case history is retained for accountability.
          This policy must be confirmed by the pilot operator before live campus
          use.
        </Text>
        <Text style={s.body}>
          Closing your report preserves its case history. A return that happened
          outside the service is not counted as a verified recovery.
          Administrators manage account suspension and data requests; use your
          existing case to raise a concern. A university support contact will be
          added once a participating operator is confirmed.
        </Text>
        <Text style={s.body}>
          This is a project for the campus community. Email verification
          confirms access to an email account; it does not establish university
          membership or item ownership. Pilot membership restrictions depend on
          the operator’s configured eligibility policy.
        </Text>
      </Card>
    </Page>
  );
}
