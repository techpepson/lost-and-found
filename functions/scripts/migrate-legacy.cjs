// Dry-run by default. Old public clues are never converted into verification secrets.
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldPath } = require("firebase-admin/firestore");
const projectId = process.argv[2];
const apply = process.argv.includes("--apply");
if (!projectId)
  throw new Error(
    "Usage: node functions/scripts/migrate-legacy.cjs PROJECT_ID [--apply]",
  );
initializeApp({ projectId });
const db = getFirestore();
(async () => {
  let cursor;
  let seen = 0;
  let staged = 0;
  while (true) {
    let query = db
      .collection("items")
      .orderBy(FieldPath.documentId())
      .limit(100);
    if (cursor) query = query.startAfter(cursor);
    const batch = await query.get();
    if (batch.empty) break;
    for (const doc of batch.docs) {
      seen++;
      const old = doc.data();
      const target = db.collection("reports").doc(doc.id);
      if ((await target.get()).exists || !old.authorId) continue;
      staged++;
      if (!apply) continue;
      await db.runTransaction(async (tx) => {
        if ((await tx.get(target)).exists) return;
        const now = Date.now();
        tx.create(target, {
          authorId: old.authorId,
          title: String(old.title || "Legacy report").slice(0, 80),
          description: String(old.description || "").slice(0, 1500),
          type: old.status === "found" ? "found" : "lost",
          state: "draft",
          category: [
            "Phone",
            "Wallet",
            "ID Card",
            "Bag",
            "Keys",
            "Others",
          ].includes(old.category)
            ? old.category
            : "Others",
          color: "",
          brand: "",
          location: "Other campus location",
          locationDetail: String(old.location || "").slice(0, 120),
          eventDate: /^\d{4}-\d{2}-\d{2}$/.test(old.date) ? old.date : "",
          approximateDate: true,
          photoPath: "",
          activeClaimId: null,
          requiresAdmin: true,
          createdAt: old.createdAt?.toMillis?.() ?? now,
          updatedAt: now,
          schemaVersion: 2,
          migrationNeedsReview: true,
          searchTokens: [],
        });
        tx.create(db.collection("reportPrivate").doc(doc.id), {
          authorId: old.authorId,
          privateDetails: "",
          updatedAt: now,
        });
        tx.create(db.collection("auditEvents").doc(), {
          caseId: doc.id,
          actorId: "migration",
          action: "legacyQuarantined",
          note: "Legacy report staged as a draft; author must review public content, dates and new private clues before publishing",
          participantIds: [old.authorId],
          createdAt: now,
        });
      });
    }
    cursor = batch.docs.at(-1);
  }
  console.log(
    JSON.stringify(
      {
        mode: apply ? "staged-as-private-drafts" : "dry-run",
        scanned: seen,
        eligible: staged,
        note: "Original items retained. No public images or email addresses copied. Review old Storage download tokens separately.",
      },
      null,
      2,
    ),
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
