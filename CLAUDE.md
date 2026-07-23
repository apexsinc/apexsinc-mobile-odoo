# apexsinc-mobile-odoo — Notes for AI Assistants

Companion to `README.md` (which covers build/setup steps for humans). This
file is about *state and decisions* — read it before assuming something
isn't done yet, or redoing something that was already deliberately chosen.
See also `/var/lib/odoo/CLAUDE.md` on the Odoo server itself for the wider
system this app talks to.

## Git commit/push rules (hard rules — read this before any commit)

- **No AI attribution, anywhere.** No `Co-Authored-By` trailers, no
  mention of Claude/AI/assistant in commit messages, comments, or PR
  descriptions.
- **Git identity for commits:** `janasco <jaymaranasco@gmail.com>`. Set it
  per-repo with `git config user.name "janasco"` and
  `git config user.email "jaymaranasco@gmail.com"` before committing if a
  repo doesn't already have it configured that way (check with
  `git config user.name`/`user.email` first).

## What this is

A Capacitor-based native Android wrapper around the live APEXS Odoo site
(`server.url` remote mode — this is a thin native shell, not a bundled
offline web build). Built for two targets: Play Store submission, and
internal APK sideloading straight to employees. Package
`com.apexsinc.mobile`, display name **APEXS** / "APEXS Mobile".

## Repo layout notes

- `android/` and `ios/` are **not committed** (gitignored). CI regenerates
  the native Android project fresh on every run via `npx cap add android`,
  then patches it (SDK level, signing) with `sed`/appended Gradle. This
  keeps the whole build reproducible from source control alone — don't
  "fix" this by trying to commit `android/`.
- No `package-lock.json` was committed initially since there was no local
  Node toolchain to generate one when the repo was set up — `npm install`
  (not `npm ci`) is used in CI for this reason. If a lockfile now exists,
  CI can switch back to `npm ci` + enable npm caching in `setup-node`.

## Firebase / FCM

- Firebase project: `apexs-mobile`.
- `google-services.json` = **client** config. Not committed, injected in CI
  from secret `GOOGLE_SERVICES_JSON_BASE64` (base64 of the file). Client-side
  push receiving (`@capacitor/push-notifications`) is wired up.
- **Server-side push sending is built** — see the `apex_mobile_push` Odoo
  addon in `/var/lib/odoo/custom_addons/apex_mobile_push` (documented in
  `/var/lib/odoo/CLAUDE.md`). Device registration, storage, and FCM sending
  all work; the only missing piece is the user pasting a Firebase
  *service-account* JSON (distinct from `google-services.json`) into the
  `apex_mobile_push.service_account_json` system parameter on the Odoo
  side. No business-event triggers (e.g. "push on new order") are wired up
  yet, by design — only the reusable send capability exists.

## Release signing — deliberate non-default choice

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

## Known-blocked action

Claude Code's own safety classifier blocks any tool action that moves this
keystore file around — `cp` of it, and (at least once) a `git push` of a
commit containing it, right after it was first added (it also briefly
blocked a plain read-only `git remote -v` in this repo immediately after
that). This isn't a bug to route around: prep (edit/stage/commit) can be
done by an AI assistant, but if a push of a commit touching the keystore
gets blocked, **the human needs to run that push themselves.**

## Status snapshot (last verified check)

**Release signing is fully done and verified end-to-end.** The keystore
commit (`e423b7e`, "Commit release keystore and simplify CI signing setup")
is on `origin/main`. All three signing secrets are set on GitHub. A
`workflow_dispatch` run with `track: release` (run id `29972443460`)
completed with `conclusion=success`, producing signed
`apexsinc-mobile-release-apk` and `apexsinc-mobile-release-aab` artifacts.
Ready for Play Store upload.

**Server-side push sending is built**, pending only the Firebase
service-account JSON from the user — see the Firebase/FCM section above.

## CI pipeline gotchas already solved (don't re-debug these)

- `npm ci` needs a lockfile; use `npm install` until one's committed.
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
