<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="frontend/public/domus-icon-light.svg" />
    <img src="frontend/public/domus-icon.svg" alt="Domus logo" width="80" />
  </picture>
</p>

# Domus

Domus is a real estate management platform: a public website for browsing published properties, and a staff workspace (CRM) for managing inventory, leads, visits and deals. Admin and Agent roles see different data.

A short guide for staff is available in [docs/USER_GUIDE.md](docs/USER_GUIDE.md).

Live demo (deployed on Vercel):

- Frontend: https://domus-app-brown.vercel.app
- API: https://domus-api-mu.vercel.app (health check: `/api/health`)

## Demo accounts

| Role  | Email           | Password  |
| ----- | --------------- | --------- |
| Admin | admin@domus.com | Admin@123 |
| Agent | agent@domus.com | Agent@123 |

These accounts exist for review only and must be changed or removed before real use.

## Features

Public website

- Home, property listings, property details and contact pages
- Listings show published properties only, with search, filters (purpose, type, city, bedrooms, price), sorting and pagination (filters are kept in the URL)
- Property details with image gallery, inquiry form and similar properties
- Every inquiry creates a CRM lead linked to the property (or a general inquiry from the contact page)

Staff workspace

- Login with JWT, protected routes and role permissions (Admin and Agent)
- Property inventory: create, edit, publish/unpublish, delete, sale or rent, image upload with cover image
- Leads: list, details, stages, notes and calls, preferences, assignment to an agent (Admin only), create a lead manually (Add lead dialog; an Agent's lead is assigned to himself, an Admin can choose the agent)
- Match engine: the lead details page shows the 3 best matching properties with a score out of 100 (see Match engine below)
- Visits: schedule, status updates, conflict warning when the same agent already has a visit at that time
- Deals: linked to property, lead and agent, with stages and an Admin override when a property is already booked; edit amounts, close date and notes of open deals
- Dashboard with counts and charts
- Staff management (Admin only)
- English and Arabic with full RTL support, dark and light mode

Permissions summary

| Area       | Admin                 | Agent                            |
| ---------- | --------------------- | -------------------------------- |
| Properties | Read and write        | Read only                        |
| Leads      | All leads, can assign | Only leads assigned to the agent |
| Visits     | All visits            | Only the agent's own visits      |
| Deals      | All deals             | Only the agent's own deals       |
| Staff      | Full access           | No access                        |

## Match engine

`GET /api/leads/:id/matches` scores properties against the preferences saved on a lead and returns the top 3. Only properties that are published and have the status `available` in the same agency are considered. The score is out of 100 and is built from these criteria:

| Criterion | Points |
| --------- | ------ |
| Budget    | 35     |
| City      | 25     |
| Type      | 20     |
| Bedrooms  | 10     |
| Purpose   | 10     |

Rules:

- A criterion the lead left empty gives full points.
- A price up to 10 percent above the maximum budget gives half of the budget points.
- A bedroom count that differs by exactly 1 gives half of the bedroom points.
- City comparison is case-insensitive.
- An agent only gets matches for leads assigned to him.

## Tech stack

- Backend: Node.js, Express (MVC style), PostgreSQL (`pg`), JWT, bcrypt, multer, express-rate-limit
- Frontend: React, Vite, Tailwind CSS v4, shadcn/ui (Radix), react-router, i18next, recharts, framer-motion
- Database: PostgreSQL 17 locally, Neon in production
- Image storage: Cloudinary
- Hosting: Vercel (two projects, one for the API and one for the frontend)

## Project structure

```
domus/
  backend/
    config/        database and Cloudinary setup
    controllers/   request handlers
    middleware/    auth and upload middleware
    routes/        route definitions
    tests/         automated tests (jest and supertest)
    demo-images/   images used by the demo seed
    schema.sql     database structure (10 tables)
    seed.js        creates the agency, admin and agent
    seed-demo.js   creates 8 demo properties with images
    index.js       Express app
  frontend/
    src/           pages, layouts, components, API client, i18n files
  docs/
    USER_GUIDE.md  short guide for Admin and Agent users
```

## Run locally

Requirements: Node.js, PostgreSQL (the `psql` command must be available), a Cloudinary account (only needed for image upload and the demo seed).

1. Create the database and load the schema (run from the project root):

```
psql -U postgres -c "CREATE DATABASE domus;"
psql -U postgres -d domus -f backend/schema.sql
```

2. Backend:

```
cd backend
copy .env.example .env
npm install
node seed.js
node seed-demo.js
npm run dev
```

Edit `.env` first (see Environment variables). The API runs on http://localhost:5000.

3. Frontend:

```
cd frontend
npm install
npm run dev
```

The frontend runs on http://localhost:5173 and uses `http://localhost:5000/api` by default.

## Tests

The backend has automated tests written with jest and supertest (55 tests in 7 files: authentication, property access, inquiry to lead, match engine, lead permissions, visits, deals). They run only on a separate local database named `domus_test`; the test setup forces this name and removes `DATABASE_URL`, so the tests cannot reach the main or production database. Each test file creates its own data and deletes it afterwards.

One-time setup (run from the project root):

```
psql -U postgres -c "CREATE DATABASE domus_test;"
psql -U postgres -d domus_test -f backend/schema.sql
```

Run the tests:

```
cd backend
npm test
```

The jest output may show `injected env` lines from dotenv; they are logs, not failures.

## Environment variables

Backend (`backend/.env.example`)

| Variable                                        | Purpose                                                         |
| ----------------------------------------------- | --------------------------------------------------------------- |
| PORT                                            | API port (local only)                                           |
| DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD | Local PostgreSQL connection                                     |
| DATABASE_URL                                    | Production connection string (Neon). Replaces the DB\_\* values |
| JWT_SECRET                                      | Secret used to sign tokens. Use a long random value             |
| CORS_ORIGIN                                     | Allowed frontend origin, no trailing slash                      |
| CLOUDINARY_URL                                  | `cloudinary://api_key:api_secret@cloud_name`                    |

Frontend (`frontend/.env.example`)

| Variable     | Purpose                                   |
| ------------ | ----------------------------------------- |
| VITE_API_URL | Base URL of the API, must end with `/api` |

## Database

The schema is a single `schema.sql` file with 10 tables: agencies, users, properties, property_media, contacts, leads, activities, visits, deals, deal_events. There is no migration tool; changes to the schema must be applied manually. `seed.js` and `seed-demo.js` insert the starting data.

## Deployment (Neon + Vercel + Cloudinary)

1. Neon: create a project and load the schema with the direct connection string: `psql "<direct connection string>" -f backend/schema.sql`. For the running API use the pooled connection string (the host contains `-pooler`) as `DATABASE_URL`.
2. Run the seeds against Neon from a terminal where `DATABASE_URL` (and `CLOUDINARY_URL` for the demo seed) is set: `node seed.js` and `node seed-demo.js`.
3. Vercel API project: root directory `backend`, framework preset Express (`backend/vercel.json` routes everything to `index.js`). Set the Function Region (Settings, Functions) to the region closest to the database; the demo uses Frankfurt (fra1) to match Neon in eu-central-1. Add `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN` (the frontend URL) and `CLOUDINARY_URL`.
4. Vercel frontend project: root directory `frontend`, preset Vite (`frontend/vercel.json` rewrites all paths to `index.html`). Add `VITE_API_URL` pointing to the API URL plus `/api`.
5. Redeploy after changing any environment variable or the Function Region.

Images are stored on Cloudinary because Vercel functions have a read-only filesystem.

## API overview

All routes use the prefix `/api` and JSON. Protected routes need the header `Authorization: Bearer <token>`.

Auth

- `POST /auth/login` returns a token and the user
- `GET /auth/me` returns the current user

Public (no login)

- `GET /public/properties` filters: `q, purpose, type, city, min_price, max_price, bedrooms, sort` (`newest`, `price_asc`, `price_desc`), `page`, `limit`
- `GET /public/properties/featured`
- `GET /public/properties/:slug` includes images and similar properties
- `GET /public/filters`, `GET /public/agency`
- `POST /public/inquiries` creates a lead (limited to 10 requests per 15 minutes per client)

Properties (login required)

- `GET /properties`, `GET /properties/:id` (Admin and Agent)
- `POST /properties`, `PUT /properties/:id`, `PATCH /properties/:id/publish`, `DELETE /properties/:id` (Admin)
- `POST /properties/:id/media`, `DELETE /properties/:id/media/:mediaId`, `PATCH /properties/:id/media/:mediaId/cover` (Admin). Up to 4 images per upload, 4 MB each, JPEG, PNG or WebP

Leads (login required)

- `GET /leads`, `POST /leads`, `GET /leads/:id`, `PATCH /leads/:id` (preferences and follow-up date)
- `GET /leads/:id/matches` returns up to 3 matching properties with a score and a breakdown per criterion (see Match engine)
- `PATCH /leads/:id/stage`, `POST /leads/:id/activities` (note or call)
- `PATCH /leads/:id/assign` (Admin)

Visits (login required)

- `GET /visits`, `POST /visits` (returns 409 with `conflicts` unless `force: true`), `PATCH /visits/:id/status`

Deals (login required)

- `GET /deals`, `POST /deals`, `GET /deals/:id`, `PATCH /deals/:id`, `PATCH /deals/:id/stage` (409 when another deal for the property is already booked, unless an Admin sends `override: true`)

Users (Admin)

- `GET /users`, `GET /users/agents`, `GET /users/:id`, `POST /users`, `PUT /users/:id`

Dashboard

- `GET /dashboard` counts scoped to the user's role

Example:

```
curl -X POST https://domus-api-mu.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@domus.com\",\"password\":\"Admin@123\"}"
```

## Known limitations

- Automated tests cover authentication, property access, inquiry-to-lead, the match engine, lead permissions, visits and deals (55 tests). Dashboard counts, staff management and media upload are not covered by automated tests.
- No OpenAPI/Swagger documentation; endpoints are listed above.
- No end-to-end frontend tests.
- `npm audit` reports low and moderate issues in development and CLI tooling (jest, nodemon, eslint, shadcn). The backend production dependencies report 0 vulnerabilities (`npm audit --omit=dev`). The remaining ones were not force-fixed because the fixes are breaking changes.
- No migration tool; schema changes are manual.
- The inquiry rate limit is kept in memory per serverless instance, so it is not exact on Vercel.
- The first request after a period of inactivity is slower (serverless cold start, plus the free Neon database scales to zero after 5 minutes without activity).
- Visit conflict checking and booking are not inside one transaction, so two simultaneous requests could both pass.
- The public part assumes a single agency (general inquiries go to the first agency).
- The visit `outcome` field exists in the API but has no screen in the frontend.
- Activity texts created by the backend (for example "Lead assigned to ...") are English only, even in Arabic mode.
- Property descriptions are stored in one language and are not translated.
- Uploads are limited to 4 MB per file and 4 files per request because of Vercel's request size limit.
- Out of scope: customer accounts, rentals and leases, invoices, document storage, maintenance, notifications, audit log, 2FA, email verification and password reset.

## Third-party services

- Neon (PostgreSQL hosting)
- Cloudinary (image storage)
- Vercel (hosting)
- GitHub (source code)
