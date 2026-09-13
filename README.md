# Legon Lost & Found

An Android and iOS campus recovery app built with Expo SDK 56, React Native, TypeScript and Firebase. Members report items, discover possible matches, submit ownership claims, and complete a verified handover. Administrators handle sensitive claims, moderation and disputes.

The mobile platform is authoritative; references to a web app in the supporting academic chapter need revision. See [the implementation plan](PROJECT_PLAN.md) and [architecture](docs/ARCHITECTURE.md).

## Run locally

Use a supported Node installation, npm, and Java 21 or later for Firebase emulators. Install dependencies:

```sh
npm ci
npm --prefix functions ci
npm run build:backend
```

Copy `.env.emulator.example` to `.env.local` for demo data, or configure `.env` from `.env.example` for your Firebase project. Public Firebase app configuration belongs in the mobile bundle; administrator credentials do not.

For an Android emulator set `EXPO_PUBLIC_EMULATOR_HOST=10.0.2.2`. For an iOS simulator use `127.0.0.1`. A physical phone needs your computer's LAN address and emulator listeners configured on a reachable interface in `firebase.json`; keep that development environment on a trusted network. Restart Metro after changing environment variables. `.env.local` overrides `.env`, so remove demo overrides before preparing a live build.

Start the backend and mobile app in separate terminals:

```sh
npm run emulators
npx expo start
```

The emulator project is always `demo-legon-recovery`. Emulator tests erase its test data. They never target the production project. Use Firebase Emulator UI at `http://localhost:4000` to inspect demo users and verification links. The script uses a portable Java runtime under `.artifacts/tools/java21-fast` when present, otherwise Java from PATH.

## Verify

```sh
npm run typecheck
npm run build:backend
npm test
npm run test:rules
npm run test:integration
npm run evaluate:matching
npm run build:mobile
```

`npm run test:ui` builds an isolated demo preview and checks the interface in a headless browser at phone dimensions. It uses Microsoft Edge on Windows; set `UI_BROWSER_EXECUTABLE` to a Chromium-compatible browser executable elsewhere. Screenshots and results are saved under `.artifacts/ui-screens`. This checks layout and browser interactions; native camera, keyboard, date-picker and device behavior still require phone testing.

`build:mobile` exports Android/iOS JavaScript and Hermes assets; it does not produce an installable APK/IPA. See [evaluation and release checks](docs/EVALUATION.md). Emulator binaries download on first use and require free disk space.

## Connect a real backend

1. Configure the intended Firebase project's Authentication email/password provider, Firestore and Storage. Cloud Functions and scheduled maintenance need an appropriate billing plan.
2. Copy `functions/.env.example` to `functions/.env.PROJECT_ID`. Confirm membership domains with the actual operator; an empty domain list deliberately allows any verified email for an academic demo.
3. Authenticate the Firebase CLI as an authorized operator, then deploy explicitly to the intended project:

```sh
npx firebase deploy --project PROJECT_ID --only firestore,storage,functions
```

4. With trusted Application Default Credentials, grant an existing verified staff account its role:

```sh
node functions/scripts/set-admin.cjs PROJECT_ID USER_UID grant
```

Use `revoke` to remove the role. The account should sign in again to refresh its token. No mobile user can grant administrative access. Do not enable `ENFORCE_APP_CHECK` until a native App Check provider is integrated and tested; that integration is not included.

Legacy `items` are quarantined from the new public feed. Review a dry-run migration before applying it:

```sh
node functions/scripts/migrate-legacy.cjs PROJECT_ID
node functions/scripts/migrate-legacy.cjs PROJECT_ID --apply
```

Migration retains original records and produces private drafts requiring author review, new private clues, and deliberate republication. It does not copy exposed legacy contact details or photos into public reports.

## Installable builds

`eas.json` includes an internal Android APK profile and an iOS simulator profile. After configuring the intended Expo account, project identity, Firebase environment and signing credentials:

```sh
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform ios --profile preview
```

The iOS preview is for a simulator, not a physical iPhone. Physical iOS distribution requires the appropriate Apple signing setup and build profile. No store submission, production deployment or signed mobile build has been performed in this workspace.
