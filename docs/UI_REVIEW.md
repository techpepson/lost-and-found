# Mobile UI review

Reviewed 13 September 2026. The app remains an Android/iOS Expo application. A temporary browser build with isolated Firebase demo data is used for repeatable layout and interaction checks; it is not a website deployment or a substitute for native device testing.

## Design changes

- Added a full-screen campus-image onboarding view with native text, a dark readability overlay, Get started and sign-in actions. Completion is saved locally; existing signed-in users bypass it.
- Established warm off-white surfaces, deep green actions, restrained borders and consistent typography across screens.
- Reduced repeated headings, promotional copy, oversized discovery controls and duplicate navigation actions.
- Made activity/admin sections horizontally scrollable and simplified report/case progress indicators.
- Adjusted form width, touch targets and bottom-tab spacing; added the selected photo to report review.

## Corrected behavior

- First-time visitors enter onboarding before authentication; returning visitors go straight to authentication or the app.
- Opening email verification without a session, or choosing another account there, returns to sign-in.
- Cancelling image selection no longer claims that evidence was uploaded.
- Invalid collection dates are handled as form errors rather than uncaught exceptions.
- Missing report/case screens include usable navigation and retry controls.
- Publishing a report clears its values and identifier before the next report.
- Onboarding background bounds and small-screen overlay contrast were checked in rendered previews.

## Reproduce the review

Run `npm run test:ui` with Java 21+, installed project/backend dependencies and a Chromium-compatible browser. The runner compiles the backend, exports a demo-configured preview, starts Firebase demo emulators and runs `tests/mobile-ui.cjs`. It creates synthetic accounts and data only in `demo-legon-recovery`.

The suite covers onboarding at 390×844 and 320×568, persistence, signup/login, unauthenticated verification routing, browse/filter selection, report steps/publication/reset, activity/account/sign-out, updates, item/claim forms, help/password reset, access restrictions and administrator sections. Screenshots and a checkpoint/error record are written to `.artifacts/ui-screens`.

Final browser run: 26 checkpoints passed, no uncaught browser exceptions and no detected horizontal document overflow. Screenshots were inspected and used to correct image bounds, label clipping, form controls and contrast. Type checking and all 13 domain tests also passed after the UI changes.

Source review also covered collection-code, dual-confirmation, dispute, private-evidence, error/empty/loading and native picker interfaces. Existing backend tests cover those workflow permissions and transitions. They have not all been exercised through a physical mobile interface during this review.

## Physical-device work still needed

Check Android/iOS camera and photo permissions, native date/time sheets, keyboard avoidance, screen-reader navigation, large text, safe-area insets, app resume and protected image downloads. No connected phone or installed Android emulator was available during this session. Do not describe browser preview results or bundle exports as proof that every native interaction is perfect.

The onboarding asset and its generation prompt are recorded in [ONBOARDING_ASSET.md](ONBOARDING_ASSET.md).
