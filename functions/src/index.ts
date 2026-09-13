import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Transaction } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  randomInt,
  randomBytes,
  createHash,
  timingSafeEqual,
} from "node:crypto";
import {
  DomainError,
  requireCondition as check,
  textValue,
  validateReport,
  needsAdmin,
  canReview,
  confirmTransfer,
  scoreMatch,
  Report,
  Claim,
  Handover,
} from "../../shared/domain";

initializeApp();
const db = getFirestore();
const region = "europe-west1";
const options = {
  region,
  maxInstances: 10,
  timeoutSeconds: 60,
  enforceAppCheck: process.env.ENFORCE_APP_CHECK === "true",
};
const ref = (collection: string, id: string) =>
  db.collection(collection).doc(id);
function identifier(value: unknown): string {
  const id = textValue(value, "Identifier", 1, 160);
  check(/^[a-zA-Z0-9_-]+$/.test(id), "Invalid identifier.");
  return id;
}
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
function audit(
  tx: Transaction,
  caseId: string,
  uid: string,
  action: string,
  note: string,
  participants: string[],
  now: number,
) {
  tx.create(db.collection("auditEvents").doc(), {
    caseId,
    actorId: uid,
    action,
    note,
    participantIds: participants,
    createdAt: now,
  });
}
function notify(
  tx: Transaction,
  uid: string,
  key: string,
  title: string,
  body: string,
  href: string,
  now: number,
) {
  tx.set(ref("notifications", digest(uid + key)), {
    userId: uid,
    title,
    body,
    href,
    read: false,
    createdAt: now,
  });
}
async function rateLimit(uid: string, action: string) {
  const window = action === "submitClaim" ? 3600000 : 60000;
  const max = action === "submitClaim" ? 5 : 60;
  const r = ref(
    "rateLimits",
    uid + "_" + (action === "submitClaim" ? "claims" : "actions"),
  );
  await db.runTransaction(async (tx) => {
    const s = await tx.get(r);
    const d = s.data();
    const now = Date.now();
    const count = d && now - d.start < window ? d.count + 1 : 1;
    if (count > max)
      throw new HttpsError(
        "resource-exhausted",
        "Please wait before trying again.",
      );
    tx.set(r, { count, start: count === 1 ? now : d!.start });
  });
}
async function validateFile(path: string, uid: string, prefix: string) {
  check(
    path.startsWith(prefix + "/" + uid + "/") &&
      !path.includes("..") &&
      path.length < 250,
    "Invalid upload path.",
  );
  const file = getStorage().bucket().file(path);
  const [meta] = await file.getMetadata();
  check(
    Number(meta.size) <= 4 * 1024 * 1024,
    "Files must be smaller than 4 MB.",
  );
  const [bytes] = await file.download({ start: 0, end: 15 });
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp =
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP";
  check(
    (jpeg && meta.contentType === "image/jpeg") ||
      (png && meta.contentType === "image/png") ||
      (webp && meta.contentType === "image/webp"),
    "Upload a valid JPEG, PNG or WebP image.",
  );
}

