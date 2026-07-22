# apexsinc-mobile-odoo

**APEXS Mobile** - a native Android wrapper around the APEXS Odoo instance
(`https://apexsinc.com/odoo`), built with [Capacitor](https://capacitorjs.com/).

There is no separate UI to maintain: the app opens the live Odoo site
directly in a native shell. That gives you a real installable app (icon,
Play Store listing, push notifications) without duplicating any of the
Odoo interface.

## How builds work

The native `android/` project is **not committed to this repo**. It's
generated fresh on every CI run (`npx cap add android`), then customized
(app icon, Firebase config, signing) by the GitHub Actions workflow at
[`.github/workflows/build-android.yml`](.github/workflows/build-android.yml).
This keeps the repo to just the source of truth (config + branding assets)
instead of hand-maintained generated boilerplate.

Every push to `main` (or manual trigger via the Actions tab) produces:
- **A debug APK** — always built, no secrets required. Good enough to
  sideload straight to employees for internal testing (`adb install` or
  just send the file and let them tap to install after enabling "install
  from unknown sources").
- **A release APK + AAB** — only built once the signing secrets below are
  set. The AAB is what you upload to the Play Store; the release APK is a
  properly-signed alternative to the debug one for internal distribution.

Grab the built files from the workflow run's **Artifacts** section (GitHub
Actions tab → pick a run → scroll to Artifacts).

## One-time setup required

### 1. Firebase / push notifications (required for any build)

Already done for `apexsinc.com` project `apexs-mobile`, package name
`com.apexsinc.mobile`. To wire it into CI:

1. Base64-encode the `google-services.json` file you downloaded from
   Firebase: `base64 -w0 google-services.json`
2. In GitHub: repo → **Settings → Secrets and variables → Actions → New
   repository secret**
   - Name: `GOOGLE_SERVICES_JSON_BASE64`
   - Value: the base64 string from step 1

Without this secret, the workflow fails on purpose (rather than silently
shipping a build where push notifications don't work).

### 2. Release signing (required only for Play Store / signed builds)

Play Store requires every future update to be signed with the **same**
key forever - back this up somewhere safe (a password manager or secure
company drive), losing it means you can never update the Play Store
listing again and would have to publish as a new app.

Generate one (do this once, from any machine with a JDK installed):

```sh
keytool -genkeypair -v -keystore release.keystore \
  -alias apexsinc-mobile -keyalg RSA -keysize 2048 -validity 10000
```

It will ask for a keystore password and a key password (can be the same
value) - remember both. Then add these repo secrets:

| Secret name | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 release.keystore` output |
| `ANDROID_KEYSTORE_PASSWORD` | the keystore password you set |
| `ANDROID_KEY_ALIAS` | `apexsinc-mobile` (or whatever alias you used) |
| `ANDROID_KEY_PASSWORD` | the key password you set |

Once all four are present, the workflow automatically starts producing
signed release APK/AAB builds on top of the debug APK.

### 3. Push notifications end-to-end

This repo only handles the **client** side (the app can receive and
display FCM pushes once Firebase is wired in above). The **server** side
(Odoo deciding when to send a push, and mapping a push token to the right
user) lives in a separate Odoo addon: `apex_mobile_push`, installed on the
`apexsinc.com` Odoo instance. See that addon's own README for how the two
halves connect.

## App branding

- `assets/icon.png` - source app icon (currently the company logo,
  200x200 - fine for now, but for crisper icons at all sizes, replace with
  a 1024x1024 version before a real Play Store submission).
- CI runs `@capacitor/assets` to generate every required Android icon/
  splash resolution from that single source file automatically.

## Local development (optional)

You generally don't need to do this - CI handles everything - but if you
want to run the app locally against Android Studio:

```sh
npm install
npx cap add android
npx cap sync android
# copy your own google-services.json into android/app/ first
npx cap open android
```

## App identity

- Package name / Application ID: `com.apexsinc.mobile`
- Display name: APEXS Mobile
- Points at: `https://apexsinc.com/odoo`
