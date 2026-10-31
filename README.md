# Brightloop Subscription Management System

## Project layout

- `frontend/` contains the React application, Vite configuration, and static assets.
- `backend/` contains the Express server, API controllers and routes, SQLite data models, and Swagger specification.
- `shared/types.ts` contains the domain contracts used by both application layers.
- `data/brightloop.sqlite` is created automatically when the backend starts. Set `SQLITE_DB_PATH` to use a different file.

The backend imports existing `data/brightloop_db.json` data into SQLite on first startup when that legacy file is present. If there is no existing data, it initializes the database with sample data.

## Run locally

Requires Node.js 22.13 or newer (the backend uses Node's built-in `node:sqlite` module).

```bash
npm install
npm run dev
```

The app is available at `http://localhost:3000`. Interactive API documentation is available at `http://localhost:3000/api-docs`, and the OpenAPI document is served from `http://localhost:3000/api-docs.json`.

Password reset links are sent by SMTP. Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, and any required `SMTP_USER` / `SMTP_PASSWORD` values. Set `APP_URL` to the public frontend origin so reset links point to the right deployment. Reset requests return an explicit configuration error if SMTP is not configured.

Only admins and staff can record payments, and each payment must settle the invoice's full outstanding balance. Configure `COMPANY_NAME` if new staff profiles should use a company name.

Active subscriptions renew automatically only when their plan allows renewal. Plans that disallow renewal close after their configured `autoCloseDays` grace period. Pausing preserves billing dates; due invoices are caught up after the subscription resumes.

## Build

```bash
npm run build
npm start
```

The production server serves the built frontend from `frontend/dist`.

## Demo accounts

Demo user records are created in SQLite during database initialization and are available through the normal email/password login form. Their password hashes, not plaintext passwords, are stored in the database.

- Super admin: `admin@brightloop.io` / `Admin@12345!`
- Internal staff: `staff@brightloop.io` / `Staff@12345!`
- Customer: `alex@acmecorp.com` / `Customer@12345!`