export const workflow = onCall(options, async (request) => {
  try {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "Please sign in.");
    const uid = request.auth.uid;
    const user = await getAuth().getUser(uid);
    if (user.disabled)
      throw new HttpsError("permission-denied", "This account is suspended.");
    const admin = user.customClaims?.admin === true;
    const data = request.data as Record<string, any>;
    check(data && typeof data === "object", "Invalid request.");
    const action = textValue(data.action, "Action", 1, 40);
    const now = Date.now();
    if (action === "syncProfile") {
      await rateLimit(uid, action);
      const displayName = textValue(
        data.displayName ?? user.displayName ?? "",
        "Name",
        0,
        80,
      );
      const domains = (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
        .split(",")
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean);
      const eligible =
        admin ||
        !domains.length ||
        domains.includes(user.email?.split("@")[1]?.toLowerCase() ?? "");
      if (displayName !== (user.displayName ?? ""))
        await getAuth().updateUser(uid, { displayName });
      const profile = {
        uid,
        email: user.email ?? "",
        displayName,
        eligible,
        adminEnabled: admin,
        verified: user.emailVerified,
        updatedAt: now,
      };
      await ref("users", uid).set(profile, { merge: true });
      return { ok: true };
    }
    if (!user.emailVerified)
      throw new HttpsError(
        "permission-denied",
        "Verify your email address before continuing.",
      );
    const allowed = (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
    if (
      !admin &&
      allowed.length &&
      !allowed.includes(user.email?.split("@")[1]?.toLowerCase() ?? "")
    )
      throw new HttpsError(
        "permission-denied",
        "This pilot is limited to approved campus email domains.",
      );
    await rateLimit(uid, action);
    if (action === "setUserSuspended") {
      check(admin, "Administrator access required.");
      const target = identifier(data.userId);
      check(target !== uid, "You cannot suspend yourself.");
      const targetUser = await getAuth().getUser(target);
      check(
        targetUser.customClaims?.admin !== true,
        "Manage administrators through the trusted setup tool.",
      );
      const reason = textValue(data.note, "Reason", 10, 1000);
      const suspended = data.suspended === true;
      if (suspended)
        await ref("users", target).set(
          { suspended: true, updatedAt: now },
          { merge: true },
        );
      await getAuth().updateUser(target, { disabled: suspended });
      if (suspended) await getAuth().revokeRefreshTokens(target);
      await db.runTransaction(async (tx) => {
        tx.set(
          ref("users", target),
          { suspended, updatedAt: now },
          { merge: true },
        );
        audit(tx, target, uid, action, reason, [], now);
      });
      return { ok: true };
    }
    const requestId = identifier(data.requestId);
    const operationRef = ref("operations", uid + "_" + requestId);
    if (action === "saveReport" && data.photoPath)
      await validateFile(textValue(data.photoPath, "Photo"), uid, "photos");
    if (action === "attachEvidence")
      await validateFile(textValue(data.path, "Evidence"), uid, "evidence");
    return await db.runTransaction(async (tx) => {
      const operation = await tx.get(operationRef);
      if (operation.exists) {
        check(
          operation.data()!.action === action,
          "Request identifier was already used.",
        );
        return operation.data()!.result;
      }
      let result: Record<string, unknown> = { ok: true };
      if (action === "saveReport") {
        const input = validateReport(data, now);
        const id = data.id ? identifier(data.id) : requestId;
        const reportRef = ref("reports", id);
        const existing = await tx.get(reportRef);
        if (existing.exists) {
          const old = existing.data() as Report;
          check(old.authorId === uid, "Only the author can edit this report.");
          check(
            ["draft", "open"].includes(old.state),
            "This report cannot be edited while reserved or closed.",
          );
          check(!old.activeClaimId, "A reserved report cannot be edited.");
          const claims = await tx.get(
            db.collection("claims").where("reportId", "==", id).limit(1),
          );
          check(
            claims.empty,
            "Reports with claim history cannot be edited. Close the report or contact an administrator.",
          );
        }
        const { privateDetails, draft, ...safe } = input;
        const words = (
          safe.title +
          " " +
          safe.description +
          " " +
          safe.brand +
          " " +
          safe.color
        )
          .toLowerCase()
          .replace(/[^a-z0-9 ]/g, " ")
          .split(/\s+/)
          .filter(Boolean);
        const searchTokens = [
          ...new Set(
            words.flatMap((word) =>
              Array.from(
                { length: Math.max(0, Math.min(word.length, 24) - 1) },
                (_, i) => word.slice(0, i + 2),
              ),
            ),
          ),
        ].slice(0, 1000);
        tx.set(reportRef, {
          ...safe,
          searchTokens,
          authorId: uid,
          state: draft ? "draft" : "open",
          activeClaimId: null,
          requiresAdmin: needsAdmin(input.category),
          createdAt: existing.data()?.createdAt ?? now,
          updatedAt: now,
          schemaVersion: 2,
        });
        tx.set(ref("reportPrivate", id), {
          authorId: uid,
          privateDetails,
          updatedAt: now,
        });
        audit(
          tx,
          id,
          uid,
          action,
          draft ? "Draft saved" : "Report published",
          [uid],
          now,
        );
        result = { id };
      } else if (action === "closeReport" || action === "moderateReport") {
        const id = identifier(data.id);
        const r = ref("reports", id);
        const snap = await tx.get(r);
        check(snap.exists, "Report not found.");
        const report = snap.data() as Report;
        check(
          action === "moderateReport" ? admin : report.authorId === uid,
          "You cannot change this report.",
        );
        check(
          !report.activeClaimId &&
            ["open", "draft", "closed", "archived"].includes(report.state),
          "Resolve the active handover before closing this report.",
        );
        const note = textValue(data.note, "Reason", 5, 1000);
        tx.update(r, {
          state: action === "moderateReport" ? "archived" : "closed",
          updatedAt: now,
        });
        audit(tx, id, uid, action, note, [report.authorId], now);
      } else if (action === "submitClaim") {
        const reportId = identifier(data.reportId);
        const reportRef = ref("reports", reportId);
        const reportSnap = await tx.get(reportRef);
        check(reportSnap.exists, "Report not found.");
        const report = reportSnap.data() as Report;
        check(
          report.type === "found" && report.state === "open",
          "This found item is not available for claims.",
        );
        check(report.authorId !== uid, "You cannot claim your own report.");
        const id = digest(reportId + ":" + uid);
        const claimRef = ref("claims", id);
        const old = await tx.get(claimRef);
        check(
          !old.exists,
          "You already have a claim for this item. Open it from My activity.",
        );
        const answers = textValue(
          data.answers,
          "Private description",
          20,
          2000,
        );
        const circumstances = textValue(
          data.circumstances,
          "Circumstances",
          10,
          1500,
        );
        const lostReportId = data.lostReportId
          ? identifier(data.lostReportId)
          : null;
        if (lostReportId) {
          const lost = await tx.get(ref("reports", lostReportId));
          check(
            lost.exists &&
              lost.data()!.authorId === uid &&
              lost.data()!.type === "lost" &&
              lost.data()!.state === "open",
            "Choose one of your open lost reports.",
          );
        }
        const otherClaims = await tx.get(
          db
            .collection("claims")
            .where("reportId", "==", reportId)
            .where("state", "in", [
              "submitted",
              "under_review",
              "needs_information",
            ])
            .limit(100),
        );
        const requiresAdmin = report.requiresAdmin || !otherClaims.empty;
        const claim = {
          reportId,
          reportTitle: report.title,
          claimantId: uid,
          finderId: report.authorId,
          participantIds: [uid, report.authorId],
          lostReportId,
          answers,
          circumstances,
          state: "submitted",
          requiresAdmin,
          evidencePaths: [],
          reviewNote: "",
          createdAt: now,
          updatedAt: now,
        };
        tx.create(claimRef, claim);
        for (const other of otherClaims.docs)
          tx.update(other.ref, { requiresAdmin: true, updatedAt: now });
        if (requiresAdmin)
          tx.update(reportRef, { requiresAdmin: true, updatedAt: now });
        notify(
          tx,
          report.authorId,
          requestId,
          "New ownership claim",
          "A claim is ready for review.",
          "/claim/" + id,
          now,
        );
        audit(
          tx,
          id,
          uid,
          action,
          "Ownership claim submitted",
          claim.participantIds,
          now,
        );
        result = { id };
      } else {
        const id = identifier(data.id);
        const claimRef = ref("claims", id);
        const claimSnap = await tx.get(claimRef);
        check(claimSnap.exists, "Claim not found.");
        const claim = { id, ...claimSnap.data() } as Claim;
        check(
          admin || claim.participantIds.includes(uid),
          "You do not have access to this case.",
        );
        const reportRef = ref("reports", claim.reportId);
        const reportSnap = await tx.get(reportRef);
        check(reportSnap.exists, "Report not found.");
        const report = reportSnap.data() as Report;
        const hRef = ref("handovers", id);
        const hSnap = await tx.get(hRef);
        const h = hSnap.exists ? ({ id, ...hSnap.data() } as Handover) : null;
        let note = "";
        if (action === "attachEvidence") {
          check(
            uid === claim.claimantId &&
              ["submitted", "needs_information", "under_review"].includes(
                claim.state,
              ),
            "Evidence cannot be added to this claim now.",
          );
          const path = textValue(data.path, "Evidence");
          check(
            path.startsWith("evidence/" + uid + "/" + id + "/"),
            "Evidence belongs to another case.",
          );
          check(
            claim.evidencePaths.length < 5,
            "A case can have up to five evidence files.",
          );
          tx.update(claimRef, {
            evidencePaths: [...new Set([...claim.evidencePaths, path])],
            updatedAt: now,
          });
          tx.set(ref("evidence", digest(path)), {
            path,
            claimId: id,
            userId: uid,
            createdAt: now,
            removed: false,
          });
          note = "Private evidence attached";
        } else if (action === "provideInformation") {
          check(
            uid === claim.claimantId && claim.state === "needs_information",
            "Additional information was not requested.",
          );
          tx.update(claimRef, {
            answers: textValue(data.answers, "Private description", 20, 2000),
            circumstances: textValue(
              data.circumstances,
              "Circumstances",
              10,
              1500,
            ),
            state: "submitted",
            updatedAt: now,
          });
          note = "Additional information submitted";
        } else if (action === "reviewClaim") {
          canReview(claim, uid, admin);
          const decision = textValue(data.decision, "Decision");
          check(
            [
              "approved",
              "rejected",
              "needs_information",
              "under_review",
            ].includes(decision),
            "Choose a review decision.",
          );
          note = textValue(data.note, "Review reason", 10, 1000);
          check(
            report.state === "open" && !report.activeClaimId,
            "Another claim has reserved this item or the report is closed.",
          );
          let lostRef = null;
          if (decision === "approved" && claim.lostReportId) {
            lostRef = ref("reports", claim.lostReportId);
            const lost = await tx.get(lostRef);
            check(
              lost.exists &&
                lost.data()!.authorId === claim.claimantId &&
                lost.data()!.state === "open",
              "The linked lost report is no longer available.",
            );
          }
          tx.update(claimRef, {
            state: decision,
            reviewNote: note,
            updatedAt: now,
          });
          if (decision === "approved") {
            tx.update(reportRef, {
              state: "reserved",
              activeClaimId: id,
              updatedAt: now,
            });
            if (lostRef)
              tx.update(lostRef, {
                state: "reserved",
                activeClaimId: id,
                updatedAt: now,
              });
            tx.set(hRef, {
              reportId: claim.reportId,
              participantIds: claim.participantIds,
              claimantId: claim.claimantId,
              finderId: claim.finderId,
              state: "pending",
              location: "",
              scheduledAt: "",
              scheduleAccepted: false,
              ownerConfirmed: false,
              finderConfirmed: false,
              createdAt: now,
              updatedAt: now,
              expiresAt: now + 7 * 86400000,
            });
          }
        } else if (action === "withdrawClaim") {
          check(
            uid === claim.claimantId &&
              ["submitted", "under_review", "needs_information"].includes(
                claim.state,
              ),
            "Use a dispute to cancel an approved handover.",
          );
          tx.update(claimRef, { state: "withdrawn", updatedAt: now });
          note = "Claim withdrawn";
        } else if (action === "openDispute") {
          check(
            claim.participantIds.includes(uid),
            "Only a case participant can open a dispute.",
          );
          check(
            !["withdrawn", "disputed"].includes(claim.state),
            "This claim cannot be disputed now.",
          );
          note = textValue(data.note, "Dispute reason", 20, 2000);
          const oldDispute = await tx.get(ref("disputes", id));
          check(
            !oldDispute.exists,
            "A dispute already exists. Contact an administrator for further review.",
          );
          tx.create(ref("disputes", id), {
            claimId: id,
            reportId: claim.reportId,
            participantIds: claim.participantIds,
            openedBy: uid,
            reason: note,
            state: "open",
            previousClaimState: claim.state,
            previousHandoverState: h?.state ?? null,
            createdAt: now,
            updatedAt: now,
          });
          tx.update(claimRef, {
            state: "disputed",
            requiresAdmin: true,
            updatedAt: now,
          });
          if (h) tx.update(hRef, { state: "disputed", updatedAt: now });
        } else if (action === "resolveDispute") {
          check(
            admin && !claim.participantIds.includes(uid),
            "An independent administrator must resolve the dispute.",
          );
          const dRef = ref("disputes", id);
          const dSnap = await tx.get(dRef);
          check(
            dSnap.exists && dSnap.data()!.state === "open",
            "No open dispute.",
          );
          const dispute = dSnap.data()!;
          note = textValue(data.note, "Resolution reason", 20, 2000);
          const resolution = data.resolution;
          check(
            ["resume", "cancel"].includes(resolution),
            "Choose resume or cancel.",
          );
          let lostRef = null;
          if (claim.lostReportId) {
            const candidate = ref("reports", claim.lostReportId);
            const lost = await tx.get(candidate);
            if (lost.exists && lost.data()!.activeClaimId === id)
              lostRef = candidate;
          }
          check(
            dispute.previousHandoverState !== "completed" ||
              resolution === "resume",
            "A completed transfer cannot be undone; record a resolution and preserve its history.",
          );
          tx.update(dRef, {
            state: "resolved",
            resolution: note,
            outcome: resolution,
            resolvedBy: uid,
            updatedAt: now,
          });
          if (resolution === "resume") {
            tx.update(claimRef, {
              state: dispute.previousClaimState,
              reviewNote: note,
              updatedAt: now,
            });
            if (h)
              tx.update(hRef, {
                state: dispute.previousHandoverState ?? "pending",
                expiresAt: now + 7 * 86400000,
                updatedAt: now,
              });
          } else {
            tx.update(claimRef, {
              state: "rejected",
              reviewNote: note,
              updatedAt: now,
            });
            if (h) tx.update(hRef, { state: "cancelled", updatedAt: now });
            if (report.activeClaimId === id)
              tx.update(reportRef, {
                state: "open",
                activeClaimId: null,
                updatedAt: now,
              });
            if (lostRef)
              tx.update(lostRef, {
                state: "open",
                activeClaimId: null,
                updatedAt: now,
              });
          }
          tx.delete(ref("handoverSecrets", id));
        } else {
          check(
            h && claim.state === "approved" && report.activeClaimId === id,
            "There is no active approved handover.",
          );
          check(
            claim.participantIds.includes(uid),
            "Only the two participants can perform the handover.",
          );
          check(
            h.expiresAt > now || h.state === "completed",
            "This reservation has expired. Contact an administrator.",
          );
          if (action === "scheduleHandover") {
            check(
              uid === claim.finderId &&
                ["pending", "scheduled"].includes(h.state),
              "Only the finder can propose or change collection details before verification.",
            );
            const location = textValue(
              data.location,
              "Collection location",
              5,
              200,
            );
            const scheduledAt = textValue(
              data.scheduledAt,
              "Collection time",
              10,
              40,
            );
            const time = Date.parse(scheduledAt);
            check(
              Number.isFinite(time) && time > now && time < now + 6 * 86400000,
              "Choose a collection time within the next six days.",
            );
            tx.update(hRef, {
              location,
              scheduledAt: new Date(time).toISOString(),
              scheduleAccepted: false,
              state: "scheduled",
              expiresAt: time + 86400000,
              updatedAt: now,
            });
            tx.delete(ref("handoverSecrets", id));
            note = "Collection details proposed";
          } else if (action === "acceptSchedule") {
            check(
              uid === claim.claimantId && h.state === "scheduled",
              "Only the owner can accept a proposed collection.",
            );
            tx.update(hRef, { scheduleAccepted: true, updatedAt: now });
            note = "Collection details accepted";
          } else if (action === "issueCode") {
            check(
              uid === claim.claimantId &&
                h.state === "scheduled" &&
                h.scheduleAccepted,
              "Accept the collection details before generating a code.",
            );
            const secretRef = ref("handoverSecrets", id);
            const previous = await tx.get(secretRef);
            check(
              !previous.exists || now - previous.data()!.issuedAt >= 60000,
              "Wait one minute before requesting a replacement code.",
            );
            const code = randomInt(0, 1000000).toString().padStart(6, "0");
            const salt = randomBytes(24).toString("hex");
            tx.set(secretRef, {
              salt,
              verifier: digest(salt + code),
              issuedAt: now,
              expiresAt: now + 10 * 60000,
              attempts: 0,
              used: false,
            });
            result = { code, expiresAt: now + 10 * 60000 };
            note = "Collection code issued";
          } else if (action === "verifyCode") {
            check(
              uid === claim.finderId &&
                h.state === "scheduled" &&
                h.scheduleAccepted,
              "Only the finder can verify a code for an accepted collection.",
            );
            const secretRef = ref("handoverSecrets", id);
            const secretSnap = await tx.get(secretRef);
            const secret = secretSnap.data();
            check(
              secret &&
                !secret.used &&
                secret.expiresAt > now &&
                secret.attempts < 5,
              "The code is unavailable, expired or locked. Ask the owner to generate a new one.",
            );
            const code = textValue(data.code, "Code", 6, 6);
            check(/^\d{6}$/.test(code), "Enter the six-digit collection code.");
            const valid = timingSafeEqual(
              Buffer.from(secret.verifier, "hex"),
              Buffer.from(digest(secret.salt + code), "hex"),
            );
            tx.update(secretRef, {
              attempts: secret.attempts + 1,
              used: valid,
            });
            if (valid) {
              tx.update(hRef, { state: "code_verified", updatedAt: now });
              note = "Collection code verified";
            } else {
              result = {
                ok: false,
                error:
                  "Incorrect collection code. Please check with the owner.",
              };
              note = "Unsuccessful code attempt";
            }
          } else if (action === "confirmHandover") {
            const changes = confirmTransfer(h, uid);
            let lostRef = null;
            if (claim.lostReportId) {
              const candidate = ref("reports", claim.lostReportId);
              const lost = await tx.get(candidate);
              check(
                lost.exists && lost.data()!.activeClaimId === id,
                "Linked report needs administrative review.",
              );
              lostRef = candidate;
            }
            tx.update(hRef, { ...changes, updatedAt: now });
            if (changes.state === "completed" && h.state !== "completed") {
              tx.update(reportRef, { state: "recovered", updatedAt: now });
              if (lostRef)
                tx.update(lostRef, { state: "recovered", updatedAt: now });
              tx.delete(ref("handoverSecrets", id));
              tx.create(ref("recoveries", id), {
                claimId: id,
                reportId: claim.reportId,
                lostReportId: claim.lostReportId,
                participantIds: claim.participantIds,
                completedAt: now,
              });
            }
            note =
              changes.state === "completed"
                ? "Both participants confirmed recovery"
                : "One participant confirmed physical transfer";
          } else throw new DomainError("Unknown action.");
        }
        audit(tx, id, uid, action, note, claim.participantIds, now);
        if (action !== "issueCode" && action !== "verifyCode")
          for (const participant of claim.participantIds)
            if (participant !== uid)
              notify(
                tx,
                participant,
                requestId,
                "Your recovery case has an update",
                note,
                "/claim/" + id,
                now,
              );
      }
      // Codes are only returned once; the idempotency record never contains plaintext codes.
      tx.create(operationRef, {
        action,
        result:
          action === "issueCode" ? { ok: true, alreadyIssued: true } : result,
        createdAt: now,
      });
      return result;
    });
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    if (error instanceof DomainError)
      throw new HttpsError("failed-precondition", error.message);
    console.error(
      "Workflow failed",
      error instanceof Error ? error.name : "Unknown error",
    );
    throw new HttpsError(
      "internal",
      "The request could not be completed. Please retry or contact an administrator.",
    );
  }
});

