# Activation steps

The codebase wires up the full flow but several pieces are gated behind
external services. Activate them in this order:

## 1. Upgrade Firebase project to Blaze (pay-as-you-go)

Required for: **Cloud Functions, Cloud Storage, outbound HTTPS calls**.

The free Spark plan blocks Cloud Functions and Firebase Storage. Blaze has a
generous free tier (~5 GB storage, ~1 GB egress/day, 2M function calls/month
included) — typical real-world cost for this app: **~R0/month**. Set a budget
alert so there are no surprises.

1. <https://console.firebase.google.com/project/rosy-morn-prop-2026/usage/details>
2. Click **Modify plan → Blaze**.
3. Optional but recommended: set a R200 / month budget alert.

## 2. Enable Cloud Storage

Required for: **selfie uploads at registration, ticket attachments,
before/after photos**.

1. <https://console.firebase.google.com/project/rosy-morn-prop-2026/storage>
2. Click **Get started**, pick region `europe-west1`.
3. Deploy the storage rules:
   ```bash
   firebase deploy --only storage
   ```

## 3. VerifyNow API key

Required for: **automated tenant identity & credit checks at registration**.

1. Sign up at <https://www.verifynow.co.za> and create an API key.
2. Set the key as a Firebase secret (lives encrypted at rest, only readable
   by deployed functions):
   ```bash
   firebase functions:secrets:set VERIFYNOW_API_KEY
   # Paste the key when prompted.
   ```
3. (Optional) For testing without spending credits, set the mode to sandbox:
   ```bash
   firebase functions:config:set verifynow.mode=sandbox
   ```
   Or leave production as the default.

## 4. Deploy Cloud Functions

```bash
cd functions && npm install && cd ..
firebase deploy --only functions
```

Functions are pinned to `europe-west1`. After deploy, the
`verifyTenant` callable becomes available to the frontend
automatically. The Register form will call it for new tenant
registrations; staff can re-run it from the **Approvals** page.

## 5. Email-to-owner pipeline (optional but recommended)

Required for: **emailing the full credit-check result to the property
owner with subject "Tenant Application - 21 Breda - Credit Check"**.

The cleanest path is the Firebase **Trigger Email** extension — it
watches the `mail/` Firestore collection (which `verifyTenant` already
writes to) and sends each document via an SMTP provider you supply.

1. <https://extensions.dev/extensions/firebase/firestore-send-email>
2. Click **Install in Firebase Console**, pick this project.
3. Configure with:
   - **Authentication Type**: SMTP
   - **SMTP connection URI**: `smtps://<user>:<pass>@<host>:465`
     (e.g. SendGrid, Mailgun, Postmark, your own provider)
   - **Email documents collection**: `mail`  ← matches our writes
   - **Default FROM address**: e.g. `noreply@chimerasportstrading.com`
4. Once installed, every `verifyTenant` run with an `is_active`
   `property_owner` profile on file will fan out an email to that
   address with the full results.

If the extension isn't installed the writes still happen — they just
sit in `mail/` harmlessly until you set it up.

## 6. (Optional) SMS phone verification

Not yet implemented in code. Path forward when needed:

1. Enable Phone Auth in
   [Authentication → Sign-in method](https://console.firebase.google.com/project/rosy-morn-prop-2026/authentication/providers).
2. Add a verification step to the Register wizard using
   `signInWithPhoneNumber` + an invisible reCAPTCHA.
3. Store `phone_verified: true` on the profile once confirmed.

Phone Auth is metered: ~R0.10–R0.50 per SMS depending on country. Free for
the test number you can configure in the console.

---

# Where data goes

| Collection            | Written by                  | Read by                        |
|-----------------------|-----------------------------|--------------------------------|
| `profiles/{uid}`      | Self (registration), staff (role/active updates) | Authed users (see rules)       |
| `banking_details/{uid}` | Self                       | Self, owner, admin             |
| `documents/{uid_docId}` | Self (signing acks)        | Self, staff                    |
| `verifications/{uid}` | `verifyTenant` Cloud Function | Self, staff                  |
| `mail/{auto}`         | `verifyTenant` Cloud Function | Trigger Email extension only |
| `audit_logs/{auto}`   | All authed actions          | Staff                          |

# Architecture map

```
Cloudflare Pages (rm.chimerasportstrading.com)
        │
        ▼
React frontend (Firebase Web SDK)
   ├── Auth / Firestore / Storage  ─→  Firebase project rosy-morn-prop-2026
   └── httpsCallable('verifyTenant')
                                 ▼
                         Cloud Functions (europe-west1)
                                 ├── VerifyNow API (server-side, with secret)
                                 ├── Firestore writes (verifications, profiles)
                                 └── mail/ outbox doc
                                                 ▼
                                          Trigger Email Extension
                                                 ▼
                                          SMTP (SendGrid/Mailgun/...)
                                                 ▼
                                          property_owner inbox
```
