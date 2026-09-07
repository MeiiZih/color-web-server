# ColorLab approved frontend integration — 2026-09-06

## Status

**Full replacement deployed on 2026-09-06:** commit `3276bcec6164c75ee3e66572e5ba1eb1536d48ac`; static deploy `dep-daeei2mq1p3s73918aqg` confirmed Live, backend deploy `dep-daeeiev40ujc73eu2ncg` logs confirm service live and the new routes respond. The shared-shell approach below was rejected by the user. The new `app/account.html` application now owns login, registration, member profile, administrator overview/users/questionnaires/content/records/statistics/feedback/profile and public information pages. Every old main/test HTML is replaced in the static output by a redirect-only compatibility entrypoint. Express uses the same route map to redirect old backend UI requests to the static frontend. Original source remains in Git for recovery; it is no longer the delivered interface. Accounts, completed records and original scoring are retained. Questionnaire deletion no longer deletes completed legacy records.

Live verification: account HTML/modules/CSS and static worker v2 return 200; old static login and intro contain redirect-only HTML with no legacy styles. Browser old intro -> branded wake/progress -> new question 1/20; old login -> new login; old backend account-management -> new admin login when unauthenticated. Backend `/health` returns 200 OK; old account/intro URLs return 302 to the static application; unauthenticated record-detail returns 401; catalog retains the original survey with 20 questions. No production record writes were used. Actual member/admin credential sign-in and physical iPhone standalone remain unverified.

Current checks: 18 automated tests pass, including all legacy route mappings, no legacy CSS/JS on new pages, authenticated member-update ownership, admin-only record access, session restoration/logout, and snapshot preservation. Local browser verification covers 320/390px and desktop, new login controls, creation/save/readback of a questionnaire, member save/cancel baseline, and full-record dialogs. Fixtures and in-memory writes are localhost-only and never reach MongoDB. Production credential login and physical iPhone testing are not included.

New call chain: `app/account.mjs` -> `auth.mjs` -> existing static API transport -> existing Express endpoints. Account updates use the verified user JWT; administrative records/statistics/feedback now require an admin JWT. Public asset/SW caches contain no private API responses. Static worker cache version 2 includes the new account modules; the old backend-origin worker retires legacy shell caches and forwards navigations to the static origin. A first-ever direct visit to a sleeping backend can still show Render's platform screen before any application redirect is delivered.

The older notes below are deployment history, not the current replacement implementation.

**Shared-shell integration deployed on 2026-09-06:** commit `c52718e8afb661edf8fa330276a6ca76b2757471`, static deploy `dep-daee7seq1p3s73904l9g` confirmed Live. Login/register/profile/admin HTML and shared CSS/JS return 200; live login renders the new shell without console errors. Backend health remains 200 / OK. Twelve automated tests pass, including preservation of all legacy form IDs and exclusion of local QA routes. Local browser checks cover 320/390px and desktop layouts, account search, navigation open/Escape, member edit/cancel, information dialog and administrator logout followed by protected-page redirect. No production record writes, actual credential sign-in, or physical iPhone verification were performed in this phase.

**Deployed on 2026-09-06** at https://colorlab-start.onrender.com/ using commit `0a7485752848f9183a85ea0e9750fd829b39ff46`. Existing backend remains https://color-web-server-jprj.onrender.com/. No production questionnaire/member records or paid plans were changed by verification.

- Backend deploy: `dep-daedtu6q1p3s738v1p5g`; health 200 / OK, catalog returns the original 20-question questionnaire, unauthenticated records 401, cross-origin preflight 204.
- Static deploy: `dep-daedun9t0dsc739rhjkg`, Render confirmed Live. Existing `colorlab-start` service now uses root `.`, build `npm ci --prefix Server --omit=dev && node scripts/build-static.cjs`, publish `static-dist`. Auto-deploy was temporarily disabled during configuration then restored to On Commit.
- Static header `/manifest.webmanifest`: `Content-Type: application/manifest+json`, verified live.
- Live browser verified homepage real content, visitor completion of all 20 questions, results, all 5 PDF pages rendered, and administrator deep-link redirect to login. Original PDF download response is 703905 bytes with `%PDF-` signature. Server source, `.env`, and design-preview paths return 404.
- Real member/admin sign-in (requires user entry), physical iPhone standalone PWA, and a newly sleeping backend cold start still require live verification. The cold-start workflow was tested with the local simulated backend.

## Scope and call chain

- `color-web/app/` is the approved homepage, questionnaire catalog, single-question flow, results/history and member entry. It preserves the warm pink/four-color design. Legacy main pages now receive `integrated-shell.js` and its scoped CSS at static build time: desktop admin sidebar, collapsible mobile navigation, member bottom navigation, warm form panels and mobile table cards. Original form IDs, event handlers and APIs remain unchanged; the new app and PDF viewer do not load the legacy shell.
- `/api/explore/catalog` reads existing `TestQuestion` documents. Only the recognized original 20-question, four-choice survey uses existing color/MBTI scoring. Other current single-choice questionnaires produce an answer receipt, not invented MBTI scores. Multiple-choice/text/custom scoring are not implemented.
- New member records require a verified user JWT. `/api/explore/me` and `/records` derive ownership from the database user, not caller-supplied email. Existing login and administrator-first routing remain unchanged.
- Guests keep device-only records. Member drafts are separated by user ID. Preview data keys are not imported. Guest records are not silently merged into an account.
- Each new completion stores a question snapshot in `TestRecord.exploration`; later question edits or deletion do not reinterpret that record. Old records keep stored answers/results. A changed draft version is not reused.
- A member-specific deterministic record ID makes retries idempotent. A conflicting reuse is rejected. Answers are locked while an uncertain save is retried.
- `/app/pdf.html` uses the original report PDF and local PDF.js, renders every page, and provides download/original/share-to-files controls. No external document viewer receives files. Real iPhone standalone PWA behavior still requires device testing.
- Original Word J/P annotations conflict internally; scoring remains compatible with the existing application. This integration does not silently change research scoring.

