# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Snooker Club Manager — a client-only React SPA (originally scaffolded in Google AI Studio) for running a snooker club's table billing. Admins and staff clock games in/out per table, the app computes pricing and daily totals, and an admin-only view prints/exports a daily closure report. There is no backend service of its own: the browser talks directly to Supabase (Postgres + Realtime) for data, and directly to the Gemini API for one AI-generated summary paragraph.

## Commands

```bash
npm install       # install dependencies
npm run dev       # start Vite dev server (port 3000, host 0.0.0.0)
npm run build     # production build to dist/
npm run preview   # preview the production build
```

There is no lint script, no test framework, and no test files in the repo — don't assume `npm test` or `npm run lint` exist. Type errors surface only via the editor/`tsc` (`tsconfig.json` has `noEmit: true` and no dedicated `typecheck` script is wired up).

### Environment

Copy `.env.example` to `.env.local` and set:
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — Supabase project connection.
- `GEMINI_API_KEY` — read by `vite.config.ts` and injected as `process.env.API_KEY` / `process.env.GEMINI_API_KEY` at build time (see below).

If env vars are absent, `lib/supabase.ts` falls back to a hardcoded demo project URL/key. The app also lets a user override the Supabase URL/anon key at runtime via `localStorage` (`supabase_url`, `supabase_anon_key`) — see `getSupabaseConfig()`.

There is no SQL migrations folder; the Postgres schema (`games`, `users`, `app_config`, `daily_summaries` tables) is expected to already exist in the target Supabase project. The app detects a missing schema at runtime (`isMissingTableError` in `lib/supabase.ts`) and shows a "Database Tables Not Found" banner (`SetupWarning` in `App.tsx`) rather than failing silently.

## Architecture

### State: Context + hook-per-domain, no separate API/service layer

Each domain has a `contexts/XContext.tsx` (owns state + all Supabase calls for that domain) paired with a thin `hooks/useX.ts` that just does `useContext` and throws if used outside its provider. There is no Redux/Zustand/React Query — Supabase reads/writes, optimistic-ish refetching, and `localStorage` caching all live inline inside the context files:

- `GameContext` — CRUD for `games`, daily summary upsert, Google Sheets backup/export, realtime subscription on the `games` table, `localStorage` cache (`snooker_games_cache`) for offline-first reads.
- `UserContext` — CRUD for `users`, `localStorage` cache (`snooker_users_cache`), seeds two `DEFAULT_USERS` (admin/user with fixed UUIDs) when the table/cache is empty.
- `AuthContext` — **not** Supabase Auth. It's a mock session: `login()` looks up a user by email in `UserContext` and compares plaintext `password` fields client-side. Session lives only in React state (no persisted session token) — refreshing keeps you logged in only if the SPA doesn't remount the provider.
- `BusinessDayContext` — the club's "current business date" (a string in `app_config`), independent of the calendar date, with realtime subscription and an `advanceDay()` action for manual day-rollover.
- `ThemeContext` — light/dark/system, toggled via a `dark`/`light` class on `<html>`, persisted to `localStorage['theme']`. An inline script in `index.html` applies the class before React mounts, to avoid a flash of the wrong theme.

Providers are nested in `App.tsx` in this order: `UserProvider > AuthProvider > GameProvider > ThemeProvider > BusinessDayProvider > HashRouter`. `AuthProvider` depends on `useUsers()`, so `UserProvider` must stay outermost of that pair.

When changing how a domain fetches/writes data, edit the context file directly — there's no repository/DAO layer to intercept in.

### Routing & access control

`react-router-dom` with `HashRouter` (so it works from a static file host / AI Studio preview without server-side routing config). Routes are gated by `components/ProtectedRoute.tsx`, which checks `useAuth().user` and an `allowedRoles: Role[]` prop, redirecting to `/auth` or `/dashboard` as appropriate. Two roles only: `Role.ADMIN` and `Role.USER` (`types.ts`). Adding a new page means adding both a `<Route>` in `App.tsx` and deciding its `allowedRoles`.

