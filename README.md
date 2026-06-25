# Alpha Recovery LLC - Website

Static public website for Alpha Recovery LLC. The production site is built into `dist` and deployed with GitHub Pages.

## Stack

- Static HTML/CSS/JavaScript
- Local content editing and preview scripts
- GitHub Pages deployment
- Ready for Supabase auth integration (portal phase)

## Local Development

```bash
npm install
npm start
```

## Build

```bash
npm run build
```

The build output is written to `dist`.

## Deploy

Deployment is handled by `.github/workflows/pages.yml` on pushes to `main`.

The workflow runs:

```bash
npm run build
```

Then it uploads `dist` to GitHub Pages.

## Domain

The custom domain is tracked in `CNAME`:

```text
alpharecovery.org
```

Update DNS at the domain registrar according to the current GitHub Pages custom-domain settings.

## Contact Form

The public contact form posts to the portal API:

```text
https://portal.alpharecovery.org/api/contact
```

The portal sends submissions by email using its configured email driver. In production, set `EMAIL_DRIVER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`, and `CONTACT_EMAIL` on the portal deployment.

## Next Steps (Portal Phase)

- Portal is deployed separately at `https://portal.alpharecovery.org`
- Keep Supabase service-role credentials only in the portal server deployment environment. Do not put Supabase service-role keys, database URLs, or email API keys in frontend variables such as `REACT_APP_*` or `VITE_*`.
- Public job postings should use `/apply/<role-slug>` so the site can hand applicants to the portal domain
