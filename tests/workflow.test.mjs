import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
const require = createRequire(
  new URL("../functions/package.json", import.meta.url),
);
const { initializeApp, deleteApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const project = "demo-legon-recovery";
if (
  !process.env.FIRESTORE_EMULATOR_HOST ||
  !process.env.FIREBASE_AUTH_EMULATOR_HOST ||
  (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== project)
)
  throw new Error("Workflow tests only run against the named demo emulators.");
const app = initializeApp(
  {
    projectId: project,
    storageBucket: project + ".appspot.com",
  },
  "workflow-tests",
);
const db = getFirestore(app);
const auth = getAuth(app);
const tokens = {};
const endpoint = "http://127.0.0.1:5001/" + project + "/europe-west1/workflow";
before(async () => {
  for (const uid of [
    "owner",
    "owner2",
    "finder",
    "admin",
    "outsider",
    "unverified",
  ]) {
    try {
      await auth.createUser({
        uid,
        email: uid + "@example.com",
        emailVerified: uid !== "unverified",
        password: "Synthetic-test-password-42",
      });
    } catch (e) {
      if (
        e.code !== "auth/uid-already-exists" &&
        e.code !== "auth/email-already-exists"
      )
        throw e;
    }
    if (uid === "admin") await auth.setCustomUserClaims(uid, { admin: true });
    const response = await fetch(
      "http://" +
        process.env.FIREBASE_AUTH_EMULATOR_HOST +
        "/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: uid + "@example.com",
          password: "Synthetic-test-password-42",
          returnSecureToken: true,
        }),
      },
    );
    const payload = await response.json();
    assert.ok(payload.idToken, JSON.stringify(payload));
    tokens[uid] = payload.idToken;
  }
});
after(async () => {
  await Promise.all(getApps().map(deleteApp));
});
beforeEach(async () => {
  const result = await fetch(
    "http://" +
      process.env.FIRESTORE_EMULATOR_HOST +
      "/emulator/v1/projects/" +
      project +
      "/databases/(default)/documents",
    { method: "DELETE" },
  );
  assert.equal(result.ok, true);
});
async function call(uid, action, data = {}, requestId = randomUUID()) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(uid ? { Authorization: "Bearer " + tokens[uid] } : {}),
    },
    body: JSON.stringify({ data: { ...data, action, requestId } }),
  });
  const payload = await response.json();
  if (!response.ok || payload.error)
    throw new Error(payload.error?.message || JSON.stringify(payload));
  return payload.result;
}
const reportInput = {
  title: "Blue canvas backpack",
  description: "A blue canvas backpack with two shoulder straps.",
  type: "found",
  category: "Bag",
  color: "blue",
  brand: "Campus",
  location: "Balme Library",
  locationDetail: "",
  eventDate: "2026-09-10",
  approximateDate: false,
  photoPath: "",
  privateDetails: "A stitched moon inside the small pocket.",
  draft: false,
};
const claimInput = {
  answers: "There is a stitched moon inside the small pocket.",
  circumstances: "I left it beside my chair while studying at the library.",
};
async function setup(category = "Bag") {
  const report = await call("finder", "saveReport", {
    ...reportInput,
    category,
  });
  const claim = await call("owner", "submitClaim", {
    ...claimInput,
    reportId: report.id,
  });
  return { reportId: report.id, id: claim.id };
}
async function approved(category = "Bag") {
  const value = await setup(category);
  await call(category === "Bag" ? "finder" : "admin", "reviewClaim", {
    id: value.id,
    decision: "approved",
    note: "Independent private details are consistent with the reference.",
  });
  return value;
}
async function scheduled() {
  const value = await approved();
  await call("finder", "scheduleHandover", {
    id: value.id,
    location: "Public meeting point outside the library entrance",
    scheduledAt: new Date(Date.now() + 3600000).toISOString(),
  });
  await call("owner", "acceptSchedule", { id: value.id });
  return value;
}
test("callable rejects anonymous and unverified actors", async () => {
  await assert.rejects(call(null, "saveReport", reportInput), /sign in/i);
  await assert.rejects(
    call("unverified", "saveReport", reportInput),
    /verify/i,
  );
});
test("report secrets are separate and a retried request creates one report", async () => {
  const request = randomUUID();
  const a = await call(
    "finder",
    "saveReport",
    {
      ...reportInput,
      state: "recovered",
      authorEmail: "leak@example.com",
      admin: true,
    },
    request,
  );
  const b = await call("finder", "saveReport", reportInput, request);
  assert.equal(a.id, b.id);
  const publicReport = (await db.doc("reports/" + a.id).get()).data();
  assert.equal(publicReport.state, "open");
  assert.equal(publicReport.authorEmail, undefined);
  assert.equal(publicReport.privateDetails, undefined);
  assert.equal(publicReport.admin, undefined);
  assert.ok(publicReport.searchTokens.includes("back"));
  assert.equal(
    (await db.doc("reportPrivate/" + a.id).get()).data().privateDetails,
    reportInput.privateDetails,
  );
});
test("owner, outsider and finder cannot bypass required administrative review", async () => {
  const { id } = await setup("Phone");
  for (const actor of ["owner", "outsider", "finder"])
    await assert.rejects(
      call(actor, "reviewClaim", {
        id,
        decision: "approved",
        note: "I would like to approve this ownership claim.",
      }),
    );
  await call("admin", "reviewClaim", {
    id,
    decision: "approved",
    note: "Independent ownership review completed with private evidence.",
  });
});
test("competing claims require admin and only one can reserve the item", async () => {
  const { id, reportId } = await setup();
  const second = await call("owner2", "submitClaim", {
    ...claimInput,
    reportId,
  });
  assert.equal((await db.doc("claims/" + id).get()).data().requiresAdmin, true);
  await assert.rejects(
    call("finder", "reviewClaim", {
      id,
      decision: "approved",
      note: "Trying to review competing claims without admin.",
    }),
  );
  const decisions = await Promise.allSettled(
    [id, second.id].map((claimId) =>
      call("admin", "reviewClaim", {
        id: claimId,
        decision: "approved",
        note: "The supplied private evidence supports this claimant.",
      }),
    ),
  );
  assert.equal(decisions.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal((await db.collection("handovers").get()).size, 1);
});
test("full two-party handover counts one recovery; unilateral confirmation and replay fail", async () => {
  const { id, reportId } = await scheduled();
  await assert.rejects(call("owner", "confirmHandover", { id }));
  const { code } = await call("owner", "issueCode", { id });
  assert.match(code, /^\d{6}$/);
  await assert.rejects(call("owner", "verifyCode", { id, code }));
  await call("finder", "verifyCode", { id, code });
  await assert.rejects(call("finder", "verifyCode", { id, code }));
  await call("owner", "confirmHandover", { id });
  assert.equal(
    (await db.doc("reports/" + reportId).get()).data().state,
    "reserved",
  );
  await call("finder", "confirmHandover", { id });
  await call("finder", "confirmHandover", { id });
  assert.equal(
    (await db.doc("reports/" + reportId).get()).data().state,
    "recovered",
  );
  assert.equal((await db.collection("recoveries").get()).size, 1);
});
test("incorrect attempts persist, lock the code, and expired codes fail", async () => {
  const { id } = await scheduled();
  const { code } = await call("owner", "issueCode", { id });
  const wrong = code === "000000" ? "999999" : "000000";
  for (let i = 0; i < 5; i++) {
    const response = await call("finder", "verifyCode", { id, code: wrong });
    assert.equal(response.ok, false);
  }
  assert.equal(
    (await db.doc("handoverSecrets/" + id).get()).data().attempts,
    5,
  );
  await assert.rejects(call("finder", "verifyCode", { id, code }));
  await db.doc("handoverSecrets/" + id).update({ issuedAt: 0 });
  const fresh = await call("owner", "issueCode", { id });
  await db.doc("handoverSecrets/" + id).update({ expiresAt: Date.now() - 1 });
  await assert.rejects(
    call("finder", "verifyCode", { id, code: fresh.code }),
    /expired|unavailable|locked/i,
  );
});
test("dispute freezes completion and independent cancellation releases reservation", async () => {
  const { id, reportId } = await approved();
  await call("owner", "openDispute", {
    id,
    note: "The finder and I disagree about the item and need independent review.",
  });
  await assert.rejects(call("owner", "confirmHandover", { id }));
  await assert.rejects(
    call("finder", "resolveDispute", {
      id,
      resolution: "cancel",
      note: "I would like to resolve my own dispute without an independent reviewer.",
    }),
  );
  await call("admin", "resolveDispute", {
    id,
    resolution: "cancel",
    note: "After reviewing both accounts, the collection is cancelled and ownership remains unconfirmed.",
  });
  assert.equal(
    (await db.doc("reports/" + reportId).get()).data().state,
    "open",
  );
  assert.equal((await db.doc("claims/" + id).get()).data().state, "rejected");
});
test("reports with claim history cannot have their private reference rewritten", async () => {
  const { reportId } = await setup();
  await assert.rejects(
    call("finder", "saveReport", {
      ...reportInput,
      id: reportId,
      privateDetails: "Newly invented ownership clue after seeing a claim.",
    }),
    /history|edited/i,
  );
});
test("ordinary external closure never creates a verified recovery", async () => {
  const r = await call("finder", "saveReport", reportInput);
  await call("finder", "closeReport", {
    id: r.id,
    note: "Returned outside the platform.",
  });
  assert.equal((await db.doc("reports/" + r.id).get()).data().state, "closed");
  assert.equal((await db.collection("recoveries").get()).size, 0);
});

test("scheduled expiry freezes the case without silently releasing custody", async () => {
  const { id, reportId } = await approved();
  await db.doc("handovers/" + id).update({ expiresAt: Date.now() - 1 });
  const { maintainCases } = require("../functions/lib/functions/src/index.js");
  await maintainCases.run({ scheduleTime: new Date().toISOString() });
  assert.equal(
    (await db.doc("handovers/" + id).get()).data().state,
    "disputed",
  );
  assert.equal((await db.doc("claims/" + id).get()).data().state, "disputed");
  assert.equal(
    (await db.doc("disputes/" + id).get()).data().openedBy,
    "system",
  );
  assert.equal(
    (await db.doc("reports/" + reportId).get()).data().state,
    "reserved",
  );
  assert.equal((await db.collection("recoveries").get()).size, 0);
});

test("background matching creates a private suggestion and disables it after closure", async () => {
  const found = await call("finder", "saveReport", reportInput);
  const lost = await call("owner", "saveReport", {
    ...reportInput,
    type: "lost",
  });
  const { matchReports } = require("../functions/lib/functions/src/index.js");
  const snapshot = await db.doc("reports/" + lost.id).get();
  await matchReports.run({
    params: { reportId: lost.id },
    data: { after: snapshot },
  });
  const suggestions = await db
    .collection("matches")
    .where("foundReportId", "==", found.id)
    .get();
  assert.equal(suggestions.size, 1);
  assert.equal(suggestions.docs[0].data().active, true);
  assert.deepEqual(
    new Set(suggestions.docs[0].data().participantIds),
    new Set(["owner", "finder"]),
  );
  assert.equal(
    JSON.stringify(suggestions.docs[0].data()).includes(
      reportInput.privateDetails,
    ),
    false,
  );
  await call("finder", "closeReport", {
    id: found.id,
    note: "No longer available for matching.",
  });
  const closed = await db.doc("reports/" + found.id).get();
  await matchReports.run({
    params: { reportId: found.id },
    data: { after: closed },
  });
  assert.equal((await suggestions.docs[0].ref.get()).data().active, false);
});
