# Alpha Recovery LLC — Website

React-based public website for Alpha Recovery LLC. Ready for Netlify deployment.

## Stack
- React 18 + React Router v6
- Plain CSS (no Tailwind dependency)
- Netlify Forms (contact form, zero backend)
- Ready for Supabase auth integration (portal phase)

## Local Development

```bash
npm install
npm start
```

## Deploy to Netlify

### Option A: Netlify CLI
```bash
npm install -g netlify-cli
npm run build
netlify deploy --prod --dir=dist
```

### Option B: Netlify Dashboard (Recommended)
1. Push this folder to a GitHub repo
2. Go to https://app.netlify.com → "Add new site" → "Import from Git"
3. Select your repo
4. Build command: `npm run build`
5. Publish directory: `dist`
6. Click "Deploy site"

## Connect Your GoDaddy Domain

1. In Netlify: **Site settings → Domain management → Add custom domain**
   - Enter: `alpharecovery.org`

2. In GoDaddy DNS settings, add/update:
   | Type  | Name | Value                        |
   |-------|------|------------------------------|
   | A     | @    | 75.2.60.5                    |
   | CNAME | www  | your-site-name.netlify.app   |

3. Back in Netlify, enable **HTTPS** (free Let's Encrypt SSL) — auto-provisions within minutes.

## Netlify Forms (Contact Page)

The contact form is already set up with `data-netlify="true"`. 
After first deploy, go to **Netlify → Forms** to see submissions.

## Next Steps (Portal Phase)
- Set up Supabase project at https://supabase.com
- Add `.env` file:
  ```
  REACT_APP_SUPABASE_URL=your-project-url
  REACT_APP_SUPABASE_ANON_KEY=your-anon-key
  ```
- Portal is deployed separately at `https://portal.alpharecovery.org`
- Public job postings should use `/apply/<role-slug>` so the site can hand applicants to the portal domain