export const matchReports = onDocumentWritten(
  { document: "reports/{reportId}", region, maxInstances: 5 },
  async (event) => {
    const id = event.params.reportId;
    const current = await ref("reports", id).get();
    const existing = await db
      .collection("matches")
      .where("reportIds", "array-contains", id)
      .limit(200)
      .get();
    if (!current.exists) {
      for (const match of existing.docs)
        await match.ref.update({ active: false });
      return;
    }
    const r = { id, ...current.data() } as Report;
    const candidateIds = new Set(
      existing.docs
        .flatMap((d) => d.data().reportIds as string[])
        .filter((v) => v !== id),
    );
    if (r.state === "open") {
      const candidates = await db
        .collection("reports")
        .where("type", "==", r.type === "lost" ? "found" : "lost")
        .where("category", "==", r.category)
        .where("state", "==", "open")
        .orderBy("createdAt", "desc")
        .limit(100)
        .get();
      candidates.docs.forEach((d) => candidateIds.add(d.id));
    }
    for (const candidateId of candidateIds)
      await db.runTransaction(async (tx) => {
        const aSnap = await tx.get(ref("reports", id));
        const bSnap = await tx.get(ref("reports", candidateId));
        if (!aSnap.exists || !bSnap.exists) return;
        const a = { id, ...aSnap.data() } as Report;
        const b = { id: candidateId, ...bSnap.data() } as Report;
        const lost = a.type === "lost" ? a : b;
        const found = a.type === "found" ? a : b;
        const matchId = digest([id, candidateId].sort().join(":"));
        const mRef = ref("matches", matchId);
        const old = await tx.get(mRef);
        const { score, reasons } = scoreMatch(a, b);
        const active = score >= 60 && a.authorId !== b.authorId;
        const now = Date.now();
        if (!active && !old.exists) return;
        tx.set(mRef, {
          reportIds: [id, candidateId],
          participantIds: [a.authorId, b.authorId],
          lostReportId: lost.id,
          foundReportId: found.id,
          lostTitle: lost.title,
          foundTitle: found.title,
          score,
          reasons,
          active,
          version: "rules-v1",
          updatedAt: now,
        });
        if (active && !old.exists)
          for (const participant of [a.authorId, b.authorId])
            notify(
              tx,
              participant,
              matchId,
              "A possible match was found",
              "Compare the reports, then use the ownership claim process.",
              "/item/" + found.id,
              now,
            );
      });
  },
);

