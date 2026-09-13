// Run with operator Application Default Credentials. No client can grant a role.
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const [projectId, uid, mode] = process.argv.slice(2);
if (!projectId || !uid || !["grant", "revoke"].includes(mode))
  throw new Error(
    "Usage: node functions/scripts/set-admin.cjs PROJECT_ID USER_UID grant|revoke",
  );
initializeApp({ projectId });
(async () => {
  const auth = getAuth();
  const user = await auth.getUser(uid);
  const claims = { ...user.customClaims };
  if (mode === "grant") claims.admin = true;
  else delete claims.admin;
  await auth.setCustomUserClaims(uid, claims);
  await auth.revokeRefreshTokens(uid);
  await getFirestore()
    .doc("users/" + uid)
    .set(
      {
        uid,
        email: user.email ?? "",
        displayName: user.displayName ?? "",
        verified: user.emailVerified,
        suspended: user.disabled,
        adminEnabled: mode === "grant",
        updatedAt: Date.now(),
      },
      { merge: true },
    );
  await getFirestore()
    .collection("auditEvents")
    .add({
      caseId: uid,
      actorId: "operator-cli",
      action: mode + "Admin",
      note: "Administrative role changed through trusted operator credentials",
      participantIds: [],
      createdAt: Date.now(),
    });
  console.log("Administrative role updated. The user must sign in again.");
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
