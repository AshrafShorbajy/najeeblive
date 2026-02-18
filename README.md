# SudTutor – Production Build with Installer

## What this contains
- Frontend (Vite React) production build output in `dist/`
- Backend installer/API server in `server/index.js` and `server/schema.sql`
- Route gate which loads the Install Wizard first when the server is not installed
- Netlify config at repository root (`netlify.toml`) for builds in a monorepo

## Deploy on a Node web server
1. Copy these to your server:
   - The entire `sudtutor/` directory
   - The root `netlify.toml` (optional for Netlify)
2. On the server, run:
   - `cd sudtutor`
   - `npm ci`
   - `npm run build` (optional, already built into `dist/`)
   - `npm run installer`
3. Open `http://yourserver:4000/` and complete the installer.
4. After installation, the app loads normally and serves the SPA from `dist/`.

## Environment and keys
- Installer requires your Supabase Project URL and Service Role Key.
- For migrations, either add a Supabase PAT in the wizard or the database password.
- Frontend can be connected to your project in `/connect` by pasting Project URL and anon key.

## Netlify (static frontend only)
- If you deploy only the static frontend to Netlify, ensure your backend installer/API is reachable on the same domain or via proxy.
- Root `netlify.toml` sets:
  - `base = "sudtutor"`
  - `command = "npm run build"`
  - `publish = "sudtutor/dist"`
  - SPA redirect to `/index.html`

## Start commands
- Dev frontend: `npm run dev`
- Backend installer/API: `npm run installer`
- Production build: `npm run build`
