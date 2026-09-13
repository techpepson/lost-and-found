# Mobile implementation plan

Updated 13 September 2026. The user's Android/iOS mobile requirement supersedes the web-only wording of the supporting Chapter One. The intended outcome is an accountable return to a verified owner, rather than simply publishing a found item.

## Implemented in this repository

| Area              | Implementation                                                                                                                           |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile foundation | Expo SDK 56, native tabs and stack navigation, safe areas, keyboard-aware forms, camera/library and date/time controls                   |
| Accounts          | Registration, login, email verification, password reset, profile editing, configurable membership and suspension                         |
| Reports           | Lost/found types, structured categories and places, dates, resized images, private clues, visibility review, drafts, editing and closure |
| Discovery         | Paginated browse, indexed prefix search, filters, bookmarks and explainable background match suggestions                                 |
| Ownership         | Independent answers, evidence uploads, information requests, reasons for review decisions, protected sensitive/competing cases           |
| Handover          | Atomic reservation, proposed/accepted appointment, expiring code with attempt limit, separate confirmations                              |
| Accountability    | Disputes, independent resolution, append-only audit history and unique completed-recovery records                                        |
| Administration    | Review queue, moderation, account suspension, dispute resolution and operational counts                                                  |
| Operations        | Firestore/Storage rules, callable workflow, scheduled maintenance, emulator suites, administrator and legacy-migration scripts           |

These are source implementations, not a claim that a production campus service has launched. Android and iOS asset exports succeed; installable builds and physical-device behavior require separate verification.

## Remaining release work

1. Complete device acceptance checks and the dedicated retention-cleanup fixture. All 34 current automated tests pass; the reproducible evidence record is in `docs/EVALUATION.md`.
2. Configure the intended Firebase project, verified membership policy, independent administrator accounts and deployment credentials; deploy the rules, indexes and functions together.
3. Build an Android APK and the appropriate iOS target using the intended Expo/signing account. Test two member accounts and an administrator through the complete recovery flow on devices.
4. Confirm campus support ownership, staffed locations if any, response times, retention policy and dispute procedures. The app currently makes no claim of university endorsement or staffed collection points.
5. Conduct the academic evaluation with consented participants and independently labelled matching examples. Report actual results, errors and limitations, not synthetic smoke-test scores as research findings.

## Improvement backlog after the pilot

- Native push notifications with explicit permission and notification preferences; current updates are in-app.
- Native App Check integration before enabling server enforcement.
- Larger-scale matching retrieval and search after measuring the current bounded implementation.
- Institution-supported identity or collection-point integrations if formally agreed.
- Accessibility and performance improvements informed by device testing and participant feedback.
- Retention/appeal/export controls agreed with the real operator, including treatment of audit records and unused uploads.

Hardware tracking, payments, rewards, insurance and law-enforcement integrations remain outside the academic project's scope. Custody and evidence decisions remain human-reviewed; matching scores do not prove ownership.

## Academic document changes

Revise the title, scope, objectives, architecture and methodology to describe a mobile application. Keep the motivating campus problem and verification requirements. Describe Expo/React Native clients and Firebase services accurately. Separate implemented mechanisms, experimentally measured outcomes, proposed improvements, and external institutional arrangements. Supply verified academic references rather than inventing citations or recovery statistics.

Setup and release commands are in [README.md](README.md); permissions and flow are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
