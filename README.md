# Rosy Morn | Property Management Console

A full-stack web application for managing repairs, maintenance, contractor workflows, approvals, quotations, and payments for a shared residential property — built on **Firebase** so it runs on the free tier with one-command deploys.

---

## Architecture

```
house/
├── frontend/              # React 18 + Vite + TailwindCSS  →  Cloudflare Pages or Firebase Hosting
├── firestore.rules        # Role-based access control (the security boundary)
├── firestore.indexes.json # Composite indexes
├── storage.rules          # File upload rules (requires Blaze plan)
├── firebase.json          # Hosting + rules config
└── .firebaserc            # Project alias → rosy-morn-prop-2026
```

There is **no separate backend**. The frontend talks directly to Firestore using the Firebase Web SDK. Security is enforced by Firestore Security Rules, not by an Express layer. This is the canonical Firebase pattern.

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Frontend    | React 18, Vite, TailwindCSS, Zustand, React Query, Recharts |
| Auth        | Firebase Auth (email/password)      |
| Database    | Cloud Firestore (free Spark tier)   |
| Storage     | Firebase Storage *(needs Blaze plan)* |
| Hosting     | Cloudflare Pages **or** Firebase Hosting |
| CI/CD       | GitHub Actions                      |

---

## Roles

| Role               | Capabilities                                                         |
|--------------------|----------------------------------------------------------------------|
| `admin`            | Full access to everything                                            |
| `property_owner`   | View all, approve quotes >£500, authorize payments, sign off work    |
| `property_manager` | Create/manage tickets, review quotes, sign off work, log payments    |
| `contractor`       | View assigned jobs, submit quotes, upload progress, track payment    |
| `resident`         | Log issues, view their own tickets                                   |

Roles are stored in `profiles/{uid}.role` and read by Firestore rules at request time.

---

## Quick Start

### Prerequisites
- Node.js 20+
- Firebase project (already exists: `rosy-morn-prop-2026`)
- `firebase` CLI (`npm install -g firebase-tools`) — only needed for deploys

### 1. Configure the frontend

```bash
cd frontend
cp .env.example .env
```

