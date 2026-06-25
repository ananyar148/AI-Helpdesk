# HelpDesk — AI-Powered Support Ticketing System

A full-stack support helpdesk built with **Next.js App Router**, **Tailwind CSS**, **Prisma ORM**, and **PostgreSQL**. Tickets are automatically classified by a hybrid AI pipeline (keyword rules + Google Gemini) and routed to the correct team.

---

## Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Framework  | Next.js 15 (App Router, JS only)    |
| Styling    | Tailwind CSS 3                      |
| ORM        | Prisma 5 + PostgreSQL               |
| AI         | Google Gemini 1.5 Flash (via API)   |
| Auth       | JWT (jose) + HTTP-only cookies      |

> **No TypeScript** — the entire project is JavaScript (`.js` / `.jsx`).

---

## Features

### Client Portal (`/`)
- Clean responsive ticket submission form
- AI auto-classifies category, team, priority, and generates a draft response
- Shows classification result and AI draft after submission

### Team Dashboard (`/dashboard`)
- Protected — requires login
- Team members **only see tickets assigned to their team**
- Filter by status, category, priority
- Update ticket status (Open → In Progress → Resolved)
- Click any row to expand full description + AI draft response

### Admin Dashboard (`/admin`)
- Full access to **all tickets** across all teams
- Filter by status, category, priority, team
- Reassign tickets to a different team
- Team breakdown cards with quick-filter
- Statistics overview

### AI Classification Pipeline
1. **Near-duplicate check** — if a similar ticket exists, reuse its classification (Jaccard similarity ≥ 70%)
2. **Keyword/rule classifier** — scores ticket against a multi-category keyword ruleset with confidence scoring
3. **Gemini API fallback** — if confidence < 65%, calls `gemini-1.5-flash` with a JSON Schema structured output
4. **Template fallback** — if Gemini is unavailable, uses a category-appropriate template response

---

## Setup Instructions

### 1. Prerequisites

- Node.js 18+
- PostgreSQL running locally (or a hosted DB)

### 2. Clone and Install

```bash
git clone <your-repo>
cd helpdesk
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set:

```env
# Your PostgreSQL connection string
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/helpdesk?schema=public"

# Random secret for JWT signing (change this!)
JWT_SECRET="your-super-secret-jwt-key"

# Get a free key at https://aistudio.google.com/
GEMINI_API_KEY="your-gemini-api-key-here"
```

> If `GEMINI_API_KEY` is not set, the app still works using the keyword classifier and template responses.

### 4. Set Up the Database

Create the database in PostgreSQL:
```sql
CREATE DATABASE helpdesk;
```

Run Prisma migrations:
```bash
npm run db:migrate
# When prompted, name the migration: init
```

Generate the Prisma client:
```bash
npm run db:generate
```

Seed demo data (users + sample tickets):
```bash
npm run db:seed
```

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Demo Accounts

All accounts use the password: **`password123`**

| Role        | Email                    | Access                          |
|-------------|--------------------------|----------------------------------|
| Admin       | admin@helpdesk.com       | All tickets, full admin panel    |
| Development | dev@helpdesk.com         | Development team tickets only    |
| Billing     | billing@helpdesk.com     | Billing team tickets only        |
| HR          | hr@helpdesk.com          | HR team tickets only             |
| Support     | support@helpdesk.com     | Support team tickets only        |

---

## Project Structure

```
helpdesk/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/route.js      # POST — authenticate user
│   │   │   ├── logout/route.js     # POST — clear auth cookie
│   │   │   └── me/route.js         # GET — current user
│   │   └── tickets/
│   │       ├── route.js            # GET list, POST create
│   │       └── [id]/route.js       # GET, PATCH, DELETE single ticket
│   ├── components/
│   │   ├── FilterBar.jsx           # Filter dropdowns
│   │   ├── LoadingSpinner.jsx      # SVG spinner
│   │   ├── Navbar.jsx              # Top navigation
│   │   ├── StatsCards.jsx          # Summary stat cards
│   │   ├── StatusBadge.jsx         # Status/priority/category badges
│   │   └── TicketTable.jsx         # Main ticket table (desktop + mobile)
│   ├── admin/page.jsx              # Admin dashboard
│   ├── dashboard/page.jsx          # Team member dashboard
│   ├── login/page.jsx              # Login page
│   ├── error.jsx                   # Global error boundary
│   ├── globals.css                 # Tailwind + custom classes
│   ├── layout.js                   # Root layout
│   ├── not-found.jsx               # 404 page
│   └── page.jsx                    # Client portal (ticket submission)
├── lib/
│   ├── auth.js                     # JWT sign/verify, cookie helpers
│   ├── classifier.js               # AI classification pipeline
│   └── prisma.js                   # Prisma client singleton
├── prisma/
│   ├── schema.prisma               # Database schema
│   └── seed.js                     # Seed script
├── middleware.js                   # Route protection middleware
├── next.config.js
├── tailwind.config.js
├── postcss.config.js
├── .env.example
└── README.md
```

---

## Scripts

| Command              | Description                              |
|----------------------|------------------------------------------|
| `npm run dev`        | Start development server                 |
| `npm run build`      | Production build                         |
| `npm run start`      | Start production server                  |
| `npm run db:generate`| Regenerate Prisma client                 |
| `npm run db:migrate` | Run database migrations                  |
| `npm run db:seed`    | Seed demo users and tickets              |
| `npm run db:studio`  | Open Prisma Studio (DB GUI)              |

---

## Deployment (Vercel)

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard:
   - `DATABASE_URL` — your hosted PostgreSQL URL (e.g., Supabase, Neon, Railway)
   - `JWT_SECRET` — a long random string
   - `GEMINI_API_KEY` — your Gemini API key
4. Deploy

---

## Database Schema

```prisma
model Ticket {
  id            String   @id @default(cuid())
  subject       String
  description   String
  category      String   @default("Other")
  assignedTeam  String   @default("Support")
  priority      String   @default("Medium")
  draftResponse String?
  status        String   @default("Open")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model User {
  id        String   @id @default(cuid())
  name      String
  email     String   @unique
  password  String
  role      String   @default("TeamMember")
  team      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```
