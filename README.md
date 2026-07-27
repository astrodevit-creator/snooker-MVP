<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/6330ccdb-5086-4a84-abf3-e297951528cc

## Run Locally

**Prerequisites:**  Node.js, a Supabase project


1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env.local` and fill in:
   - `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — your Supabase project (Settings > API)
   - `GEMINI_API_KEY` — optional, only needed for the AI daily-summary feature
3. In your Supabase project's SQL Editor, run the setup script shown in the app's
   Admin > Settings > Database Fix tab (also in `components/SettingsModal.tsx`). This
   creates all tables, the pricing/table config, daily session numbering, and hashed
   default logins (`admin@snooker.club` / `admin`, `user@snooker.club` / `user` —
   change these after your first login).
4. Run the app:
   `npm run dev`

There is no fallback Supabase project baked into the source — you must configure your
own via `.env.local` or the in-app Settings screen before the app will connect.
