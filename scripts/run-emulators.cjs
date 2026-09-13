// Keep CLI caches local and use a portable Java 21 runtime when installed here.
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const local = path.join(root, ".artifacts");
const env = {
  ...process.env,
  XDG_CONFIG_HOME: path.join(local, "config"),
  FIREBASE_EMULATORS_PATH: path.join(local, "emulators"),
  CI: "true",
  FIREBASE_CLI_DISABLE_UPDATE_CHECK: "true",
  FUNCTIONS_DISCOVERY_TIMEOUT: "60",
};
const javaDir = path.join(local, "tools/java21-fast");
if (fs.existsSync(javaDir)) {
  const entry = fs
    .readdirSync(javaDir)
    .find((name) =>
      fs.existsSync(
        path.join(
          javaDir,
          name,
          "bin",
          process.platform === "win32" ? "java.exe" : "java",
        ),
      ),
    );
  if (entry) {
    const pathKey =
      Object.keys(env).find((key) => key.toLowerCase() === "path") || "PATH";
    env[pathKey] =
      path.join(javaDir, entry, "bin") + path.delimiter + (env[pathKey] || "");
  }
}
for (const dir of [env.XDG_CONFIG_HOME, env.FIREBASE_EMULATORS_PATH])
  fs.mkdirSync(dir, { recursive: true });
const mode = process.argv[2] || "all";
const selection =
  mode === "rules" ? "firestore,storage" : "auth,firestore,storage,functions";
const command =
  mode === "ui"
    ? "node tests/mobile-ui.cjs"
    : mode === "rules"
      ? "node --test tests/rules.test.mjs"
      : mode === "integration"
        ? "node --test tests/workflow.test.mjs"
        : "node --test --test-concurrency=1 tests/rules.test.mjs tests/workflow.test.mjs";
const args =
  mode === "start"
    ? ["emulators:start", "--project", "demo-legon-recovery"]
    : [
        "emulators:exec",
        "--only",
        selection,
        "--project",
        "demo-legon-recovery",
        command,
      ];
const child = spawn(
  process.execPath,
  [path.join(root, "node_modules/firebase-tools/lib/bin/firebase.js"), ...args],
  { cwd: root, env, stdio: "inherit", windowsHide: true },
);
child.on("exit", (code) => process.exit(code ?? 1));
