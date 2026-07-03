# HelpDesk — AI-Powered Support Ticket System

A full-stack support helpdesk application built with Next.js 15, Prisma ORM, PostgreSQL (Supabase), and Google Gemini AI. It supports individual user accounts, role-based access control, AI-powered ticket classification, duplicate detection, multi-team assignment, work logs, and a full activity audit trail.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [Features](#features)
4. [How the Gemini API Works](#how-the-gemini-api-works)
5. [Authentication & RBAC](#authentication--rbac)
6. [Multi-Team Assignment](#multi-team-assignment)
7. [Duplicate Detection](#duplicate-detection)
8. [Activity Logging](#activity-logging)
9. [Database Schema](#database-schema)
10. [Environment Variables](#environment-variables)
11. [Getting Started](#getting-started)
12. [Interview Questions & Answers](#interview-questions--answers)

---

## Tech Stack

| Technology | Version | Why It Was Used |
|---|---|---|
| **Next.js** | 15 | Full-stack React framework with App Router, API routes, and Edge middleware all in one project |
| **React** | 19 | Component-based UI, hooks for state management |
| **Prisma ORM** | 5.22 | Type-safe database access, schema-first migrations, works seamlessly with PostgreSQL |
| **PostgreSQL** | via Supabase | Robust relational database; Supabase provides managed hosting + connection pooling |
| **Google Gemini AI** | `@google/generative-ai` 0.21 | Structured JSON output for ticket classification — category, team, priority, and draft response |
| **bcryptjs** | 2.4 | Password hashing with salt rounds; pure JS, no native bindings needed |
| **jose** | 5.9 | Edge-compatible JWT signing/verification (used in Next.js middleware which runs on Edge runtime) |
| **jsonwebtoken** | 9.0 | Server-side JWT operations in Node.js API routes |
| **Tailwind CSS** | 3.4 | Utility-first styling, fast iteration, no CSS files needed |


---

## Project Structure

```
helpdesk/
├── app/
│   ├── page.jsx                        # Public client portal (submit ticket)
│   ├── layout.js                       # Root layout
│   ├── globals.css                     # Tailwind base styles
│   ├── login/page.jsx                  # Login page
│   ├── dashboard/page.jsx              # Team member dashboard
│   ├── admin/
│   │   ├── page.jsx                    # Admin dashboard (all tickets)
│   │   └── users/page.jsx              # User management
│   ├── tickets/[id]/page.jsx           # Ticket detail page
│   ├── settings/page.jsx               # Change password
│   ├── components/
│   │   ├── Navbar.jsx
│   │   ├── TicketTable.jsx             # Table with inline status/team controls
│   │   ├── ActivityTimeline.jsx        # Audit trail display
│   │   ├── WorkLogPanel.jsx            # Work log display + add form
│   │   ├── StatusBadge.jsx             # TeamBadge, TeamsDisplay, PriorityBadge, etc.
│   │   ├── StatsCards.jsx
│   │   ├── FilterBar.jsx
│   │   └── LoadingSpinner.jsx
│   └── api/
│       ├── auth/
│       │   ├── login/route.js          # POST — email+password auth
│       │   ├── logout/route.js         # POST — clear cookie
│       │   ├── me/route.js             # GET — current user
│       │   └── change-password/route.js
│       ├── tickets/
│       │   ├── route.js                # GET (list) + POST (create)
│       │   ├── check-duplicate/route.js
│       │   └── [id]/
│       │       ├── route.js            # GET + PATCH + DELETE
│       │       ├── activity/route.js
│       │       └── work-logs/route.js
│       └── users/
│           ├── route.js                # GET + POST
│           └── [id]/route.js          # PATCH + DELETE
├── lib/
│   ├── auth.js                         # JWT helpers + getUserFromRequest
│   ├── prisma.js                       # Prisma client singleton
│   ├── classifier.js                   # AI classification pipeline
│   ├── duplicate.js                    # Duplicate detection algorithm
│   └── activity.js                     # Activity logger
├── middleware.js                       # Route protection (Edge runtime)
├── prisma/
│   ├── schema.prisma
│   └── seed.js
└── .env
```


---

## Features

### Public Client Portal (`/`)
- Any visitor can submit a support ticket — no login required
- Two-phase submission: first checks for duplicates, then creates the ticket
- On success, displays ticket ID, assigned team(s), priority, and the AI-generated draft response

### Team Member Dashboard (`/dashboard`)
- Shows only tickets assigned to the logged-in user's team
- Inline status change (Open → In Progress → Resolved) without leaving the page
- Filters by status, category, priority

### Admin Dashboard (`/admin`)
- Full view of all tickets across all teams
- Team breakdown cards (clickable filters): Development, Billing, HR, Support
- Inline multi-team reassignment via checkbox popover
- All filters combined: status + category + priority + team

### Ticket Detail Page (`/tickets/[id]`)
- Full ticket info with AI draft response
- Status and priority controls
- Admin-only multi-team assignment with checkboxes
- Work Logs tab: internal notes (team-only) or client-visible notes
- Activity tab: full chronological audit trail

### User Management (`/admin/users`)
- Create individual users with name, email, password, role, and team
- Each person has their own credentials — no shared team accounts
- Edit name, role, team inline; delete accounts
- Password change from Settings page


---

## How the Gemini API Works

The Gemini API is used exclusively for **automatic ticket classification**. When a client submits a ticket, the system needs to decide:

1. **Category** — Billing, Bug, Feature Request, HR, or Other
2. **Assigned Team(s)** — Development, Billing, HR, or Support
3. **Priority** — Low, Medium, or High
4. **Draft Response** — a 2–3 sentence professional reply the team can send back to the client

### The Classification Pipeline (`lib/classifier.js`)

The system uses a **three-stage hybrid pipeline** — Gemini is only called when the simpler stages fail:

```
Stage 1: Near-duplicate check
  └─ If a very similar ticket exists → reuse its classification (no API call)

Stage 2: Keyword classifier (rule-based, instant)
  └─ If confidence ≥ 65% → use keyword result (no API call)
  └─ If confidence < 65% → proceed to Stage 3

Stage 3: Google Gemini API call
  └─ Structured JSON output with enforced schema
  └─ If Gemini fails/is unavailable → fall back to keyword result
```

### Why this design?
- **Cost efficiency** — most tickets have obvious keywords (e.g. "invoice", "crash", "leave request") and never need Gemini
- **Speed** — keyword classification is instant; Gemini adds ~1–2 seconds only for ambiguous tickets
- **Reliability** — the app works fully even without a Gemini API key; it just won't generate polished draft responses for edge cases

### What Gemini receives
```
Subject: [ticket subject]
Description: [ticket description]

Classify this ticket with:
- category: One of Billing, Bug, Feature Request, HR, Other
- priority: One of Low, Medium, High
- assignedTeam: One of Development, Billing, HR, Support
- draftResponse: A professional, empathetic response of 2-3 sentences
```

### Structured Output (JSON Schema enforcement)
Rather than parsing free text, the API is called with `responseMimeType: "application/json"` and a `responseSchema` that enforces enum values. This means Gemini **cannot** return an invalid team name or category — the schema rejects it at the API level.

### Where the result goes
The classification result (`category`, `assignedTeams`, `priority`, `draftResponse`, `source`) is stored on the Ticket record in the database. The `source` field records whether it came from `"gemini"`, `"keyword"`, `"keyword-fallback"`, or `"duplicate"` — useful for auditing classification quality.


---

## Authentication & RBAC

### How Login Works
1. User submits email + password to `POST /api/auth/login`
2. Server looks up the user by email in the database
3. `bcrypt.compare()` verifies the password against the stored hash
4. On success, a JWT is signed with `{ id, name, email, role, team }` and set as an **HTTP-only cookie** (`auth_token`, 7-day expiry)
5. Every subsequent request reads this cookie and calls `getUserFromRequest()` which **re-fetches the full user record from the database** — not just the JWT payload

### Why re-fetch from DB instead of trusting the JWT?
- If an admin changes a user's role or team, the change takes effect **immediately** on the next request
- Activity logs always record the **current** role/team, never a stale snapshot from an old JWT
- JWT payload is only used for the user's `id`; everything else comes from the live DB record

### Roles
| Role | Access |
|---|---|
| `Admin` | All tickets, all teams, user management, team reassignment |
| `TeamMember` | Only tickets where their team is in `assignedTeams` |

### Middleware (Edge Runtime)
`middleware.js` runs on Next.js Edge runtime before any page loads. It uses `jose` (not `jsonwebtoken`) because the Edge runtime does not support Node.js built-ins like `crypto` that `jsonwebtoken` depends on. The middleware only verifies the JWT signature — it does not call Prisma (no DB on Edge).

### Route Protection
| Path | Rule |
|---|---|
| `/dashboard` | Must be authenticated; Admins redirected to `/admin` |
| `/admin` | Admin role only |
| `/tickets/*` | Any authenticated user (API enforces team scoping) |
| `/settings` | Any authenticated user |


---

## Multi-Team Assignment

Tickets are stored with `assignedTeams String[]` — a PostgreSQL array. A ticket can be assigned to one or more teams simultaneously (e.g. `["Development", "HR"]` for a payroll system bug).

### Access rule
A TeamMember can view, update, and add work logs to any ticket where their team appears **anywhere** in the `assignedTeams` array:
```js
ticket.assignedTeams.includes(user.team)
```

### How admin assigns multiple teams
- **Ticket detail page**: checkbox list in the right sidebar — tick teams, click "Save Teams"
- **Dashboard table**: "Reassign" column has a dropdown button that opens a checkbox popover

### Activity log on team change
Every change records exactly what was added and removed:
> *Ananya (Admin) updated assigned teams: added HR; removed Support*

---

## Duplicate Detection

### Algorithm (`lib/duplicate.js`)
Uses a **weighted Jaccard similarity** score across four signals:

| Signal | Weight |
|---|---|
| Subject text similarity | 0.50 |
| Description text similarity | 0.35 |
| Category match bonus | 0.10 |
| Team match bonus | 0.05 |

### Subject-dominance rule
If two tickets share ≥ 70% of subject words, the score is floored at 0.65 regardless of description differences. This catches synonym pairs like "database issue" vs "database problem" which Jaccard alone would score low.

### Thresholds
- **≥ 60%** → warn the user ("A similar ticket already exists")
- **≥ 55%** → silently reuse the existing ticket's classification (no Gemini call)

### Two-phase submission flow
1. `POST /api/tickets/check-duplicate` — checks similarity, returns match info + pre-computed classification
2. If duplicate found → UI shows warning with "Go Back" or "Create Anyway"
3. If user forces creation → `POST /api/tickets` with `forceCreate: true`, links `duplicateOfId` and stores `similarityScore`


---

## Activity Logging

Every action on a ticket is recorded in `TicketActivity` with:
- `userId`, `userName`, `userRole`, `userTeam` — who did it
- `action` — one of: `created`, `status_updated`, `priority_changed`, `teams_updated`, `ai_draft_generated`, `work_log_added`, `ticket_deleted`, `duplicate_detected`
- `detail` — human-readable sentence: *"Ananya (Development) changed status from Open to In Progress"*
- `oldValue`, `newValue` — shown as strikethrough → green pill in the UI
- `createdAt` — timestamp

System-generated entries (ticket created by AI, draft generated) have null `userId` and display as "System / AI".

---

## Database Schema

```prisma
model Ticket {
  id             String   @id @default(cuid())
  subject        String
  description    String   @db.Text
  category       String   @default("Other")
  assignedTeams  String[] @default(["Support"])  // PostgreSQL array
  priority       String   @default("Medium")
  draftResponse  String?  @db.Text
  status         String   @default("Open")
  isDuplicate    Boolean  @default(false)
  duplicateOfId  String?
  similarityScore Float?
  activities     TicketActivity[]
  workLogs       TicketWorkLog[]
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model User {
  id        String   @id @default(cuid())
  name      String
  email     String   @unique
  password  String                    // bcrypt hash
  role      String   @default("TeamMember")  // Admin | TeamMember
  team      String?                   // Development | Billing | HR | Support
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model TicketActivity {
  id        String   @id @default(cuid())
  ticketId  String
  userId    String?
  userName  String?
  userRole  String?
  userTeam  String?
  action    String
  detail    String?  @db.Text
  oldValue  String?
  newValue  String?
  createdAt DateTime @default(now())
}

model TicketWorkLog {
  id         String   @id @default(cuid())
  ticketId   String
  userId     String?
  userName   String
  userRole   String
  team       String?
  note       String   @db.Text
  visibility String   @default("Internal")  // Internal | Client
  createdAt  DateTime @default(now())
}
```

---

## Environment Variables

```env
# Supabase PostgreSQL — transaction-mode pooler (for queries)
DATABASE_URL="postgresql://USER:PASSWORD@HOST:6543/postgres?pgbouncer=true"

# Supabase PostgreSQL — session-mode pooler (for migrations)
DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/postgres"

# JWT signing secret — use a long random string in production
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET="your-secret-here"

# Google Gemini API key — get from https://aistudio.google.com/
GEMINI_API_KEY="your-key-here"

NEXTAUTH_URL="http://localhost:3000"
```


---

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env
# Fill in DATABASE_URL, DIRECT_URL, JWT_SECRET, GEMINI_API_KEY

# 3. Push schema to database
npx prisma db push

# 4. Generate Prisma client
npx prisma generate

# 5. Seed test accounts and sample tickets
node prisma/seed.js

# 6. Start development server
npm run dev
```

### Test Accounts (password: `*****************`)

| Role | Name | Email |
|---|---|---|
| Admin | Admin User | admin@helpdesk.com |
| Development | Ananya Rajan | ananya@helpdesk.com |
| Development | Vikram Nair | vikram@helpdesk.com |
| Billing | Priya Mehta | priya@helpdesk.com |
| Billing | Rohan Sharma | rohan@helpdesk.com |
| HR | Divya Krishnan | divya@helpdesk.com |
| HR | Arjun Pillai | arjun@helpdesk.com |
| Support | Sneha Patel | sneha@helpdesk.com |
| Support | Rahul Gupta | rahul@helpdesk.com |

### Useful Commands

```bash
npm run db:studio      # Open Prisma Studio (visual DB browser)
npm run db:migrate     # Run Prisma migrations (requires direct DB connection)
npm run db:seed        # Re-seed the database
npm run build          # Production build
```


---

## Interview Questions & Answers

### Architecture & Design

**Q: Why did you choose Next.js for this project instead of a separate frontend and backend?**

Next.js App Router lets you colocate API routes, server components, and client components in one project. For a helpdesk tool this size, maintaining two separate repositories (e.g. React + Express) adds deployment complexity with no real benefit. The API routes run as serverless functions, the middleware runs on Edge, and the UI is React — all from one codebase with one deployment.

**Q: Why use Prisma instead of raw SQL or another ORM?**

Prisma gives you a type-safe query builder generated from your schema. When the schema changes, `prisma generate` updates the client and TypeScript catches any mismatches at compile time. It also handles connection pooling configuration cleanly through the `DATABASE_URL` and `DIRECT_URL` split — the pooler URL for runtime queries and the direct URL for migrations. Raw SQL would work but adds maintenance overhead and no type safety.

**Q: Your DATABASE_URL uses port 6543 with `pgbouncer=true` but DIRECT_URL uses port 5432. Why two URLs?**

Supabase provides two connection modes. Port 6543 is the transaction-mode pooler (PgBouncer) — it reuses a small pool of connections efficiently for short-lived serverless requests. However PgBouncer doesn't support the PostgreSQL advisory locks that Prisma migrations use. Port 5432 is the session-mode direct connection which supports those locks. So queries use 6543, migrations use 5432.

**Q: Why store `assignedTeams` as a PostgreSQL array instead of a separate join table?**

For this use case an array is simpler and sufficient. The number of teams is small (4), fixed, and you only ever query "does this array contain X" — which PostgreSQL handles natively with `@>` or `= ANY()`. A join table would be correct for a truly relational many-to-many with extra attributes, but adds two extra queries per ticket fetch with no benefit here. Prisma exposes this as `{ has: "HR" }` in the where clause.

---

### Authentication & Security

**Q: Why use HTTP-only cookies for the JWT instead of localStorage?**

HTTP-only cookies are not accessible from JavaScript, which eliminates XSS attacks stealing the token. If the site had a script injection vulnerability, `localStorage` tokens would be immediately stolen. HTTP-only cookies are sent automatically by the browser with every request and can only be cleared server-side or via `maxAge: 0`.

**Q: Why does `getUserFromRequest` re-fetch the user from the database on every API call instead of just decoding the JWT?**

The JWT is only trusted for the `id` field. The actual `role` and `team` come from a live DB query. This means if an admin demotes a TeamMember or changes their team, it takes effect on the very next request — no need to wait for the 7-day JWT to expire or force a re-login. It also ensures activity logs always capture the user's current role, not a stale snapshot.

**Q: Why use `jose` for JWT in middleware but `jsonwebtoken` is also in the dependencies?**

Next.js middleware runs on the **Edge runtime**, which is a stripped-down V8 environment without Node.js built-ins like `crypto`, `fs`, or `Buffer`. The `jsonwebtoken` library depends on Node's `crypto` module and crashes on Edge. `jose` is built entirely on the Web Crypto API, making it Edge-compatible. `jsonwebtoken` remains in the project as a legacy dependency but isn't actively used — `jose` handles everything.

**Q: How does the password hashing work and why bcryptjs instead of bcrypt?**

`bcrypt.hash(password, 12)` runs the password through the bcrypt algorithm with a cost factor of 12 (meaning 2^12 = 4096 iterations). This makes brute-force attacks computationally expensive. `bcryptjs` is a pure JavaScript implementation of the same algorithm — no native C++ bindings. This matters on serverless platforms where native modules can cause deployment failures. The output is identical to the native `bcrypt` package.

**Q: What would happen if an attacker tried to forge a JWT?**

The JWT is signed with `HS256` using the `JWT_SECRET` from the environment. Without knowing the secret, any modification to the payload (e.g. changing `role` to `Admin`) would produce a signature mismatch. `jose`'s `jwtVerify` throws an error on any invalid signature, and `verifyToken` returns `null`, which the middleware treats as unauthenticated and redirects to `/login`.

---

### AI & Classification

**Q: Walk me through what happens when a ticket is submitted.**

1. Client hits `POST /api/tickets/check-duplicate` with subject + description
2. Server fetches the 200 most recent open/in-progress tickets
3. Runs the keyword classifier against the new ticket text
4. Runs Jaccard similarity against existing tickets with the subject-dominance rule
5. If similarity ≥ 60% — returns a duplicate warning to the UI (HTTP 409)
6. If no duplicate — classifies the ticket: keyword classifier first, Gemini if confidence < 65%
7. Returns classification + `isDuplicate: false` to the client
8. Client calls `POST /api/tickets` with the pre-computed classification attached
9. Server creates the ticket record and writes activity log entries
10. Returns the created ticket with ID, teams, priority, draft response

**Q: Why run the duplicate check before classification instead of after?**

Because the duplicate check endpoint also returns the pre-computed classification. This means when the user proceeds past the duplicate warning to create the ticket, the client passes back `preClassification` and the server skips calling Gemini a second time. One Gemini call maximum per submission flow.

**Q: What is the Jaccard similarity index and why use it for duplicate detection?**

Jaccard similarity is `|intersection| / |union|` of two word sets. If ticket A has words `{database, error, login}` and ticket B has `{database, login, issue}`, intersection is `{database, login}` (size 2) and union is `{database, error, login, issue}` (size 4), giving 0.5 (50% similar). It's simple, fast, and requires no external model. The limitation is it's purely lexical — "issue" and "problem" are different words. This is addressed by the subject-dominance rule which floors the score at 0.65 when subjects are ≥70% similar.

**Q: What happens if the Gemini API is down or the key is invalid?**

`geminiClassify()` wraps the API call in a try/catch and returns `null` on any error. The pipeline then falls back to the keyword classifier result with `source: "keyword-fallback"`. The ticket is still created and classified — just with a template draft response instead of an AI-generated one. The app is fully functional without Gemini.

**Q: Why use structured output (JSON Schema) with Gemini instead of prompting it to "respond in JSON"?**

Asking a model to "respond in JSON" in the prompt is unreliable — it might add explanation text before the JSON, use inconsistent field names, or hallucinate values outside the allowed enum. Gemini's structured output with `responseSchema` enforces the exact shape at the API level. The model **cannot** return `assignedTeam: "Finance"` if Finance isn't in the enum — the API rejects it before it reaches your code.

---

### Database & Data Modelling

**Q: Why are `userName`, `userRole`, and `userTeam` stored as plain strings on TicketActivity and TicketWorkLog instead of a foreign key to User?**

This is intentional **denormalization** for audit integrity. If you used a foreign key and the user was later deleted, the activity record would either break (FK violation) or lose its author information. By copying the values at write time, the audit trail is permanent and self-contained regardless of what happens to the user account later. This is standard practice for audit logs.

**Q: Why does the Ticket schema use `@default(cuid())` for IDs instead of auto-increment integers?**

CUIDs (Collision-resistant Unique IDs) are safe to generate client-side and across distributed systems without coordination. They don't expose record count (an integer ID of 42 reveals you have roughly 42 tickets), they're harder to enumerate in URLs, and they sort chronologically which is useful for distributed systems.

**Q: How would you add a new team, say "Legal", to this system?**

Five places need updating: the `VALID_TEAMS` constant in `app/api/tickets/[id]/route.js`, the `TEAM_OPTIONS` arrays in `TicketTable.jsx` and `tickets/[id]/page.jsx`, the `TEAMS` constant in `lib/classifier.js`, the color maps in `StatusBadge.jsx`, and the filter options in `FilterBar.jsx`. No migration is needed because teams are stored as plain strings in a Postgres array, not as a referenced enum or foreign key.

---

### Frontend & React

**Q: Why does the TicketTable use an `overrides` state object instead of mutating the tickets array from props?**

The parent component owns the ticket data — mutating it directly would break React's unidirectional data flow. `overrides` is a local state map `{ [ticketId]: { status, assignedTeams } }` that gets merged with each ticket at render time via `merge(ticket)`. This gives instant optimistic UI feedback without a page refresh and without touching the parent's state. If the API call fails, the override simply isn't applied.

**Q: The TeamPicker popover in TicketTable closes and saves — how does the parent table know about the new teams?**

`TeamPicker` receives an `onSaved(newTeams)` callback. After a successful PATCH, it calls `onSaved(data.ticket.assignedTeams)`. The parent's `handleTeamsSaved` function updates the `overrides` state for that ticket ID, which causes the row to re-render with the new teams immediately without re-fetching all tickets.

**Q: How does the ticket detail page prevent an admin from saving with zero teams selected?**

Two guards: first, the "Save Teams" button has `disabled={selectedTeams.length === 0}`, and second, `handleTeamsSave()` checks `if (selectedTeams.length === 0)` and sets an error message before making any API call. The API itself also validates that `assignedTeams` is a non-empty array and returns HTTP 400 if it's empty.

**Q: Why does `teamsChanged` in the ticket detail page use `JSON.stringify([...arr].sort())` for comparison?**

Array comparison with `===` in JavaScript compares references, not values — `[1,2] === [1,2]` is `false`. Sorting before stringifying ensures `["HR", "Development"]` and `["Development", "HR"]` are treated as equal (no change), which is correct because team assignment has no meaningful order.

---

### RBAC & Access Control

**Q: How does the system ensure a Development team member can't see HR tickets?**

Three layers: (1) The API `GET /api/tickets` adds `where: { assignedTeams: { has: user.team } }` to the Prisma query for TeamMembers — only matching tickets are returned from the database. (2) `GET /api/tickets/[id]` calls `userCanAccessTicket()` which checks `ticket.assignedTeams.includes(user.team)` and returns 403 if false. (3) Next.js middleware redirects unauthenticated users to `/login` before any page loads. Defense in depth.

**Q: Can a TeamMember change which teams are assigned to a ticket?**

No. The PATCH route checks `if (assignedTeams && user.role !== 'Admin')` and returns HTTP 403 "Only admins can reassign teams." TeamMembers can only update `status` and `priority` on tickets they have access to.

**Q: What happens if a ticket is assigned to Development + HR, and a Development member tries to delete it?**

They can delete it. `canDelete` in the frontend and `userCanAccessTicket` in the API both check if the user's team appears **anywhere** in `assignedTeams`. Since `["Development", "HR"].includes("Development")` is true, they have access. Only admins can reassign teams, but any member of any assigned team can perform status updates, work logs, and deletions.

---

### Work Logs

**Q: What is the difference between Internal and Client visibility on work logs?**

Internal logs are team-facing notes — investigation findings, debugging steps, internal escalations. They are only returned by the API when the requester is an authenticated team member or admin on the ticket. Client logs are intended for the client to read (e.g. "We've resolved your issue — please update your app to version 2.3.2"). Unauthenticated requests to `GET /api/tickets/[id]/work-logs` only receive `visibility: "Client"` logs.

---

### Deployment & Production

**Q: What would you change before deploying this to production?**

1. Replace `JWT_SECRET` with a cryptographically random 64-character string
2. Set `NODE_ENV=production` so cookies get `secure: true` (HTTPS only)
3. Enable `NEXTAUTH_URL` to the production domain
4. Add rate limiting to `POST /api/auth/login` to prevent brute-force attacks
5. Set up proper logging (e.g. Sentry) to capture errors beyond `console.error`
6. Run `npx prisma migrate deploy` instead of `db push` for production schema changes
7. Remove the seed script's default `password123` accounts or change all passwords

**Q: Why is `prisma db push` used here instead of `prisma migrate dev`?**

`prisma migrate dev` requires an advisory lock on the PostgreSQL database, which Supabase's PgBouncer (transaction pooler on port 6543) does not support — it returns a timeout error. `db push` applies schema changes directly without advisory locking. For production, `prisma migrate deploy` using the direct URL (port 5432) is the correct approach as it applies tracked migration files safely.

