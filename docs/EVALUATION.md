# Verification and evaluation

Local verification record, 13 September 2026. Tests use synthetic records and the explicitly named Firebase demo project. They are engineering checks, not participant research.

| Check                             | Result                                                                    |
| --------------------------------- | ------------------------------------------------------------------------- |
| TypeScript mobile source          | Passed                                                                    |
| Cloud Functions compilation       | Passed                                                                    |
| Domain tests                      | 13 passed                                                                 |
| Firestore and Storage rules tests | 10 passed                                                                 |
| Workflow integration tests        | 11 passed, including background matching and scheduled expiry             |
| Android and iOS asset export      | Passed for both platforms                                                 |
| Matching smoke examples           | 2 true positives, 3 true negatives, no errors across five synthetic pairs |
| Installable APK / IPA             | Not built                                                                 |
| Native visual / interaction QA    | Not performed; no connected device or installed Android emulator          |
| Production deployment / indexes   | Not performed                                                             |

An initial full-disk failure prevented bundling and emulator downloads. Removing disposable project package cache allowed both native exports and the security tests to complete. Local Java 21 was required by the Firebase CLI. These setup failures are not passing test results.

## Automated coverage

Phone-sized browser UI checks were added during the UI review. See `docs/UI_REVIEW.md` and `.artifacts/ui-screens/results.json` for coverage and results. They supplement, but do not replace, native device checks.

Domain tests cover strict dates, validated public payloads, ID-card image protection, matching eligibility and explanations, independent review, terminal-state protection, code/participant gates, dual confirmation and native links.

Rules tests cover verified membership, suspension, private drafts and clues, client privilege escalation, participant query boundaries, server-only code secrets, administrator revocation, notification edits, bookmark scope, immutable audit events and evidence image access.

Integration tests exercise actual callable requests with emulator Authentication tokens: unverified/unauthenticated rejection, public/private report separation, idempotent operations, sensitive-item review, competing approvals, complete handover, code replay/expiry/attempt limits, dispute cancellation, locked ownership clues and closure without fabricated recovery counts. Background-handler checks also verify that expired reservations become disputes without releasing custody, and that matching creates participant-scoped suggestions and disables them after closure. Evidence retention deletion still needs a dedicated fixture test.

Run commands are in the README. Emulator suites must run sequentially because they reset the same demo database. Do not run them against a developer's demo session containing work they want to preserve.

## Device acceptance checklist

Use owner, finder and independent administrator accounts. Record platform, OS, device, app build, backend revision and observed outcome for every scenario.

- Register, verify email, reset password, sign out and relaunch. Open a claim deep link while signed out and confirm return after authentication.
- Report two different items consecutively; confirm separate reports. Edit a draft; confirm the next new report does not overwrite it.
- Deny then grant camera/photo permission, cancel both pickers, attach large and rotated images, and verify ID card photographs cannot be published.
- Check keyboard visibility, scrolling, native date/time controls, screen-reader labels, text scaling and touch targets on small screens.
- Lose connectivity while saving, reviewing or confirming; retry and check for duplicate reports, reservations, audit effects or recovery counts.
- Test search/filter pagination, unavailable saved reports, and private-image access with owner/finder/admin/outsider accounts.
- Complete the claim, appointment, code and both confirmations using two separate devices. Verify that one confirmation cannot complete the case.
- Open and resolve a dispute; verify participants cannot progress while frozen. Exercise expired reservations and retention cleanup using controlled emulator fixtures.
- Suspend a signed-in user and revoke an administrator; confirm existing sessions lose protected access. Verify logout removes visible private data.

## Academic study

Recruit consented campus participants representative of owners, finders and reviewers. Give each a fixed set of reporting, discovery, claim and collection tasks. Measure completion rate, time, errors, assistance required and perceived usability using a declared instrument. Record device/network conditions. An academic demonstration must not ask participants for real account passwords, student-card images or sensitive ownership documents.

Create independently labelled matching pairs with realistic near-matches and ambiguous cases. Split development and evaluation data before tuning weights/threshold. Report precision, recall, confusion matrix and examples of both false matches and missed matches. The current five synthetic examples establish only that the smoke-test script behaves as expected.

Measure workflow outcomes separately: approved claims, completed dual-confirmed recoveries, time to review/collection, disputes and abandoned cases. A closed report, suggested match or single confirmation is not a verified recovery. Do not claim institutional endorsement, production security certification or measured campus effectiveness from local tests.
