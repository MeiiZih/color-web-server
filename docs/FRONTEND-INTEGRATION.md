# ColorLab approved frontend integration — 2026-09-06

## Status

Implementation and local integration validation complete. **Not deployed yet.** Render is signed out; no production database records, hosting settings, or paid plans were changed.

## Scope and call chain

- `color-web/app/` is the approved homepage, questionnaire catalog, single-question flow, results/history and member entry. It preserves the warm pink/four-color design. Admin/profile/login pages remain the existing implementation; they have not been completely redesigned.
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

```
node --test Server/tests/explore.test.cjs Server/tests/explore-client.test.mjs design-preview/model.test.mjs
node scripts/build-static.cjs
node scripts/preview-static.cjs
```

The local integration server binds only `127.0.0.1:4180`, uses explicitly labeled fixtures, does not connect to MongoDB or real accounts, and can simulate cold health responses at `/qa/cold`.

Passed: 20 tests (catalog/type/version validation, snapshot persistence, corrupt storage, JWT ownership, unauthenticated/admin rejection, invalid answers, repeated submission, original preview scoring/drafts); browser guest 20-question completion, three-question completion, history, original 5-page PDF rendering; desktop/mobile visual checks; simulated cold start -> branded wake -> automatic homepage. Live deployment/member login and physical iPhone PWA remain unverified.
