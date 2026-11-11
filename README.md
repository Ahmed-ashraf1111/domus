# Domus

Domus is a real estate management platform: a public website for browsing published properties, and a staff workspace (CRM) for managing inventory, leads, visits and deals. Admin and Agent roles see different data.

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
- Leads: list, details, stages, notes and calls, preferences, assignment to an agent (Admin only)
- Visits: schedule, status updates, conflict warning when the same agent already has a visit at that time
- Deals: linked to property, lead and agent, with stages and an Admin override when a property is already booked
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
    demo-images/   images used by the demo seed
    schema.sql     database structure (10 tables)
    seed.js        creates the agency, admin and agent
    seed-demo.js   creates 8 demo properties with images
    index.js       Express app
  frontend/
    src/           pages, layouts, components, API client, i18n files
```

## Run locally

Requirements: Node.js, PostgreSQL, a Cloudinary account (only needed for image upload and the demo seed).

1. Create the database and load the schema:

```
createdb -U postgres domus
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

1. Neon: create a project, copy the direct connection string, then load the schema: `psql "<connection string>" -f backend/schema.sql`.
2. Run the seeds against Neon from a terminal where `DATABASE_URL` (and `CLOUDINARY_URL` for the demo seed) is set: `node seed.js` and `node seed-demo.js`.
3. Vercel API project: root directory `backend`, framework preset Express (`backend/vercel.json` routes everything to `index.js`). Add `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN` (the frontend URL) and `CLOUDINARY_URL`.
4. Vercel frontend project: root directory `frontend`, preset Vite (`frontend/vercel.json` rewrites all paths to `index.html`). Add `VITE_API_URL` pointing to the API URL plus `/api`.
5. Redeploy after changing any environment variable.

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

- No automated tests yet.
- No OpenAPI/Swagger documentation; endpoints are listed above.
- No end-to-end frontend tests.
- No migration tool; schema changes are manual.
- The inquiry rate limit is kept in memory per serverless instance, so it is not exact on Vercel.
- The first request after a period of inactivity can be slower (serverless cold start).
- Visit conflict checking and booking are not inside one transaction, so two simultaneous requests could both pass.
- The public part assumes a single agency (general inquiries go to the first agency).
- `POST /leads`, `PATCH /deals/:id` and the visit `outcome` field exist in the API but have no screen in the frontend.
- Activity texts created by the backend (for example "Lead assigned to ...") are English only, even in Arabic mode.
- Property descriptions are stored in one language and are not translated.
- Uploads are limited to 4 MB per file and 4 files per request because of Vercel's request size limit.
- Out of scope: customer accounts, rentals and leases, invoices, document storage, maintenance, notifications, audit log, 2FA, email verification and password reset.

## Third-party services

- Neon (PostgreSQL hosting)
- Cloudinary (image storage)
- Vercel (hosting)
- GitHub (source code)
