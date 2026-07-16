## What I understand

You are testing the real installed iPhone app from Xcode, not the web preview. The expected behavior is:

1. You log in once.
2. When you close/kill/reopen the app, it must not return to onboarding, the experience flow, or “Skip to Login”.
3. If a valid logged-in session exists, the app should go straight to the app behind a Face ID / Touch ID unlock screen.
4. Face ID / Touch ID should not depend on a hidden settings toggle.
5. The Privacy & Security screen should still show biometric status/test controls clearly.
6. The native iPhone build should not have oversized/broken fonts.

## Root problem to fix

This needs to be treated as three connected native-app failures, not as a UI-only issue:

- Native auth session is not being restored early enough or reliably enough before routing decides where to send you.
- Native plugins for Face ID / Touch ID, app lifecycle, and native storage must be verified and registered in the iOS app, not assumed.
- Mobile font sizing must be locked down for WKWebView/iOS so Safari-style text inflation does not enlarge the UI.

## Plan forward

### 1. Replace fragile session mirroring with a native-aware auth storage adapter

Build a single auth storage layer used directly by the auth client:

- On installed native app: store auth session keys in Capacitor Preferences.
- On web preview/browser: keep using localStorage.
- Ensure auth storage is ready before React routes render.
- Remove race-prone behavior where the app hydrates localStorage after routing has already started.
- Keep explicit sign-out behavior so only real sign-out clears the native session.

Result: reopening the iPhone app should restore the session before the splash/onboarding logic can send you to `/reality-hook`.

### 2. Add an auth-ready gate before all navigation decisions

Add a small startup gate that blocks routing until auth restoration is complete.

- Splash, onboarding, auth page, and native redirect logic must wait for auth readiness.
- If authenticated: send to `/home` immediately.
- If not authenticated: show onboarding/login flow.
- Data queries that need a user should only run after auth is ready.

Result: no more “logged in but sent to experience/skip login” race.

### 3. Make biometric unlock automatic for native logged-in users

Keep Face ID / Touch ID as automatic native behavior:

- If installed native app and session exists: lock screen appears immediately.
- Prompt Face ID / Touch ID automatically.
- Re-lock when the app backgrounds and prompt again on resume.
- If biometrics are unavailable, show the exact status and allow passcode fallback where supported.
- Provide a clear “Sign out” recovery option so nobody gets stuck.

Result: no dependency on finding a toggle before biometrics work.

### 4. Verify and harden iOS native plugin registration

Make iOS registration explicit and verifiable:

- Confirm `NSFaceIDUsageDescription` exists in `Info.plist`.
- Confirm `BiometricAuthNative`, `PreferencesPlugin`, and `AppPlugin` are present in the generated native config.
- Keep a manual AppDelegate/storyboard fallback so plugin registration does not depend only on generated config.
- Confirm `npm run cap:sync:ios` produces bundled web assets in `ios/App/App/public`.

Result: JavaScript calls actually reach native Face ID / Touch ID and native storage.

### 5. Fix Privacy & Security visibility

Make the biometric section visible and understandable:

- Show “Face ID / Touch ID unlock” in Privacy & Security on native builds.
- On web preview, show that it is available only in the installed iPhone app.
- Include a “Test” button on native builds to trigger the biometric prompt.
- Do not hide the section silently if the device reports unavailable.

Result: you can see whether the app detects native biometric capability.

### 6. Fix oversized fonts in the iPhone build

Add iOS/WKWebView-safe typography constraints:

- Disable iOS text auto-sizing with `-webkit-text-size-adjust: 100%`.
- Audit global responsive font rules and mobile containers for oversized text.
- Ensure onboarding/auth/profile screens use bounded mobile font sizes.
- Verify on iPhone-sized viewport and native-like constraints.

Result: Xcode-installed app should match the intended mobile UI sizing.

### 7. Validation before asking you to retest

I will only ask you to spend time testing after I verify locally that:

- TypeScript compile passes.
- `npm run cap:sync:ios` completes successfully.
- iOS generated config includes plugin class registration.
- iOS public bundle exists and contains the biometric/session code.
- Source checks show no startup path clears the session except explicit sign-out/delete-account.
- Mobile font-size rules are in place.

## What you should expect after the fix

After pulling the fix and installing from Xcode:

1. Fresh install: login once.
2. Kill app.
3. Reopen app.
4. App should restore your session.
5. Face ID / Touch ID prompt should appear.
6. After successful Face ID / Touch ID, app opens directly to the logged-in interface.
7. It should not show the experience flow or Skip to Login unless you actually signed out.

## Exact final test command after implementation

When I say it is ready, use:

```bash
git pull
npm install
npm run cap:sync:ios
```

Then open Xcode, install on the physical iPhone, login once, kill/reopen.

## Important note

If Face ID still does not appear after this, the next required signal is not another guess: we will add a native diagnostics screen that prints the device result from `checkBiometry()` inside the app, including whether iOS reports `biometryNotEnrolled`, `biometryNotAvailable`, `passcodeNotSet`, or a missing native plugin. That will identify the exact device/native reason in one run.