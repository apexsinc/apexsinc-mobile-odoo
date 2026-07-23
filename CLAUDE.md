# apexsinc-mobile-odoo — Notes for AI Assistants

Companion to `README.md` (which covers build/setup steps for humans). This
file is about *state and decisions* — read it before assuming something
isn't done yet, or redoing something that was already deliberately chosen.
See also `/var/lib/odoo/CLAUDE.md` on the Odoo server itself for the wider
system this app talks to (that file also has a condensed version of
everything below — this one has more build-pipeline detail).

## Working clone

**`/var/lib/odoo/mobile-app`** is the durable working clone (owned by
`odoo`, survives between AI sessions). Push with the token from
`/var/lib/odoo/.secrets/github.env`:
```sh
TOKEN=$(grep '^GITHUB_TOKEN=' /var/lib/odoo/.secrets/github.env | cut -d= -f2)
git remote set-url origin "https://${TOKEN}@github.com/apexsinc/apexsinc-mobile-odoo.git"
git push origin main
git remote set-url origin https://github.com/apexsinc/apexsinc-mobile-odoo.git
```
Git identity (`janasco <jaymaranasco@gmail.com>`) is already configured on
this clone — see git rules below regardless.

A prior local human clone at `/home/janasco/apexsinc-mobile-odoo` was
**deliberately deleted** at the user's request (2026-07-23) once everything
on it was confirmed pushed. Don't recreate it or assume it exists — use
`/var/lib/odoo/mobile-app` instead. If you're working from a fresh session
and that clone is somehow gone too, just re-clone from GitHub with the
token above.

## Git commit/push rules (hard rules — read this before any commit)

- **No AI attribution, anywhere.** No `Co-Authored-By` trailers, no
  mention of Claude/AI/assistant in commit messages, comments, or PR
  descriptions.
- **Git identity for commits:** `janasco <jaymaranasco@gmail.com>`.
- **Always commit and push after every change** — standing instruction
  from the user, not a one-off. Don't leave work uncommitted.
- Claude Code's own safety classifier has blocked `git push` (and even a
  plain read-only `git remote -v`) specifically when a commit touches the
  keystore file (`apexsinc-mobile-release.keystore`) — this happened once,
  right after the keystore was first added. Ordinary code/config pushes
  have never been blocked. If a keystore-touching push does get blocked
  again, don't fight it — hand that specific push to the user to run
  themselves.

## What this is

