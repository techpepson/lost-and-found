import test from "node:test";
import assert from "node:assert/strict";
import {
  validateReport,
  validDate,
  scoreMatch,
  canReview,
  confirmTransfer,
  needsAdmin,
} from "../shared/domain.ts";
import type { Report, Claim, Handover } from "../shared/domain.ts";
import { appPath } from "../shared/navigation.ts";
const base: Report = {
  id: "lost",
  authorId: "owner",
  title: "Blue backpack",
  description: "A blue canvas backpack with two straps",
  type: "lost",
  state: "open",
  category: "Bag",
  color: "blue",
  brand: "Campus",
  location: "Balme Library",
  locationDetail: "",
  eventDate: "2026-09-10",
  approximateDate: false,
  photoPath: "",
  createdAt: 1,
  updatedAt: 1,
  activeClaimId: null,
  requiresAdmin: false,
  schemaVersion: 2,
};
const input = {
  ...base,
  privateDetails: "A small stitched moon inside the pocket",
  draft: false,
};
const claim = {
  id: "case",
  claimantId: "owner",
  finderId: "finder",
  participantIds: ["owner", "finder"],
  state: "submitted",
  requiresAdmin: false,
} as Claim;
const h = {
  id: "case",
  claimantId: "owner",
  finderId: "finder",
  participantIds: ["owner", "finder"],
  state: "code_verified",
  ownerConfirmed: false,
  finderConfirmed: false,
} as Handover;
test("dates reject rollover, invalid formats and future events", () => {
  assert.equal(validDate("2026-02-30"), false);
  assert.equal(validDate("2024-02-29"), true);
  assert.equal(validDate("10/09/2026"), false);
  assert.throws(
    () =>
      validateReport(
        { ...input, eventDate: "2030-01-01" },
        Date.parse("2026-09-12"),
      ),
    /future/,
  );
});
test("public payload is an allowlist and does not include private input or injected privileges", () => {
  const v = validateReport(
    {
      ...input,
      admin: true,
      authorEmail: "secret@example.com",
      state: "recovered",
    },
    Date.parse("2026-09-12"),
  );
  assert.equal("admin" in v, false);
  assert.equal("authorEmail" in v, false);
  assert.equal("state" in v, false);
  assert.equal(v.privateDetails, input.privateDetails);
});
test("ID cards cannot expose a photograph", () => {
  assert.throws(
    () =>
      validateReport({
        ...input,
        category: "ID Card",
        photoPath: "photos/uid/file",
      }),
    /generic illustration/,
  );
});
test("categories, public lengths and private clues are validated", () => {
  assert.throws(() => validateReport({ ...input, category: "Anything" }));
  assert.throws(() => validateReport({ ...input, privateDetails: "tiny" }));
  assert.throws(() => validateReport({ ...input, title: " ".repeat(10) }));
  assert.equal(needsAdmin("Phone"), true);
  assert.equal(needsAdmin("Keys"), false);
});
test("a strong match is explainable and never uses private features", () => {
  const found = {
    ...base,
    id: "found",
    authorId: "finder",
    type: "found" as const,
    eventDate: "2026-09-11",
  };
  const match = scoreMatch(base, found);
  assert.ok(match.score >= 80);
  assert.ok(match.reasons.includes("Same campus location"));
  assert.deepEqual(
    scoreMatch({ ...base, privateDetails: "secret" } as Report, found),
    match,
  );
});
test("same-type, closed and incompatible categories never match", () => {
  assert.equal(scoreMatch(base, base).score, 0);
  assert.equal(
    scoreMatch(base, { ...base, type: "found", category: "Keys" }).score,
    0,
  );
  assert.equal(
    scoreMatch(base, { ...base, type: "found", state: "recovered" }).score,
    0,
  );
});
test("finding before a definite loss is excluded; uncertain dates are treated differently", () => {
  assert.equal(
    scoreMatch(base, { ...base, type: "found", eventDate: "2026-09-01" }).score,
    0,
  );
  assert.ok(
    scoreMatch(base, {
      ...base,
      type: "found",
      eventDate: "2026-09-01",
      approximateDate: true,
    }).score > 0,
  );
});
test("claimants and outsiders cannot review; sensitive items need admin", () => {
  assert.throws(() => canReview(claim, "owner", true), /own claim/);
  assert.throws(() => canReview(claim, "outsider", false));
  assert.throws(() =>
    canReview({ ...claim, requiresAdmin: true }, "finder", false),
  );
  assert.doesNotThrow(() => canReview(claim, "finder", false));
  assert.doesNotThrow(() =>
    canReview({ ...claim, requiresAdmin: true }, "admin", true),
  );
});
test("terminal and disputed claims cannot be reapproved", () => {
  for (const state of [
    "approved",
    "rejected",
    "withdrawn",
    "disputed",
  ] as const)
    assert.throws(() => canReview({ ...claim, state }, "admin", true));
});
test("one confirmation never completes a transfer", () => {
  const first = confirmTransfer(h, "owner");
  assert.equal(first.state, "awaiting_confirmation");
  assert.equal(first.finderConfirmed, false);
  assert.equal(
    confirmTransfer({ ...h, ...first }, "owner").state,
    "awaiting_confirmation",
  );
  assert.equal(
    confirmTransfer({ ...h, ...first }, "finder").state,
    "completed",
  );
});
test("code, participant and dispute gates protect completion", () => {
  assert.throws(() => confirmTransfer(h, "admin"));
  for (const state of [
    "pending",
    "scheduled",
    "disputed",
    "cancelled",
  ] as const)
    assert.throws(() => confirmTransfer({ ...h, state }, "owner"));
});

test("native links preserve known destinations and reject unknown paths", () => {
  assert.equal(appPath("lostandfound://item/abc-123"), "/item/abc-123");
  assert.equal(
    appPath("exp://127.0.0.1:8081/--/claim/case_1"),
    "/claim/case_1",
  );
  assert.equal(appPath("/help"), "/help");
  assert.equal(appPath("lostandfound://unknown/path"), "/");
});

test("sensitive claims require an administrator independent of the finder", () => {
  assert.throws(() =>
    canReview({ ...claim, requiresAdmin: true }, "finder", true),
  );
});