export const maintainCases = onSchedule(
  { schedule: "every 60 minutes", region, maxInstances: 1 },
  async () => {
    const now = Date.now();
    const expired = await db
      .collection("handovers")
      .where("state", "in", [
        "pending",
        "scheduled",
        "code_verified",
        "awaiting_confirmation",
      ])
      .where("expiresAt", "<", now)
      .limit(100)
      .get();
    for (const doc of expired.docs)
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(doc.ref);
        const h = snap.data() as Handover;
        if (
          !h ||
          h.expiresAt >= now ||
          ![
            "pending",
            "scheduled",
            "code_verified",
            "awaiting_confirmation",
          ].includes(h.state)
        )
          return;
        const c = await tx.get(ref("claims", doc.id));
        if (!c.exists) return;
        const claim = c.data() as Claim;
        const dRef = ref("disputes", doc.id);
        const old = await tx.get(dRef);
        tx.update(doc.ref, { state: "disputed", updatedAt: now });
        tx.update(c.ref, {
          state: "disputed",
          requiresAdmin: true,
          updatedAt: now,
        });
        tx.set(dRef, {
          claimId: doc.id,
          reportId: h.reportId,
          participantIds: h.participantIds,
          openedBy: "system",
          reason:
            "Reservation expired or a participant did not confirm transfer.",
          previousClaimState: claim.state,
          previousHandoverState: h.state,
          state: "open",
          createdAt: old.data()?.createdAt ?? now,
          updatedAt: now,
        });
        tx.delete(ref("handoverSecrets", doc.id));
        audit(
          tx,
          doc.id,
          "system",
          "reservationExpired",
          "Review required before releasing the reservation",
          h.participantIds,
          now,
        );
        for (const participant of h.participantIds)
          notify(
            tx,
            participant,
            doc.id + "_expired",
            "Collection needs review",
            "An administrator will review the expired reservation.",
            "/claim/" + doc.id,
            now,
          );
      });
    const evidence = await db
      .collection("evidence")
      .where("removed", "==", false)
      .where("createdAt", "<", now - 90 * 86400000)
      .limit(100)
      .get();
    for (const doc of evidence.docs) {
      const e = doc.data();
      const claim = await ref("claims", e.claimId).get();
      const handover = await ref("handovers", e.claimId).get();
      if (!claim.exists || claim.data()!.state === "disputed") continue;
      const terminal =
        ["rejected", "withdrawn"].includes(claim.data()!.state) ||
        handover.data()?.state === "completed";
      if (
        !terminal ||
        Math.max(claim.data()!.updatedAt, handover.data()?.updatedAt ?? 0) >
          now - 90 * 86400000
      )
        continue;
      await getStorage().bucket().file(e.path).delete({ ignoreNotFound: true });
      await doc.ref.update({ removed: true, removedAt: now });
    }
  },
);
