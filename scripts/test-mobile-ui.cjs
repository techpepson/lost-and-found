// A browser layout/interaction check at phone dimensions, not a native device test.
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const env = { ...process.env };
for (const line of fs
  .readFileSync(path.join(root, ".env.emulator.example"), "utf8")
  .split(/\r?\n/)) {
  if (!line.startsWith("EXPO_PUBLIC_")) continue;
  const index = line.indexOf("=");
  env[line.slice(0, index)] = line.slice(index + 1);
}
env.EXPO_PUBLIC_EMULATOR_HOST = "127.0.0.1";
function run(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    env,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
run([
  "node_modules/typescript/bin/tsc",
  "--project",
  "functions/tsconfig.json",
]);
run([
  "node_modules/expo/bin/cli",
  "export",
  "--platform",
  "web",
  "--output-dir",
  ".artifacts/ui-export",
]);
run(["scripts/run-emulators.cjs", "ui"]);