### Pricing model

Centralized in `lib/utils.ts` — do not reimplement pricing math elsewhere:
- Pricing is **per-game, flat-rate by table type**, not truly per-second despite the "per-second billing" description in `metadata.json`: Royal tables (`royal`/`magnum`/`stroon` in the name) are 40 MAD/game, Mini tables are 20 MAD/game (`TABLES` in `constants.ts`, mirrored in `getMinPrice`/`calculateLivePrice`/`calculateFinalPrice`).
- `getGameComputedValues(game)` picks between the live in-progress calculation and the stored finished values — use it instead of reading `priceMAD`/`finalPriceMAD` directly when a game might still be `RUNNING`.
- Table-type detection is done repeatedly by substring-matching the table name (`toLowerCase().includes('royal'|'magnum'|'stroon'|'mini')`) — there's no explicit table-type enum, so if you add a table in `constants.ts` with a name that doesn't match these substrings, pricing and the AI Auditor thresholds below will silently default to the "mini"/30-min fallback.

### "AI Auditor" (`hooks/useAIAuditor.ts`)

Despite the name, this is a plain heuristic timer, not an LLM call: it flags any `RUNNING` game that has exceeded a threshold (25 min for Mini tables, 45 min for Royal tables) and plays a synthesized two-tone audio chime once per game per session (dedup via `localStorage['ai_audited_notified']`). Recommendation text is hardcoded in French. The actual Gemini call (`services/geminiService.ts`) is separate and only used to generate the prose paragraph on the printable daily report.

### Gemini integration

`services/geminiService.ts` calls `@google/genai` with `apiKey: process.env.API_KEY`, model `gemini-3-flash-preview`, to turn a day's `Game[]` into one summary paragraph for the printable report (`components/DailyResumePDF.tsx`). This is the only AI-generated content in the app. `vite.config.ts` defines `process.env.API_KEY` and `process.env.GEMINI_API_KEY` from `GEMINI_API_KEY` in the environment — there is no server-side proxy, so the key ships to the browser bundle.

### Google Sheets export (secondary backup path)

`GameContext` also supports pushing `daily_summaries` rows to a user-supplied Google Apps Script Web App URL (stored in `localStorage`, not env vars) via `fetch(..., { mode: 'no-cors' })`. This is a fire-and-forget backup, configured through `components/SettingsModal.tsx` — it's independent of Supabase and has no read path (write-only, since `no-cors` responses are opaque).

### UI layer

- Tailwind is loaded via CDN `<script>` in `index.html` (not a PostCSS build step), with `tailwind.config` inlined there too, mapping `bg-background`/`text-foreground`/etc. utility classes to CSS custom properties defined in the same file (a shadcn/ui-style token system) — there is no `tailwind.config.js` file in the repo to edit.
- `index.html` also carries a browser `importmap` pinning React/react-dom/react-router-dom/@supabase/supabase-js/@google/genai to CDN URLs. This is a holdover from the AI Studio scaffold; the Vite dev/build path bundles these packages from `node_modules` via `package.json` instead, so the importmap and `package.json` versions should be kept in sync manually if either is bumped.
- `components/ui/*` are small local primitives (Button, Card, Input, Select, Badge, CodeBlock) — check there before adding a new generic UI primitive.
- `components/icons/*` are hand-rolled SVG icon components re-exported from `components/icons/index.ts` (no icon library dependency).

### Other things worth knowing

- `migrated_prompt_history/` contains archived AI Studio chat/prompt logs (JSON). It's historical record, not something to read for current app behavior or to edit.
- Currency is always MAD (Moroccan Dirham); `lib/utils.ts#formatCurrency` formats via `Intl.NumberFormat` then string-replaces the `MAD` symbol back in — don't swap in a different currency without checking that hack.
- `TIMEZONE` (`constants.ts`) is `Africa/Casablanca` but is currently just a constant — verify whether a given date computation actually uses it before assuming timezone correctness.
