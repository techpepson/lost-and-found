export const CATEGORIES = [
  "Phone",
  "Laptop",
  "Wallet",
  "ID Card",
  "Bag",
  "Keys",
  "Books",
  "Electronics",
  "Clothing",
  "Others",
] as const;
export const LOCATIONS = [
  "Balme Library",
  "Great Hall",
  "University Square",
  "Akuafo Hall",
  "Legon Hall",
  "Commonwealth Hall",
  "Volta Hall",
  "Mensah Sarbah Hall",
  "Business School",
  "Night Market",
  "Sports Directorate",
  "Other campus location",
] as const;
export type Category = (typeof CATEGORIES)[number];
export type ReportType = "lost" | "found";
export type ReportState =
  "draft" | "open" | "reserved" | "recovered" | "closed" | "archived";
export type ClaimState =
  | "submitted"
  | "under_review"
  | "needs_information"
  | "approved"
  | "rejected"
  | "withdrawn"
  | "disputed";
export type HandoverState =
  | "pending"
  | "scheduled"
  | "code_verified"
  | "awaiting_confirmation"
  | "completed"
  | "cancelled"
  | "disputed";
export interface Report {
  id: string;
  authorId: string;
  title: string;
  description: string;
  type: ReportType;
  state: ReportState;
  category: Category;
  color: string;
  brand: string;
  location: string;
  locationDetail: string;
  eventDate: string;
  approximateDate: boolean;
  photoPath: string;
  createdAt: number;
  updatedAt: number;
  activeClaimId: string | null;
  requiresAdmin: boolean;
  schemaVersion: number;
}
export interface ReportInput {
  title: string;
  description: string;
  type: ReportType;
  category: Category;
  color: string;
  brand: string;
  location: string;
  locationDetail: string;
  eventDate: string;
  approximateDate: boolean;
  photoPath: string;
  privateDetails: string;
  draft: boolean;
}
export interface Claim {
  id: string;
  reportId: string;
  reportTitle: string;
  claimantId: string;
  finderId: string;
  participantIds: string[];
  lostReportId: string | null;
  answers: string;
  circumstances: string;
  state: ClaimState;
  requiresAdmin: boolean;
  evidencePaths: string[];
  reviewNote: string;
  createdAt: number;
  updatedAt: number;
}
export interface Handover {
  id: string;
  reportId: string;
  participantIds: string[];
  claimantId: string;
  finderId: string;
  state: HandoverState;
  location: string;
  scheduledAt: string;
  scheduleAccepted: boolean;
  ownerConfirmed: boolean;
  finderConfirmed: boolean;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
}
export interface Match {
  id: string;
  reportIds: string[];
  participantIds: string[];
  lostReportId: string;
  foundReportId: string;
  lostTitle: string;
  foundTitle: string;
  score: number;
  reasons: string[];
  active: boolean;
  version: string;
  updatedAt: number;
}
export interface Notice {
  id: string;
  userId: string;
  title: string;
  body: string;
  href: string;
  read: boolean;
  createdAt: number;
}
export interface AuditEvent {
  id: string;
  caseId: string;
  actorId: string;
  action: string;
  note: string;
  participantIds: string[];
  createdAt: number;
}
export interface Dispute {
  id: string;
  claimId: string;
  reportId: string;
  participantIds: string[];
  openedBy: string;
  reason: string;
  state: "open" | "resolved";
  resolution?: string;
  createdAt: number;
  updatedAt: number;
}
export class DomainError extends Error {}
export function requireCondition(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new DomainError(message);
}
export function textValue(
  value: unknown,
  label: string,
  min = 0,
  max = 2000,
): string {
  requireCondition(typeof value === "string", `${label} must be text.`);
  const result = value.trim();
  requireCondition(
    result.length >= min && result.length <= max,
    `${label} must contain ${min}–${max} characters.`,
  );
  return result;
}
export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T12:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function validateReport(
  raw: Record<string, unknown>,
  now = Date.now(),
): ReportInput {
  requireCondition(
    raw.type === "lost" || raw.type === "found",
    "Choose lost or found.",
  );
  requireCondition(
    CATEGORIES.includes(raw.category as Category),
    "Choose an item category.",
  );
  requireCondition(
    LOCATIONS.includes(raw.location as (typeof LOCATIONS)[number]),
    "Choose a campus location.",
  );
  requireCondition(
    validDate(raw.eventDate) &&
      raw.eventDate <= new Date(now).toISOString().slice(0, 10),
    "Choose a valid date that is not in the future.",
  );
  const photoPath = textValue(raw.photoPath ?? "", "Photo", 0, 250);
  requireCondition(
    raw.category !== "ID Card" || photoPath === "",
    "ID cards use a generic illustration to protect personal details.",
  );
  return {
    title: textValue(raw.title, "Title", 3, 80),
    description: textValue(raw.description, "Public description", 10, 1500),
    type: raw.type,
    category: raw.category as Category,
    color: textValue(raw.color ?? "", "Color", 0, 40),
    brand: textValue(raw.brand ?? "", "Brand/model", 0, 80),
    location: raw.location as string,
    locationDetail: textValue(
      raw.locationDetail ?? "",
      "Location detail",
      raw.location === "Other campus location" ? 3 : 0,
      120,
    ),
    eventDate: raw.eventDate,
    approximateDate: raw.approximateDate === true,
    photoPath,
    privateDetails: textValue(
      raw.privateDetails,
      "Private identifying details",
      10,
      2000,
    ),
    draft: raw.draft === true,
  };
}
export function needsAdmin(category: Category): boolean {
  return ["Phone", "Laptop", "Wallet", "ID Card", "Electronics"].includes(
    category,
  );
}
const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
export function scoreMatch(
  a: Report,
  b: Report,
): { score: number; reasons: string[] } {
  if (
    a.type === b.type ||
    a.category !== b.category ||
    a.state !== "open" ||
    b.state !== "open"
  )
    return { score: 0, reasons: [] };
  let points = 25;
  let available = 25;
  const reasons = ["Same item category"];
  for (const [key, weight, label] of [
    ["brand", 25, "Similar brand or model"],
    ["color", 15, "Same color"],
  ] as const) {
    if (a[key] && b[key]) {
      available += weight;
      const x = normalize(a[key]);
      const y = normalize(b[key]);
      if (
        x === y ||
        (key === "brand" &&
          Math.min(x.length, y.length) >= 3 &&
          (x.includes(y) || y.includes(x)))
      ) {
        points += weight;
        reasons.push(label);
      }
    }
  }
  available += 20;
  if (a.location === b.location && a.location !== "Other campus location") {
    points += 20;
    reasons.push("Same campus location");
  }
  available += 15;
  const lost = a.type === "lost" ? a : b;
  const found = a.type === "found" ? a : b;
  const days =
    (Date.parse(found.eventDate) - Date.parse(lost.eventDate)) / 86400000;
  if (days < -1 && !a.approximateDate && !b.approximateDate)
    return { score: 0, reasons: [] };
  if (Math.abs(days) <= 7) {
    points += Math.max(3, 15 - Math.abs(days) * 2);
    reasons.push("Dates are close");
  }
  const words = (v: Report) =>
    new Set(
      normalize(`${v.title} ${v.description}`)
        .split(" ")
        .filter((w) => w.length > 3),
    );
  const x = words(a),
    y = words(b);
  const overlap = [...x].filter((w) => y.has(w)).length;
  if (x.size && y.size) {
    available += 10;
    points += (10 * overlap) / Math.max(x.size, y.size);
    if (overlap >= 2) reasons.push("Similar description");
  }
  return { score: Math.round((points / available) * 100), reasons };
}
export function canReview(claim: Claim, actorId: string, admin: boolean) {
  requireCondition(
    actorId !== claim.claimantId,
    "You cannot review your own claim.",
  );
  requireCondition(
    admin || actorId === claim.finderId,
    "Only the finder or an administrator can review this claim.",
  );
  requireCondition(
    admin || !claim.requiresAdmin,
    "This claim requires an administrator.",
  );
  requireCondition(
    !claim.requiresAdmin || actorId !== claim.finderId,
    "An independent administrator must review this claim.",
  );
  requireCondition(
    ["submitted", "under_review", "needs_information"].includes(claim.state),
    "This claim is no longer awaiting review.",
  );
}
export function confirmTransfer(
  h: Handover,
  actorId: string,
): Partial<Handover> {
  requireCondition(
    h.participantIds.includes(actorId),
    "Only the handover participants can confirm transfer.",
  );
  requireCondition(
    ["code_verified", "awaiting_confirmation", "completed"].includes(h.state),
    "Verify the collection code before confirming transfer.",
  );
  const ownerConfirmed = h.ownerConfirmed || actorId === h.claimantId;
  const finderConfirmed = h.finderConfirmed || actorId === h.finderId;
  return {
    ownerConfirmed,
    finderConfirmed,
    state:
      ownerConfirmed && finderConfirmed ? "completed" : "awaiting_confirmation",
  };
}
