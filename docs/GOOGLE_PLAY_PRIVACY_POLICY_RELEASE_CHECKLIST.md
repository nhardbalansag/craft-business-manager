# Google Play privacy policy — release checklist

## Implemented in this web repository
- Standalone HTML (no React hydration, login, downloads, or JS required): `public/privacy-policy/index.html`.
- Published static path after deployment: `/privacy-policy/`.
- Navigation link in Craft Business Manager web drawer.
- App named explicitly: **My Lovely Craft**, Android package `com.mylovelycraft.mobile`.
- Disclosures based on the separate mobile repository's `my-lovely-craft` branch, read-only reviewed on October 23, 2026.
- Includes categories of personal and device data, uses, sharing/recipient categories, local security, retention/deletion and a business privacy-contact mechanism.

## Release tasks that CANNOT be completed by a web-only code merge
1. Publish the production web build to the intended public HTTPS website. Verify `https://mylovelycraft.coresite.pro/privacy-policy/` is available without authentication, geographic restrictions, redirect loops, blocked access or an invalid SSL certificate. Confirm direct loading in a private browser.
2. Review this wording against the **exact Android App Bundle submitted to Google Play**, including permissions, SDKs, networking, Android WebView or third-party services. In particular, document any changes to camera/scanning, payment services, account registration, telemetry and remote storage. Do **not** submit an inaccurate statement about the release artifact.
3. Verify the business's privacy contact link works and accepts questions/deletion requests; replace it with an official monitored email/contact method if necessary.
4. Enter the deployed public HTML URL into the Google Play Console's Privacy Policy field.
5. Add an accessible **in-app** link to that same URL in the Android app (for example under Settings/About). This repository's implementation **does not** modify the mobile repository.
6. Complete the app's **Data safety** answers consistently with actual app behavior. If the release supports account creation, ensure both in-app and web account deletion paths exist and genuinely process the request.
7. Recheck and update the policy's revision date whenever released data practices change.

Reference: https://support.google.com/googleplay/android-developer/answer/10144311

This template and checklist support Google Play compliance; they are not a guarantee of approval or a substitute for verifying published production infrastructure and the final mobile build.
