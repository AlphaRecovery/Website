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

EMAIL_DRIVER=resend
EMAIL_FROM=Alpha Recovery <no-reply@alpharecovery.org>
RESEND_API_KEY=your_resend_key
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
3. Set `EMAIL_DRIVER=resend`, `RESEND_API_KEY`, and `EMAIL_FROM` for production email.
4. Set `PUBLIC_PORTAL_URL` to the public portal origin, for example `https://portal.alpharecovery.org`.
5. Set `PORTAL_CLIENT_ORIGIN` to the browser origin allowed to call the API.

The relational schema remains in `database/schema.sql` for the future normalized database migration. V1 production persistence is database-backed through the `portal_app_state` JSONB table so the existing route layer can ship without a high-risk rewrite.

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
PUBLIC_PORTAL_URL=https://portal.alpharecovery.org
PORTAL_CLIENT_ORIGIN=https://portal.alpharecovery.org
PORTAL_COOKIE_DOMAIN=
```

Vercel Functions are suitable for the portal API, but large uploads should move to direct-to-Supabase signed uploads before enforcing the full 10MB upload limit in production.

## Employment Application System

The role-aware employment application is built into the portal app.

- Applicant entry point: `/apply/:roleSlug`
- Protected admin review: `/admin`
- Role configuration: `shared/applicationConfig.js`
- Uploaded applicant files: local storage in development, Supabase Storage in production
- Draft storage: database-backed portal app state
- Submitted application storage: database-backed portal app state

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

Applicant file uploads accept PDF, JPG, JPEG, and PNG files up to 10MB each. Production email confirmation is connected through the configured email driver.
