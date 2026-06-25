# Alpha Recovery Portal

Private contractor, applicant, company, document, task, message, and audit portal for Alpha Recovery LLC.

## Stack

- React 18 + React Router v6 client
- Node/Express API server
- Custom auth with Argon2 password hashes and HTTP-only sessions
- Postgres-backed production persistence through `DATABASE_URL`
- Supabase Storage support for uploaded documents
- Resend email support for account, invite, reset, and application confirmation emails
- Supabase Auth is intentionally not used

## Local Development

```bash
cd portal
npm install
npm run dev
```

Unified local site, applications, login, and admin: `http://127.0.0.1:4180`  
Portal API: `http://127.0.0.1:8787`

Applicant application route:

```txt
http://127.0.0.1:4180/apply/case-management-specialist
```

Admin recruiting dashboard:

```txt
http://127.0.0.1:4180/admin
```

Fresh local databases start empty. Create real applicant accounts through `/register`; internal staff accounts should be provisioned through the administrative user flow for the target environment.

## Environment

Two env files, loaded by `server/config.js`:

- `.env.local` — local development. Loaded whenever `NODE_ENV` is not `production` (i.e. `npm run dev`). Keep this pointed at the local JSON database (`DATABASE_URL=` empty), local storage, and `EMAIL_DRIVER=log` so local work can never touch production data or send real email.
- `.env` — production credentials. Only loaded by `npm run start` (`NODE_ENV=production`) on a non-Vercel host. Vercel ignores both files and uses its own environment variables.

Copy `.env.example` to `.env` for deployment-specific configuration.

```txt
PORTAL_PORT=8787
PORTAL_CLIENT_ORIGIN=http://127.0.0.1:4180
PUBLIC_PORTAL_URL=http://127.0.0.1:4180

DATABASE_URL=
DATABASE_SSL=true

SUPABASE_URL=your_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_STORAGE_BUCKET=portal-documents
PORTAL_STORAGE_DRIVER=supabase
PORTAL_MAX_UPLOAD_FILE_BYTES=4194304
PORTAL_MAX_UPLOAD_REQUEST_BYTES=4718592
PORTAL_MAX_UPLOAD_FILES=20

EMAIL_DRIVER=resend
EMAIL_FROM=Alpha Recovery <no-reply@alpharecovery.org>
RESEND_API_KEY=your_resend_key
CONTACT_EMAIL=Admin@alpharecovery.org
APPLICATION_EMAIL_TO=Admin@alpharecovery.org
APPLICATION_EMAIL_CC=Topeka.mv@alpharecovery.org

RECRUITER_CAN_VIEW_ALL_APPLICATIONS=false
DRAFT_RETENTION_DAYS=30
REJECTED_RETENTION_DAYS=365
WITHDRAWN_RETENTION_DAYS=365
PDF_VIEW_WATERMARK_ENABLED=false
```

## Auth Model

- No public signup for internal staff, recruiters, admins, or contractors
- Public applicants create an applicant portal account during employment application submission
- Admin-created invites are still used for internal users and contractors
- Invite controls email, role, expiration, and status
- Passwords are hashed with Argon2
- Session token is stored server-side and sent as an HTTP-only cookie
- Disabled users are blocked at session validation
- Login, logout, failed login, invite, upload, download, status, task, message, and note events are logged

## Production Wiring

The portal uses local JSON and local uploads when production environment variables are absent. For production:

1. Set `DATABASE_URL` to a managed Postgres connection string. The server creates and uses `portal_app_state` for the current V1 app state.
2. Set `PORTAL_STORAGE_DRIVER=supabase`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_STORAGE_BUCKET` for uploaded documents.
3. Set `EMAIL_DRIVER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`, and `CONTACT_EMAIL` for production email and public website inquiries. Set `APPLICATION_EMAIL_TO` and optional `APPLICATION_EMAIL_CC` for employment application notifications.
4. Set `PUBLIC_PORTAL_URL` to the public portal origin, for example `https://portal.alpharecovery.org`.
5. Set `PORTAL_CLIENT_ORIGIN` to the browser origin allowed to call the API.

The current route layer keeps `portal_app_state` as a rollback-compatible source while production readiness migrations add relational users, sessions, activity, employment file metadata, drafts, and application lifecycle tables. Run migrations before enabling normalized production workflows:

```bash
npm run db:migrate -- --dry-run
npm run db:migrate
npm run db:verify
npm run db:backfill -- --dry-run
```

Migration `003_rls_baseline` enables Row Level Security on the portal tables and revokes direct Supabase `anon` / `authenticated` table access. The Express API remains the enforcement point for application users; browser clients must not connect directly to the database with table-level privileges.

Rollback/export commands are guarded in production:

```bash
npm run db:export-jsonb -- --dry-run
NODE_ENV=production npm run db:export-jsonb -- --confirm-production
NODE_ENV=production npm run db:rollback -- --to 000 --confirm-production
```

## Vercel Deployment

Deploy the `portal/` folder as its own Vercel project.

Recommended Vercel project settings:

```txt
Root Directory: portal
Install Command: npm install
Build Command: npm run build:vercel
Output Directory: client/dist
```

The included `vercel.json` routes:

- `/api/*` to the Express API function
- all other paths to the React app

Add these environment variables in Vercel for Production and Preview:

```txt
DATABASE_URL
DATABASE_SSL=true
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET=portal-documents
PORTAL_STORAGE_DRIVER=supabase
EMAIL_DRIVER=resend
EMAIL_FROM=Alpha Recovery <no-reply@alpharecovery.org>
RESEND_API_KEY
CONTACT_EMAIL=Admin@alpharecovery.org
APPLICATION_EMAIL_TO=Admin@alpharecovery.org
APPLICATION_EMAIL_CC=Topeka.mv@alpharecovery.org
PUBLIC_PORTAL_URL=https://portal.alpharecovery.org
PORTAL_CLIENT_ORIGIN=https://portal.alpharecovery.org,https://alpharecovery.org,https://www.alpharecovery.org
PORTAL_COOKIE_DOMAIN=
```

Vercel Functions are suitable for the portal API, but large uploads should move to direct-to-Supabase signed uploads before enforcing the full 10MB upload limit in production.

## Production Readiness Commands

```bash
npm test
npm run build:vercel
npm run db:migrate -- --dry-run
npm run db:verify
npm run db:export-jsonb -- --dry-run
npm run retention:purge
npm run storage:cleanup-orphans -- --dry-run
npm run smoke:staging
```

Set `SMOKE_BASE_URL`, `SMOKE_ADMIN_EMAIL`, and `SMOKE_ADMIN_PASSWORD` for staging smoke tests that exercise authenticated admin list and audit endpoints. Without admin smoke credentials, the smoke script runs only the health/config leak check.

Production rollback requires a tested export-back run before reverting application code. Use `--confirm-production` only after confirming the target database and previous Vercel deployment.

## Employment Application System

The role-aware employment application is built into the portal app.

- Applicant entry point: `/apply/:roleSlug`
- Protected admin review: `/admin`
- Role configuration: `shared/applicationConfig.js`
- Uploaded applicant files: local storage in development, Supabase Storage in production
- Draft storage: database-backed portal app state
- Submitted application storage: database-backed portal app state, visible in the admin employment workflow before notification email is attempted

The form has 16 sections. Role-specific behavior is controlled by each role config:

```js
{
  slug: 'case-management-specialist',
  title: 'Case Management Specialist',
  department: 'Field Operations',
  location: 'Nationwide',
  employmentType: 'Contract / Full Time',
  travel: ['Up to 25%', 'Up to 50%', 'Up to 75%', '100%'],
  drivingRequired: true,
  languageRole: 'optional',
  certs: ['fieldCerts'],
  uploads: {
    resume: 'required',
    driversLicense: 'required',
    degree: 'conditional',
    dd214: 'optional',
    certifications: 'conditional'
  }
}
```

To add a new role:

1. Add the role to `ROLE_CONFIGS` in `shared/applicationConfig.js`.
2. Use a lowercase hyphenated slug.
3. Set `drivingRequired`, `languageRole`, certification groups, and upload requirements.
4. Add a matching public job posting in the website job data if the role should appear publicly.
5. Set the public posting `applyUrl` to `/apply/<role-slug>`.

Applicant file uploads accept PDF, DOC, DOCX, JPG, JPEG, and PNG files up to 10MB each. Production email notifications are connected through the configured email driver; the portal record remains the source of truth if email delivery fails.
