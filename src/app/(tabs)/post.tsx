import { useEffect, useRef, useState } from "react";
import { View, Text, Image } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { chooseImage } from "../../lib/pick-image";
import { Camera, LockKeyhole, Eye, CheckCircle2 } from "lucide-react-native";
import {
  CATEGORIES,
  LOCATIONS,
  Report,
  ReportInput,
  validateReport,
} from "../../../shared/domain";
import {
  Page,
  Card,
  Field,
  Select,
  DateField,
  Check,
  Button,
  Badge,
  Feedback,
  Loading,
  QueryError,
  Empty,
  s,
  palette,
} from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { useDocument } from "../../lib/data";
import {
  errorMessage,
  mutate,
  uploadImage,
  requestId,
  useProtectedImage,
} from "../../lib/api";

const initial = (): ReportInput => ({
  title: "",
  description: "",
  type: "lost",
  category: "Others",
  color: "",
  brand: "",
  location: LOCATIONS[0],
  locationDetail: "",
  eventDate: new Date().toISOString().slice(0, 10),
  approximateDate: false,
  photoPath: "",
  privateDetails: "",
  draft: false,
});
export default function ReportForm() {
  const params = useLocalSearchParams<{ id?: string; type?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const existing = useDocument<Report>("reports", params.id);
  const privateReport = useDocument<{ privateDetails: string }>(
    "reportPrivate",
    params.id,
  );
  const newReportId = useRef(requestId());
  const [form, setForm] = useState<ReportInput>(initial);
  const storedPhoto = useProtectedImage(form.photoPath);
  const [step, setStep] = useState(0);
  const [photo, setPhoto] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const change = <K extends keyof ReportInput>(key: K, value: ReportInput[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  useEffect(() => {
    if (existing.data && privateReport.data)
      setForm({
        ...existing.data,
        privateDetails: privateReport.data.privateDetails,
        draft: existing.data.state === "draft",
      });
  }, [existing.data, privateReport.data]);
  useEffect(() => {
    if (!params.id) {
      setForm({
        ...initial(),
        type: params.type === "found" ? "found" : "lost",
      });
      setStep(0);
      setPhoto("");
      setAcknowledged(false);
    }
  }, [params.id, params.type]);
  async function pickPhoto() {
    setError("");
    try {
      const uri = await chooseImage();
      if (uri) setPhoto(uri);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  function next() {
    setError("");
    try {
      if (
        step === 0 &&
        (form.title.trim().length < 3 || form.description.trim().length < 10)
      )
        throw new Error(
          "Add a title and a public description of at least 10 characters.",
        );
      if (step === 2 || step === 1) {
        if (step === 2)
          validateReport(form as unknown as Record<string, unknown>);
        else if (!form.eventDate) throw new Error("Choose the event date.");
      }
      setStep((v) => Math.min(v + 1, 3));
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function save(draft: boolean) {
    if (!user) return;
    setError("");
    setBusy(true);
    try {
      validateReport(form as unknown as Record<string, unknown>);
      if (!draft && !acknowledged)
        throw new Error(
          "Review the public information and acknowledge the privacy check.",
        );
      const photoPath =
        form.category === "ID Card"
          ? ""
          : photo
            ? await uploadImage(photo, user.uid)
            : form.photoPath;
      const result = await mutate("saveReport", {
        ...form,
        photoPath,
        draft,
        id: params.id || newReportId.current,
      });
      newReportId.current = requestId();
      setForm(initial());
      setStep(0);
      setPhoto("");
      setAcknowledged(false);
      router.setParams({ id: undefined, type: undefined });
      router.replace(draft ? "/profile" : (("/item/" + result.id) as any));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  if (params.id && (existing.loading || privateReport.loading))
    return <Loading />;
  if (existing.error || privateReport.error)
    return (
      <QueryError
        error={existing.error || privateReport.error}
        retry={() => {
          existing.retry();
          privateReport.retry();
        }}
      />
    );
  if (params.id && !existing.data)
    return (
      <Page title="Report unavailable">
        <Empty
          title="This report could not be found"
          detail="Return to your activity and choose an available report."
        >
          <Button onPress={() => router.replace("/profile")}>
            My activity
          </Button>
        </Empty>
      </Page>
    );
  const steps = ["Item details", "Place & photo", "Private clues", "Review"];
  return (
    <Page
      title={params.id ? "Edit your report" : "Report an item"}
      eyebrow="Report an item"
      subtitle="Start with what you lost or found."
    >
      <View style={{ gap: 10 }}>
        <View style={[s.row, { justifyContent: "space-between" }]}>
          <Text style={s.label}>{steps[step]}</Text>
          <Text style={s.small}>
            {step + 1} of {steps.length}
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {steps.map((label, i) => (
            <View
              key={label}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                backgroundColor: i <= step ? palette.blue : palette.line,
              }}
            />
          ))}
        </View>
      </View>
      <View style={{ width: "100%", maxWidth: 800, alignSelf: "center" }}>
        <Card>
          {step === 0 && (
            <>
              <Text style={s.h2}>What happened?</Text>
              <View style={s.row}>
                <Button
                  tone={form.type === "lost" ? "primary" : "secondary"}
                  onPress={() => change("type", "lost")}
                >
                  I lost an item
                </Button>
                <Button
                  tone={form.type === "found" ? "primary" : "secondary"}
                  onPress={() => change("type", "found")}
                >
                  I found an item
                </Button>
              </View>
              <Field
                label="Item title"
                value={form.title}
                onChangeText={(v) => change("title", v)}
                maxLength={80}
                placeholder="For example, blue backpack"
              />
              <Select
                label="Category"
                value={form.category}
                options={CATEGORIES}
                onChange={(v) => {
                  change("category", v as ReportInput["category"]);
                  if (v === "ID Card") {
                    change("photoPath", "");
                    setPhoto("");
                  }
                }}
              />
              <View style={[s.row, { alignItems: "flex-start" }]}>
                <Field
                  label="Color (optional)"
                  value={form.color}
                  maxLength={40}
                  onChangeText={(v) => change("color", v)}
                  placeholder="Blue"
                />
                <Field
                  label="Brand or model (optional)"
                  value={form.brand}
                  maxLength={80}
                  onChangeText={(v) => change("brand", v)}
                  placeholder="Brand or model"
                />
              </View>
              <Field
                label="Public description"
                multiline
                value={form.description}
                onChangeText={(v) => change("description", v)}
                maxLength={1500}
                placeholder="Describe the general appearance, without revealing ownership clues."
                hint="Do not include names on cards, student numbers, serial numbers, contact information, or unique marks. Those belong in private clues."
              />
            </>
          )}
          {step === 1 && (
            <>
              <Text style={s.h2}>Where and when?</Text>
              <Select
                label={form.type === "lost" ? "Last seen near" : "Found near"}
                value={form.location}
                options={LOCATIONS}
                onChange={(v) => change("location", v)}
              />
              <Field
                label="Location detail"
                value={form.locationDetail}
                maxLength={120}
                onChangeText={(v) => change("locationDetail", v)}
                placeholder="For example, outside the main entrance"
                hint="Use a general public place; keep exact recovery clues private."
              />
              <DateField
                label={form.type === "lost" ? "Date last seen" : "Date found"}
                value={form.eventDate}
                onChange={(v) => change("eventDate", v)}
              />
              <Check
                label="This date is approximate"
                value={form.approximateDate}
                onChange={(v) => change("approximateDate", v)}
              />
              <View style={s.separator} />
              <Text style={s.label}>Public photo (optional)</Text>
              {form.category === "ID Card" ? (
                <Text style={s.body}>
                  ID cards use a generic illustration so names, photos and
                  student numbers are not exposed.
                </Text>
              ) : (
                <>
                  {(photo || storedPhoto.uri) && (
                    <Image
                      accessibilityLabel="Selected public report photo"
                      source={{ uri: photo || storedPhoto.uri }}
                      style={{ height: 220, width: "100%", borderRadius: 10 }}
                      resizeMode="contain"
                    />
                  )}
                  <Button
                    tone="secondary"
                    icon={<Camera color={palette.blue} size={18} />}
                    onPress={pickPhoto}
                  >
                    {photo || form.photoPath
                      ? "Replace photo"
                      : "Choose a photo"}
                  </Button>
                  {(photo || form.photoPath) && (
                    <Button
                      tone="quiet"
                      onPress={() => {
                        setPhoto("");
                        change("photoPath", "");
                      }}
                    >
                      Remove photo
                    </Button>
                  )}
                  <Text style={s.small}>
                    Only upload a photo that conceals identifying clues and
                    personal information. Photos are resized and re-encoded
                    before upload.
                  </Text>
                </>
              )}
            </>
          )}
          {step === 2 && (
            <>
              <View style={s.row}>
                <LockKeyhole color={palette.blue} />
                <Text style={s.h2}>Details only the owner would know</Text>
              </View>
              <Text style={s.body}>
                These details are stored separately. They are visible to you and
                authorized administrators, and are never shown in browse results
                or to claimants.
              </Text>
              <Field
                label="Private identifying details"
                value={form.privateDetails}
                multiline
                maxLength={2000}
                onChangeText={(v) => change("privateDetails", v)}
                placeholder="Examples: a distinctive scratch, an inscription inside, or an unusual item in a pocket."
                hint="Never enter device passcodes, account passwords, recovery codes, or banking credentials."
              />
              <View
                style={{
                  backgroundColor: "#FFF4D8",
                  padding: 16,
                  borderRadius: 10,
                }}
              >
                <Text style={s.body}>
                  Record these clues before reviewing claims. Once a claim
                  exists, the report is locked for editing to preserve a fair
                  review.
                </Text>
              </View>
            </>
          )}
          {step === 3 && (
            <>
              <View style={s.row}>
                <Eye color={palette.blue} />
                <Text style={s.h2}>What the community will see</Text>
              </View>
              <View style={s.row}>
                <Badge tone={form.type === "found" ? "green" : "gold"}>
                  {form.type}
                </Badge>
                <Badge tone="gray">{form.category}</Badge>
              </View>
              <Text style={s.h2}>{form.title}</Text>
              {(photo || storedPhoto.uri) && form.category !== "ID Card" && (
                <Image
                  accessibilityLabel="Public photo preview"
                  source={{ uri: photo || storedPhoto.uri }}
                  style={{ width: "100%", height: 200, borderRadius: 10 }}
                  resizeMode="contain"
                />
              )}
              <Text style={s.body}>{form.description}</Text>
              {(form.brand || form.color) && (
                <Text style={s.body}>
                  {[form.brand, form.color].filter(Boolean).join(" · ")}
                </Text>
              )}
              <Text style={s.body}>
                {form.location} · {form.eventDate}
                {form.approximateDate ? " (approximate)" : ""}
              </Text>
              {form.locationDetail && (
                <Text style={s.body}>{form.locationDetail}</Text>
              )}
              <View style={s.separator} />
              <View style={s.row}>
                <LockKeyhole size={20} color={palette.green} />
                <Text style={[s.label, { color: palette.green }]}>
                  Private clues will be kept separate
                </Text>
              </View>
              <Check
                label="I checked that the public text and photo contain no personal information or private ownership clues."
                value={acknowledged}
                onChange={setAcknowledged}
              />
              <Text style={s.small}>
                Reports can suggest a match. An approved ownership claim and
                confirmed handover are required to record a verified recovery.
              </Text>
            </>
          )}
          <Feedback text={error} />
          <View style={{ gap: 12, marginTop: 8 }}>
            {step < 3 ? (
              <Button disabled={busy} onPress={next}>
                Continue
              </Button>
            ) : (
              <Button
                busy={busy}
                onPress={() => void save(false)}
                icon={<CheckCircle2 color="white" size={18} />}
              >
                Publish report
              </Button>
            )}
            <View style={[s.row, { justifyContent: "space-between" }]}>
              {step > 0 && (
                <Button
                  tone="secondary"
                  disabled={busy}
                  onPress={() => {
                    setError("");
                    setStep((v) => v - 1);
                  }}
                >
                  Back
                </Button>
              )}
              {step === 3 && (
                <Button
                  tone="secondary"
                  disabled={busy}
                  onPress={() => void save(true)}
                >
                  Save draft
                </Button>
              )}
            </View>
          </View>
        </Card>
      </View>
    </Page>
  );
}
