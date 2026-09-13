const { chromium } = require("playwright-core");
const adminRequire = require("module").createRequire(
  require("path").resolve("functions/package.json"),
);
const { initializeApp } = adminRequire("firebase-admin/app");
const { getAuth } = adminRequire("firebase-admin/auth");
const { getFirestore } = adminRequire("firebase-admin/firestore");
const fs = require("fs");
const http = require("http");
const path = require("path");
if (
  process.env.GCLOUD_PROJECT !== "demo-legon-recovery" ||
  !process.env.FIREBASE_AUTH_EMULATOR_HOST
)
  throw Error("Demo emulators required");
initializeApp({ projectId: "demo-legon-recovery" });
const db = getFirestore();
const auth = getAuth();
const password = "Demo-ui-test-2026";
const output = path.resolve(".artifacts/ui-screens");
fs.mkdirSync(output, { recursive: true });
const root = path.resolve(".artifacts/ui-export");
const server = http.createServer((req, res) => {
  let requested = path.resolve(
    root,
    "." + decodeURIComponent(req.url.split("?")[0]),
  );
  if (
    !requested.startsWith(root + path.sep) ||
    !fs.existsSync(requested) ||
    fs.statSync(requested).isDirectory()
  )
    requested = path.join(root, "index.html");
  const types = {
    ".js": "application/javascript",
    ".html": "text/html",
    ".png": "image/png",
    ".css": "text/css",
    ".json": "application/json",
    ".ttf": "font/ttf",
  };
  res.setHeader(
    "Content-Type",
    types[path.extname(requested)] || "application/octet-stream",
  );
  fs.createReadStream(requested).pipe(res);
});
let browser;
const errors = [];
const outcomes = [];
async function seed() {
  for (const uid of ["ui-owner", "ui-finder", "ui-admin", "ui-unverified"]) {
    await auth.createUser({
      uid,
      email: uid + "@example.com",
      password,
      displayName: "Ama Mensah",
      emailVerified: uid !== "ui-unverified",
    });
    if (uid === "ui-admin")
      await auth.setCustomUserClaims(uid, { admin: true });
    await db
      .doc("users/" + uid)
      .set({
        uid,
        email: uid + "@example.com",
        displayName: "Ama Mensah",
        verified: true,
        eligible: true,
        suspended: false,
        adminEnabled: uid === "ui-admin",
      });
  }
  const report = {
    authorId: "ui-finder",
    title: "Ochre canvas backpack",
    description:
      "Canvas backpack found near the library entrance. Two shoulder straps and a front pocket.",
    type: "found",
    state: "open",
    category: "Bag",
    brand: "",
    color: "ochre",
    location: "Balme Library",
    locationDetail: "Near the entrance",
    eventDate: "2026-09-12",
    approximateDate: false,
    photoPath: "",
    requiresAdmin: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    searchTokens: ["backpack", "canvas", "ochre"],
    activeClaimId: null,
    schemaVersion: 2,
  };
  await db.doc("reports/ui-report").set(report);
  await db
    .doc("reportPrivate/ui-report")
    .set({
      authorId: "ui-finder",
      privateDetails: "A green notebook inside the front pocket.",
    });
  await db
    .doc("reports/ui-own-report")
    .set({
      ...report,
      authorId: "ui-owner",
      type: "lost",
      title: "Blue reading glasses",
      category: "Others",
    });
  await db
    .doc("reportPrivate/ui-own-report")
    .set({
      authorId: "ui-owner",
      privateDetails: "Small silver initials inside the left arm.",
    });
  await db
    .doc("claims/ui-case")
    .set({
      reportId: "ui-report",
      reportTitle: report.title,
      claimantId: "ui-owner",
      finderId: "ui-finder",
      participantIds: ["ui-owner", "ui-finder"],
      lostReportId: null,
      answers: "There is a green notebook in the front pocket.",
      circumstances: "I left it near the library after studying yesterday.",
      state: "submitted",
      requiresAdmin: false,
      evidencePaths: [],
      reviewNote: "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  await db
    .doc("notifications/ui-notice")
    .set({
      userId: "ui-owner",
      title: "Your claim is being reviewed",
      body: "You can follow the review from your activity.",
      href: "/claim/ui-case",
      read: false,
      createdAt: Date.now(),
    });
}
async function snap(page, name) {
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.join(output, name + ".png"),
    fullPage: false,
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth + 1,
  );
  if (overflow) throw Error("Horizontal overflow: " + name);
  outcomes.push(name);
}
async function login(page, uid) {
  await page.goto("http://127.0.0.1:8082/auth/login");
  await page
    .getByLabel("Email address", { exact: true })
    .fill(uid + "@example.com");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("heading", { name: "Around campus" })
    .waitFor({ timeout: 60000 });
}
(async () => {
  await seed();
  await new Promise((resolve) => server.listen(8082, "127.0.0.1", resolve));
  browser = await chromium.launch({
    executablePath:
      process.env.UI_BROWSER_EXECUTABLE ||
      (process.platform === "win32"
        ? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
        : undefined),
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:8082/");
  await page
    .getByRole("button", { name: "Get started", exact: true })
    .waitFor();
  await snap(page, "01-onboarding-390");
  await page.setViewportSize({ width: 320, height: 568 });
  await snap(page, "02-onboarding-320");
  await page.getByRole("button", { name: "Get started", exact: true }).click();
  await page.getByRole("heading", { name: "Create your account" }).waitFor();
  await snap(page, "03-signup-320");
  await page.goto("http://127.0.0.1:8082/");
  await page.getByRole("heading", { name: "Welcome back" }).waitFor();
  outcomes.push("onboarding-persisted");
  await snap(page, "04-login-320");
  await page.goto("http://127.0.0.1:8082/auth/verify");
  await page.getByRole("heading", { name: "Welcome back" }).waitFor();
  outcomes.push("verify-without-session-redirect");
  await login(page, "ui-owner");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("link", { name: /Ochre canvas backpack/ }).waitFor();
  await snap(page, "05-browse");
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page
    .getByRole("button", { name: "Category: All categories", exact: true })
    .click();
  await page.getByRole("radio", { name: "Bag", exact: true }).waitFor();
  await snap(page, "06-category-sheet");
  await page.getByRole("radio", { name: "Bag", exact: true }).click();
  for (const [url, name, heading] of [
    ["/post", "07-report", "Report an item"],
    ["/profile", "08-activity", "My activity"],
    ["/updates", "09-updates", "Updates"],
    ["/item/ui-report", "10-item", "Ochre canvas backpack"],
    ["/claim/ui-case", "11-case", "Ochre canvas backpack"],
    ["/help", "12-help", "How it works"],
    ["/auth/reset", "13-reset", "Reset your password"],
    ["/admin", "14-restricted", "Administrator access required"],
  ]) {
    await page.goto("http://127.0.0.1:8082" + url);
    await page
      .getByRole("heading", { name: heading, exact: true })
      .waitFor({ timeout: 60000 });
    await page.waitForTimeout(500);
    await snap(page, name);
  }
  await page.goto("http://127.0.0.1:8082/post");
  await page
    .getByLabel("Item title", { exact: true })
    .fill("Red pocket notebook");
  await page
    .getByLabel("Public description", { exact: true })
    .fill("Small red notebook with a plain fabric cover.");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await snap(page, "17-report-location");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByLabel("Private identifying details", { exact: true })
    .fill("A pressed leaf is inside the back cover.");
  await snap(page, "18-report-private");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await snap(page, "19-report-review");
  await page
    .getByRole("checkbox", { name: /I checked that the public/ })
    .click();
  await page
    .getByRole("button", { name: "Publish report", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Red pocket notebook", exact: true })
    .waitFor({ timeout: 60000 });
  await page
    .getByRole("button", { name: "Open my activity", exact: true })
    .click();
  await page.getByText("Report", { exact: true }).last().click();
  await page.getByLabel("Item title", { exact: true }).waitFor();
  if (
    (await page.getByLabel("Item title", { exact: true }).inputValue()) !== ""
  )
    throw Error("New report retained previous title");
  outcomes.push("publish-and-reset-report");
  await page.goto("http://127.0.0.1:8082/item/ui-report");
  await page
    .getByRole("button", { name: "Start an ownership claim", exact: true })
    .click();
  await page
    .getByLabel("Private identifying details", { exact: true })
    .fill("My notebook is inside the front pocket.");
  await page
    .getByLabel("Where and how did you lose it?", { exact: true })
    .fill("I left the bag at the library yesterday.");
  await page
    .getByRole("button", { name: "Submit claim", exact: true })
    .scrollIntoViewIfNeeded();
  await snap(page, "20-claim-form");
  await page.goto("http://127.0.0.1:8082/profile");
  await page.getByRole("tab", { name: "Account", exact: true }).click();
  await snap(page, "15-account");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm sign out", exact: true })
    .click();
  await page.getByRole("heading", { name: "Welcome back" }).waitFor();
  await login(page, "ui-admin");
  await page.goto("http://127.0.0.1:8082/admin");
  await page.getByRole("heading", { name: "Admin", exact: true }).waitFor();
  await page.waitForTimeout(800);
  await snap(page, "16-admin");
  for (const label of ["Users", "Reports", "Disputes"]) {
    await page.getByRole("tab", { name: label, exact: true }).click();
    await snap(page, "21-admin-" + label.toLowerCase());
  }
  if (errors.length) throw Error(errors.join("\n"));
  console.log(JSON.stringify({ outcomes, errors }, null, 2));
})()
  .catch((e) => {
    errors.push(e.message);
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
    server.close();
    fs.writeFileSync(
      path.join(output, "results.json"),
      JSON.stringify({ outcomes, errors }, null, 2),
    );
  });