## Static frontend / wake screen

`node scripts/build-static.cjs` builds `static-dist/` from existing public files plus the approved app, logo, wake UI and installed PDF.js. It never copies server configuration, database files, tests, `tmp/`, or `design-preview/`.

The build injects `static-connection.js` first into legacy pages and the new app. API fetches go to the configured backend; PDF downloads go directly to static assets. User tokens are not sent to arbitrary image/link origins. Health is checked for exact `OK`; HTML loading pages do not count as readiness.

A fast healthy response bypasses the wake screen. A cold response displays the existing interactive ColorLab wake page from the **static origin**, including an estimated progress bar. Readiness closes it through a source/origin-checked message. At two minutes or offline it offers retry rather than staying indefinitely at a percentage. PDF preview itself does not wait for backend health.

The static-only service worker caches public shell assets, not API responses or member records. New PWA start URL is `/app/`. Existing backend-origin installs cannot be migrated across origins automatically; users need the static entry and may need to reinstall.

**Direct first visits to the old sleeping Render backend URL can still show Render's own loading page.** This cannot be replaced by JavaScript that has not yet been delivered. Do not claim this is solved until the independent static service is published and its entry URL is adopted.

## Deployment steps after Render sign-in

1. Verify the existing backend and static launcher services, repository and branch. Recorded branch is `agent/relaunch-color-web`; re-check before deploying.
2. Commit/push only intended application/integration files. Preserve unrelated `tmp/` and the separate design preview.
3. Deploy the backend with its existing `Server` root and `npm ci --omit=dev` / `npm start`. Verify `/health` and `/api/explore/catalog`.
4. Update the **existing static launcher**, not create a paid service: repository root, build `npm ci --prefix Server --omit=dev && node scripts/build-static.cjs`, publish `static-dist`. Optional `COLORLAB_API_ORIGIN` is an HTTPS origin, defaulting to the existing backend. Keep its current URL/custom domain.
5. Verify the public static homepage, direct `/main/admin/account-manage.html` deep link, login/admin routing, catalog, member save/history, PDFs and PWA manifest. Test a real backend cold start from a clean browser.
6. Only after both deployments are verified, direct users to the static URL. Do not delete the old backend; it still serves the API.

Rollback: restore the previous static publish/build configuration and previous backend commit. New additive snapshot records remain in the database; no migration or collection deletion is required.

## Local checks

### 2026-09-07 release verification

- Final B crayon background, proportional result colors, readable text backing, original character staging and gentle single-click motion are included. Member/guest result feedback and standalone completion interstitials are covered by isolated tests; no production records or passwords were changed during release verification.
- All 240 static reports retain their original content: only the cover website label (`ColorLab`) and survey label (`我在色彩學中的 MBTI`) changed. `scripts/update-report-names.py` preserves local originals under ignored `tmp/pdfs/originals/` and checks text, embedded-image hashes, page counts and rendered pixels outside the two label areas. All 1,201 pages passed; both new names were verified in every report.
- Backend/shared test suite: 105 passed. Browser checks passed at 320/390/768/1280 where applicable: mood-stage containment, result color proportions, gentle character motion, completion ordering, reduced motion, feedback failure/retry, and cached navigation/wake handoff.
- This release uses the existing Render backend and static frontend, not a new hosting provider. Publishing and live verification are recorded in the task handoff.

```
node --test Server/tests/explore.test.cjs Server/tests/explore-client.test.mjs design-preview/model.test.mjs
node scripts/build-static.cjs
node --test scripts/static-shell.test.cjs
node scripts/preview-static.cjs
```

The local integration server binds only `127.0.0.1:4180`, uses explicitly labeled fixtures, does not connect to MongoDB or real accounts, and can simulate cold health responses at `/qa/cold`.

`/qa/review` adds deliberately invalid local fixture sessions and responsive 320/390/desktop frames for admin/member UI checks. Its read-only API fixtures and session setup are not copied into the deployable directory. All writes remain blocked. The shared administrator logout removes only administrator session keys from both stores so legacy pages cannot immediately restore the logged-out token; survey drafts and records are preserved.

Passed: 20 tests (catalog/type/version validation, snapshot persistence, corrupt storage, JWT ownership, unauthenticated/admin rejection, invalid answers, repeated submission, original preview scoring/drafts); browser guest 20-question completion, three-question completion, history, original 5-page PDF rendering; desktop/mobile visual checks; simulated cold start -> branded wake -> automatic homepage. Live deployment/member login and physical iPhone PWA remain unverified.
