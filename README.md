# Rosy Morn | Property Management Console

A full-stack web application for managing repairs, maintenance, contractor workflows, approvals, quotations, and payments for a shared residential property.

---

## Architecture

```
house/
├── frontend/          # React + Vite + TailwindCSS → Cloudflare Pages
├── backend/           # Node.js + Express + Supabase → Google Cloud Run
├── supabase/
│   └── migrations/    # PostgreSQL schema (run in Supabase SQL editor)
├── .github/workflows/ # GitHub Actions CI/CD
└── docker-compose.yml # Local development
```

## Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Frontend    | React 18, Vite, TailwindCSS, Zustand, React Query, Recharts |
| Backend     | Node.js 20, Express, express-validator |
| Database    | Supabase (PostgreSQL + RLS)         |
| Auth        | Supabase Auth (JWT)                 |
| Storage     | Supabase Storage                    |
| Deploy FE   | Cloudflare Pages                    |
| Deploy BE   | Google Cloud Run                    |
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

---

## Quick Start (Local)

### Prerequisites
- Node.js 20+
- A [Supabase](https://supabase.com) project (free tier works)

### 1. Clone the repository

```bash
git clone https://github.com/chimeracloud/house.git
cd house
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run `supabase/migrations/001_initial_schema.sql`
3. In **Storage**, create a bucket called `attachments` (set to public)
4. Note your project URL, anon key, and service role key

### 3. Configure the backend

```bash
cd backend
cp .env.example .env
# Edit .env with your Supabase credentials
npm install
npm run dev
```

### 4. Configure the frontend

```bash
cd frontend
cp .env.example .env
# Edit .env: VITE_API_URL=http://localhost:8080/api
npm install
npm run dev
```

Frontend: http://localhost:5173 · Backend: http://localhost:8080

### 5. Create your first admin user

In the Supabase SQL editor, after running the migration:

```sql
-- Run backend first, then use the API:
POST /api/auth/admin/users
{
  "email": "owner@yourdomain.com",
  "full_name": "Property Owner",
  "role": "property_owner",
  "password": "SecurePassword123!"
}
```

Or use Supabase Dashboard → Authentication → Users to create users, then set their role in the `profiles` table.

---

## Docker (Local)

```bash
# Copy env files first
cp backend/.env.example backend/.env
# Edit backend/.env with real credentials

docker-compose up --build
```

---

## Deployment

### Backend → Google Cloud Run

#### Required GitHub Secrets

| Secret                           | Description                               |
|----------------------------------|-------------------------------------------|
| `GCP_PROJECT_ID`                 | Your Google Cloud project ID              |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Workload identity provider resource name  |
| `GCP_SERVICE_ACCOUNT`            | Service account email for deployments     |

#### Required Google Cloud Secrets (Secret Manager)

Create these in GCP Secret Manager:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALLOWED_ORIGINS` (e.g. `https://house-management.pages.dev`)

#### Setup

```bash
# Enable required APIs
gcloud services enable run.googleapis.com containerregistry.googleapis.com secretmanager.googleapis.com

# Create service account
gcloud iam service-accounts create house-deploy \
  --display-name="House Management Deploy"

# Grant permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:house-deploy@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:house-deploy@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.admin"
```

### Frontend → Cloudflare Pages

#### Required GitHub Secrets

| Secret                    | Description                        |
|---------------------------|------------------------------------|
| `CLOUDFLARE_API_TOKEN`    | Cloudflare API token with Pages permissions |
| `CLOUDFLARE_ACCOUNT_ID`   | Your Cloudflare account ID         |
| `VITE_API_URL`            | Your Cloud Run backend URL + `/api`|

#### Setup

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → Pages → Create a project
2. Name it `house-management`
3. Create an API token with **Cloudflare Pages: Edit** permission

---

## API Reference

### Authentication
| Method | Path                   | Auth | Description               |
|--------|------------------------|------|---------------------------|
| POST   | `/api/auth/login`      | —    | Login, returns JWT tokens |
| POST   | `/api/auth/refresh`    | —    | Refresh access token      |
| GET    | `/api/auth/me`         | ✓    | Get current user profile  |
| PATCH  | `/api/auth/me`         | ✓    | Update profile            |
| POST   | `/api/auth/admin/users`| ✓    | Create user (admin/owner) |
| GET    | `/api/auth/admin/users`| ✓    | List all users            |

### Tickets
| Method | Path                         | Description                    |
|--------|------------------------------|--------------------------------|
| GET    | `/api/tickets`               | List tickets (filterable)      |
| POST   | `/api/tickets`               | Create ticket                  |
| GET    | `/api/tickets/:id`           | Get ticket with full details   |
| PATCH  | `/api/tickets/:id`           | Update ticket                  |
| POST   | `/api/tickets/:id/comments`  | Add comment                    |
| POST   | `/api/tickets/:id/attachments`| Get signed upload URL         |
| POST   | `/api/tickets/:id/signoff`   | Inspection sign-off            |

### Quotations
| Method | Path                    | Description                         |
|--------|-------------------------|-------------------------------------|
| GET    | `/api/quotes`           | List quotations                     |
| POST   | `/api/quotes`           | Submit quote (contractor)           |
| GET    | `/api/quotes/:id`       | Get quotation detail                |
| POST   | `/api/quotes/:id/approve`| Approve quote                      |
| POST   | `/api/quotes/:id/reject` | Reject quote                       |

### Contractors
| Method | Path                         | Description                  |
|--------|------------------------------|------------------------------|
| GET    | `/api/contractors`           | List all contractors         |
| GET    | `/api/contractors/:id`       | Contractor profile           |
| POST   | `/api/contractors/:id/rate`  | Submit rating                |
| GET    | `/api/contractors/:id/analytics`| Performance stats          |

### Payments
| Method | Path                          | Description                |
|--------|-------------------------------|----------------------------|
| GET    | `/api/payments`               | List payments              |
| POST   | `/api/payments`               | Create payment record      |
| POST   | `/api/payments/:id/authorize` | Owner authorizes payment   |
| POST   | `/api/payments/:id/paid`      | Mark as paid               |

### Dashboard
| Method | Path                                    | Description              |
|--------|-----------------------------------------|--------------------------|
| GET    | `/api/dashboard/stats`                  | Summary statistics       |
| GET    | `/api/dashboard/activity`               | Recent audit log         |
| GET    | `/api/dashboard/costs`                  | Monthly cost breakdown   |
| GET    | `/api/dashboard/notifications`          | User notifications       |
| PATCH  | `/api/dashboard/notifications/:id/read` | Mark notification read   |
| POST   | `/api/dashboard/notifications/read-all` | Mark all read            |
| GET    | `/api/dashboard/rooms`                  | Property rooms list      |

---

## Ticket Workflow

```
[Pending] → [Awaiting Quote] → [Approved] → [In Progress]
                                                    ↓
                                        [Awaiting Inspection]
                                          ↙            ↘
                                    [Completed]    [In Progress] ← re-work
                                          ↓
                                        [Paid]
```

## Payment Workflow

```
Ticket Completed → Payment Created (pending)
                        ↓
               Owner Authorizes (authorized)
                        ↓
               Manager Marks Sent (paid)
                        ↓
               Ticket Status → Paid
```

---

## Environment Variables

### Backend (`backend/.env`)

```env
NODE_ENV=development
PORT=8080
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ALLOWED_ORIGINS=http://localhost:5173,https://your-app.pages.dev
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:8080/api
```

---

## Database Schema

Key tables: `profiles`, `properties`, `rooms`, `maintenance_tickets`, `ticket_attachments`, `ticket_comments`, `quotations`, `quote_items`, `approvals`, `payments`, `contractor_ratings`, `notifications`, `audit_logs`

Full schema: [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql)

---

## License

Private repository — © 2026 Ascot Wealth Management. All rights reserved.
