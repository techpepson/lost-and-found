import { test, before, after, beforeEach } from "node:test";
import { readFile } from "node:fs/promises";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getBytes } from "firebase/storage";
let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-legon-recovery",
    firestore: {
      rules: await readFile(
        new URL("../firestore.rules", import.meta.url),
        "utf8",
      ),
      host: "127.0.0.1",
      port: 8080,
    },
    storage: {
      rules: await readFile(
        new URL("../storage.rules", import.meta.url),
        "utf8",
      ),
      host: "127.0.0.1",
      port: 9199,
    },
  });
});
after(async () => {
  await env?.cleanup();
});
const context = (uid, extras = {}) =>
  env.authenticatedContext(uid, {
    email: uid + "@example.com",
    email_verified: true,
    ...extras,
  });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await Promise.all([
      setDoc(doc(db, "users/owner"), {
        uid: "owner",
        suspended: false,
        eligible: true,
      }),
      setDoc(doc(db, "users/finder"), {
        uid: "finder",
        suspended: false,
        eligible: true,
      }),
      setDoc(doc(db, "users/suspended"), { uid: "suspended", suspended: true }),
      setDoc(doc(db, "users/admin"), {
        uid: "admin",
        suspended: false,
        eligible: true,
        adminEnabled: true,
      }),
      setDoc(doc(db, "users/revoked-admin"), {
        uid: "revoked-admin",
        suspended: false,
        eligible: true,
        adminEnabled: false,
      }),
      setDoc(doc(db, "reports/found"), {
        authorId: "finder",
        state: "open",
        type: "found",
      }),
      setDoc(doc(db, "reports/draft"), { authorId: "finder", state: "draft" }),
      setDoc(doc(db, "reportPrivate/found"), {
        authorId: "finder",
        privateDetails: "private clue",
      }),
      setDoc(doc(db, "claims/case"), {
        claimantId: "owner",
        finderId: "finder",
        participantIds: ["owner", "finder"],
        state: "submitted",
      }),
      setDoc(doc(db, "handoverSecrets/case"), { verifier: "never readable" }),
      setDoc(doc(db, "notifications/notice"), {
        userId: "owner",
        title: "Update",
        read: false,
      }),
      setDoc(doc(db, "auditEvents/event"), {
        participantIds: ["owner", "finder"],
        note: "Review",
      }),
    ]);
  });
});
test("only verified active accounts may browse safe reports", async () => {
  await assertSucceeds(
    getDoc(doc(context("owner").firestore(), "reports/found")),
  );
  await assertFails(
    getDoc(doc(env.unauthenticatedContext().firestore(), "reports/found")),
  );
  await assertFails(
    getDoc(
      doc(
        context("unverified", { email_verified: false }).firestore(),
        "reports/found",
      ),
    ),
  );
  await assertFails(
    getDoc(doc(context("suspended").firestore(), "reports/found")),
  );
});
test("drafts and ownership reference clues are not visible to claimants", async () => {
  await assertFails(getDoc(doc(context("owner").firestore(), "reports/draft")));
  await assertFails(
    getDoc(doc(context("owner").firestore(), "reportPrivate/found")),
  );
  await assertSucceeds(
    getDoc(doc(context("finder").firestore(), "reportPrivate/found")),
  );
  await assertSucceeds(
    getDoc(
      doc(context("admin", { admin: true }).firestore(), "reportPrivate/found"),
    ),
  );
});
test("no user or admin client can forge workflow writes or privileges", async () => {
  for (const ctx of [context("owner"), context("admin", { admin: true })]) {
    await assertFails(
      setDoc(doc(ctx.firestore(), "reports/forged"), { state: "recovered" }),
    );
    await assertFails(
      updateDoc(doc(ctx.firestore(), "claims/case"), { state: "approved" }),
    );
    await assertFails(
      setDoc(doc(ctx.firestore(), "users/owner"), { admin: true }),
    );
    await assertFails(
      setDoc(doc(ctx.firestore(), "recoveries/fake"), { completedAt: 1 }),
    );
  }
});
test("claimants and finders can read cases; outsiders cannot", async () => {
  for (const uid of ["owner", "finder"])
    await assertSucceeds(getDoc(doc(context(uid).firestore(), "claims/case")));
  await assertFails(
    getDoc(doc(context("stranger").firestore(), "claims/case")),
  );
  await assertFails(
    getDocs(query(collection(context("owner").firestore(), "claims"))),
  );
  await assertSucceeds(
    getDocs(
      query(
        collection(context("owner").firestore(), "claims"),
        where("participantIds", "array-contains", "owner"),
      ),
    ),
  );
});
test("handover secrets are inaccessible even to admin clients", async () => {
  for (const ctx of [
    context("owner"),
    context("finder"),
    context("admin", { admin: true }),
  ])
    await assertFails(getDoc(doc(ctx.firestore(), "handoverSecrets/case")));
});
test("a stale administrator token cannot read evidence after role revocation", async () => {
  await assertFails(
    getDoc(
      doc(
        context("revoked-admin", { admin: true }).firestore(),
        "reportPrivate/found",
      ),
    ),
  );
});
test("only the notification owner may mark read without changing contents", async () => {
  await assertSucceeds(
    updateDoc(doc(context("owner").firestore(), "notifications/notice"), {
      read: true,
    }),
  );
  await assertFails(
    updateDoc(doc(context("finder").firestore(), "notifications/notice"), {
      read: true,
    }),
  );
  await assertFails(
    updateDoc(doc(context("owner").firestore(), "notifications/notice"), {
      title: "Forged",
    }),
  );
});
test("bookmarks use owner-scoped deterministic IDs and cannot be forged", async () => {
  const db = context("owner").firestore();
  await assertSucceeds(
    setDoc(doc(db, "savedItems/owner_found"), {
      userId: "owner",
      reportId: "found",
      createdAt: serverTimestamp(),
    }),
  );
  await assertFails(
    setDoc(doc(db, "savedItems/other"), {
      userId: "owner",
      reportId: "found",
      createdAt: serverTimestamp(),
    }),
  );
  await assertFails(
    setDoc(doc(db, "savedItems/owner_draft"), {
      userId: "owner",
      reportId: "draft",
      createdAt: serverTimestamp(),
    }),
  );
});
test("audit events are immutable and case-scoped", async () => {
  await assertSucceeds(
    getDoc(doc(context("owner").firestore(), "auditEvents/event")),
  );
  await assertFails(
    getDoc(doc(context("outsider").firestore(), "auditEvents/event")),
  );
  await assertFails(
    updateDoc(doc(context("owner").firestore(), "auditEvents/event"), {
      note: "changed",
    }),
  );
});
test("evidence storage permits claimant uploads and admin reads, never finder access", async () => {
  const path = "evidence/owner/case/" + Date.now();
  const bytes = new Uint8Array([137, 80, 78, 71]);
  await assertSucceeds(
    uploadBytes(ref(context("owner").storage(), path), bytes, {
      contentType: "image/png",
    }),
  );
  await assertSucceeds(getBytes(ref(context("owner").storage(), path)));
  await assertSucceeds(
    getBytes(ref(context("admin", { admin: true }).storage(), path)),
  );
  await assertFails(getBytes(ref(context("finder").storage(), path)));
  await assertFails(
    uploadBytes(
      ref(context("finder").storage(), "evidence/finder/case/file"),
      bytes,
      { contentType: "image/png" },
    ),
  );
  await assertFails(
    uploadBytes(ref(context("owner").storage(), path + "html"), bytes, {
      contentType: "text/html",
    }),
  );
});