Get the Firebase web config from [Firebase Console → Project Settings → Your apps → Rosy Morn](https://console.firebase.google.com/project/rosy-morn-prop-2026/settings/general) and paste into `.env`:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=rosy-morn-prop-2026.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=rosy-morn-prop-2026
VITE_FIREBASE_STORAGE_BUCKET=rosy-morn-prop-2026.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

```bash
npm install
npm run dev
```

Frontend: <http://localhost:5173>

### 2. Create the first admin user

1. [Firebase Console → Authentication → Users → Add user](https://console.firebase.google.com/project/rosy-morn-prop-2026/authentication/users) — create an account with email + password.
2. Sign in to the app at <http://localhost:5173/login>. A `profiles/{uid}` doc is created automatically with `role: "resident"`.
3. In **Firebase Console → Firestore → profiles**, find your document and change `role` to `admin`.
4. Refresh the app — full admin access.

After that, all subsequent users can be promoted from inside the app via **Settings → User Management**.

---

## Deployment

### Frontend → Cloudflare Pages (recommended — free)

1. Connect the GitHub repo at <https://dash.cloudflare.com> → Pages → Create project.
2. Build settings:
   - Build command: `cd frontend && npm install && npm run build`
   - Build output directory: `frontend/dist`
3. Set the same `VITE_FIREBASE_*` env vars from your `.env` as Cloudflare Pages environment variables.
4. Add your Pages URL to Firebase Authentication → Settings → Authorized domains.

### Frontend → Firebase Hosting (alternative)

```bash
cd frontend && npm run build && cd ..
firebase deploy --only hosting
```

### Firestore rules + indexes

Deploy whenever `firestore.rules` or `firestore.indexes.json` change:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

The `firebase-rules.yml` GitHub workflow does this automatically when those files change on `main`, provided you've added a `FIREBASE_TOKEN` repo secret (generate via `firebase login:ci`).

### Storage (optional — file uploads)

Image and document uploads require [Firebase Storage](https://console.firebase.google.com/project/rosy-morn-prop-2026/storage), which needs the **Blaze (pay-as-you-go) plan**. The app gracefully fails uploads with a clear message if Storage isn't enabled.

To enable:

1. [Firebase Console → Storage → Get started](https://console.firebase.google.com/project/rosy-morn-prop-2026/storage). Pick a region (us-central1 / europe-west2 / etc.).
2. Upgrade to Blaze plan if prompted.
3. Deploy storage rules: `firebase deploy --only storage`.

---

## Required GitHub Secrets

For the build workflow (any push to `main`):

| Secret                              | Required for       |
|-------------------------------------|--------------------|
| `VITE_FIREBASE_API_KEY`             | Frontend build     |
| `VITE_FIREBASE_AUTH_DOMAIN`         | Frontend build     |
| `VITE_FIREBASE_PROJECT_ID`          | Frontend build     |
| `VITE_FIREBASE_STORAGE_BUCKET`      | Frontend build     |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Frontend build     |
| `VITE_FIREBASE_APP_ID`              | Frontend build     |
| `FIREBASE_TOKEN` *(optional)*       | Auto-deploy rules  |

Cloudflare Pages does its build using its own env-var settings — duplicate the `VITE_FIREBASE_*` values there, not in GitHub Secrets.

---

## Data Model (Firestore)

```
profiles/{uid}            { full_name, role, phone, company_name, is_active, ... }
rooms/{id}                { number, name, floor, type }
tickets/{id}              { title, description, status, priority, room_id,
                            created_by, assigned_contractor, deadline, ... }
  comments/{id}           { content, author_id, author_name, ... }
  attachments/{id}        { file_name, file_url, file_type, ... }
  approvals/{id}          { approver_id, type, decision, notes, ... }
quotations/{id}           { ticket_id, contractor_id, total_amount, status, ... }
  items/{id}              { description, item_type, quantity, unit_price, total }
payments/{id}             { ticket_id, contractor_id, amount, status, ... }
contractor_ratings/{id}   { contractor_id, ticket_id, rating, category, ... }
notifications/{id}        { user_id, title, message, type, read, ... }
audit_logs/{id}           { user_id, action, entity_type, entity_id, metadata }
```

All access is gated by `firestore.rules`.

## Workflows

### Ticket lifecycle

```
[pending] → [awaiting_quote] → [approved] → [in_progress]
                                                    ↓
                                        [awaiting_inspection]
                                          ↙            ↘
                                    [completed]    [in_progress] ← re-work
                                          ↓
                                        [paid]
```

### Quote approval

- Manager approves quote ≤ £500 → ticket moves to **approved**, contractor assigned, sibling quotes auto-rejected.
- Manager approves quote > £500 → escalates to owner (`pending_owner_approval`).
- Owner approves → ticket moves to **approved**, sibling quotes rejected.

### Payment lifecycle

```
Ticket completed
   ↓
Manager records payment (status: pending)
   ↓
Owner authorizes (status: authorized, ticket → paid)
   ↓
Manager marks sent (status: paid)
```

---

## Local development tips

- **Email-only auth:** Auth is configured for email/password only. Enable other providers in [Firebase Console → Authentication → Sign-in method](https://console.firebase.google.com/project/rosy-morn-prop-2026/authentication/providers) if needed.
- **Composite indexes:** Firestore needs composite indexes for some queries (e.g. `where('status') + orderBy('created_at')`). They're declared in `firestore.indexes.json` and deploy automatically.
- **First sign-in:** When a new user signs in, a default `profiles/{uid}` doc is *not* created automatically — staff create it via the app's User Management page after the user has signed in once. (Or: an admin creates the doc directly in Firestore Console with the right role.)

---

## License

Private — © 2026 Ascot Wealth Management. All rights reserved.