A Capacitor-based native Android wrapper around the live APEXS Odoo site
(`server.url` remote mode: the app just loads `https://apexsinc.com/odoo`
in a native WebView — there's no bundled/offline web build to keep in
sync, so "what does the app look like" always just means "what does that
URL currently render"). Built for two targets: Play Store submission, and
internal APK sideloading straight to employees. Package
`com.apexsinc.mobile`, display name **APEXS** / "APEXS Mobile".

## Repo layout notes

- `android/` and `ios/` are **not committed** (gitignored). CI regenerates
  the native Android project fresh on every run via `npx cap add android`,
  then patches it (SDK level, version, signing) with `sed`/appended
  Gradle. This keeps the whole build reproducible from source control
  alone — don't "fix" this by trying to commit `android/`.
- `package-lock.json`: check if one exists before assuming `npm ci` will
  fail — CI originally used `npm install` because none existed when the
  repo was set up, but that may have changed since.

## Versioning

`versionCode`/`versionName` in `android/app/build.gradle` are patched by
CI from `${{ github.run_number }}` (a per-workflow, only-ever-increasing
counter — GitHub Actions run number, e.g. `1.0.16` for the 16th run).
Added because `cap add android` always regenerates hardcoded
`versionCode 1` / `versionName "1.0"`, making every installed build look
identical in Android's Settings > Apps > APEXS > App info — there was no
way to tell whether a reinstall actually picked up a new build. Check that
screen after any reinstall to confirm which build is actually running.
This also satisfies Play Store's requirement that every uploaded AAB have
a strictly increasing `versionCode`.

## Firebase / FCM — fully done, both halves

- Firebase project: `apexs-mobile`.
- `google-services.json` = **client** config. Not committed, injected in CI
  from secret `GOOGLE_SERVICES_JSON_BASE64`. Client-side push receiving
  (`@capacitor/push-notifications`) is wired up.
- **Server-side push sending is built and the credential is in place** —
  see the `apex_mobile_push` + `apex_push_triggers` Odoo addons
  (`/var/lib/odoo/custom_addons/`, documented in `/var/lib/odoo/CLAUDE.md`).
  The Firebase *service-account* JSON (distinct from `google-services.json`)
  is stored in Odoo's `apex_mobile_push.service_account_json` system
  parameter and the full JWT-sign → OAuth2 → FCM-ready chain has been
  tested successfully (real access token obtained). Four business-event
  triggers are wired up (chat messages, PO approval, new voucher, job
  verification) — see the Odoo-side doc for exactly which.
- **What's NOT confirmed yet**: an actual push notification landing on a
  real physical device. The app has been installed and logged into, but a
  registered `apex.mobile.device` row for that login, and a successful
  test-push delivery, haven't been confirmed in this session — that
  verification got interrupted by the status-bar/layout bug below. Do
  that check before telling the user push notifications definitely work
  end-to-end on-device.

## Release signing — deliberate non-default choice, done and verified

The release keystore (`apexsinc-mobile-release.keystore`, PKCS12, RSA 4096,
alias `apexsinc-mobile`, valid to 2056) is **committed directly in this
repo**, carved out of `.gitignore`'s `*.keystore` rule via an explicit
`!apexsinc-mobile-release.keystore` exception. This was the user's explicit,
confirmed-twice decision for this **private** repo — trading the usual
keep-signing-material-out-of-git practice for convenience. Don't "fix" this
by re-adding it to `.gitignore` or moving it to a secret without checking
with the user first.

Only `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and
`ANDROID_KEY_PASSWORD` are GitHub repo secrets now. The old
`ANDROID_KEYSTORE_BASE64` secret is obsolete (CI used to decode it into a
keystore; now it just copies the committed file) — safe to delete from
GitHub secrets if it's still there.

**⚠️ Back the keystore file up externally, outside git.** If it's ever
lost after the app is first published to the Play Store, later updates
can't be signed to match, and the listing can't be updated the normal way.

Multiple `workflow_dispatch` runs with `track: release` have completed
with `conclusion: success`, producing signed
`apexsinc-mobile-release-apk` / `apexsinc-mobile-release-aab` artifacts.
This part is solid and repeatable.

## Internal distribution

`apexsinc.com/mobile/app` (login-gated, served by the `apex_mobile_download`
Odoo addon) hosts the current signed release APK for employees to sideload
without going through the Play Store. **The hosted file is not
auto-updated** — after every new release build, manually download the
`apexsinc-mobile-release-apk` artifact from the latest successful GitHub
Actions run and overwrite
`/var/lib/odoo/custom_addons/apex_mobile_download/files/apexs-mobile.apk`
in place (that file is gitignored, it's a deployed binary not source; no
module reinstall needed, the controller reads it straight off disk).
Forgetting this step means the download page silently keeps serving a
stale build while GitHub has a newer one.

## Status bar overlay & Edge-to-Edge layout — fixed and configured

The app's top navigation previously rendered underneath the Android status bar (clock/wifi/battery icons) and camera notch, making top menus unclickable.

**The Edge-to-Edge fix**:
1. Native Capacitor configuration (`capacitor.config.ts`):
   ```ts
   StatusBar: {
     overlaysWebView: true,
     style: 'DARK',
     backgroundColor: '#1b2a2f',
   }
   ```
2. Dynamic viewport meta tag injection in `mobile_push_register.js` (`apex_mobile_push` addon):
   - Injects `viewport-fit=cover` into `<meta name="viewport">` when running inside native Capacitor app (`window.Capacitor`), enabling Chromium WebView to accurately populate CSS `env(safe-area-inset-top)`.
3. Safe Area CSS padding in `apex_mobile_push/static/src/css/mobile_safe_area.css`:
   - Defines `--apex-safe-top: env(safe-area-inset-top, 24px)`.
   - Expands `.o_main_navbar` height (`calc(var(--o-navbar-height, 46px) + var(--apex-safe-top))`) and applies `padding-top: var(--apex-safe-top)` with `box-sizing: border-box`. This expands the navbar to cover behind status bar/notch while preserving full vertical clearance (46px) for inner navigation buttons, brand title, and menus.
   - Also pads `.o_app_menu_sidebar`, modals, and website headers (`header.o_header_standard`).

Landing on Discuss/Conversations right after login is very likely just
normal Odoo behavior (reopens whatever module was last open for that
user), not a bug — don't chase it as one unless asked.

## Not yet done

- Play Store submission — signed AAB exists as a build artifact, never
  uploaded to Play Console.
- App icon is still the plain 200x200 company logo, not a proper
  1024x1024 source suited for a real store listing.
- Confirmed real-device push notification delivery (see Firebase/FCM
  section above).
- User re-confirmation that the status-bar/menu layout fix actually
  resolved the issue (see above).

## CI pipeline gotchas already solved (don't re-debug these)

- `npm ci` needs a lockfile; use `npm install` if none exists yet.
- `capacitor.config.ts` needs `typescript` as a devDependency or the CI
  Node step fails.
- Base64-decoding secrets: use `base64 -d -i` (ignore-garbage) — GitHub's
  secret paste UI can introduce stray whitespace. Even so, one Firebase
  secret got genuinely corrupted once by a dropped character during a
  chat-UI copy/paste — if a decode ever fails validation, don't just retry
  the same flag tweak; suspect the source value and have the user re-copy
  it from a local `.env` file instead of chat.
- Current Android Gradle Plugin (pulled in by `@capacitor/android`) needs
  **JDK 21**, not 17, in `actions/setup-java`.
- Target/compile SDK must be forced to **36** (Android 16) via `sed` on
  `android/variables.gradle` after `cap add android`, since Capacitor's
  default lags behind.
- Pushing to `.github/workflows/*.yml` requires a PAT with **both** `repo`
  and `workflow` scopes — a `repo`-only token gets rejected by GitHub.
- `versionCode`/`versionName` reset to `1`/`"1.0"` on every `cap add
  android` — patched via `sed` on `android/app/build.gradle` using
  `github.run_number` (see Versioning above).

## Downloading build artifacts (for updating the hosted APK, or testing)

```sh
TOKEN=$(grep '^GITHUB_TOKEN=' /var/lib/odoo/.secrets/github.env | cut -d= -f2)
# Find the latest successful run:
curl -s -H "Authorization: token ${TOKEN}" \
  "https://api.github.com/repos/apexsinc/apexsinc-mobile-odoo/actions/runs?per_page=1" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['workflow_runs'][0]['id'])"
# List its artifacts, then download+unzip the one you want:
curl -s -H "Authorization: token ${TOKEN}" \
  "https://api.github.com/repos/apexsinc/apexsinc-mobile-odoo/actions/artifacts/<artifact_id>/zip" \
  -o artifact.zip && unzip artifact.zip
```
To trigger a fresh release build on demand:
```sh
curl -s -X POST -H "Authorization: token ${TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/apexsinc/apexsinc-mobile-odoo/actions/workflows/build-android.yml/dispatches" \
  -d '{"ref":"main","inputs":{"track":"release"}}'
```
