# Dule.app — notes for Claude Code

Personal PWA for a father acting as doula during his wife's labour. UI text is **Brazilian Portuguese**; code/comments in English.

## Stack
- Vite + React 19 + TypeScript, plain CSS (`src/styles.css`, CSS variables). Light theme (soft pink gradients, pill shapes, Nunito, bundled via @fontsource so it works offline) is the default; dark is `:root[data-theme="dark"]`, chosen in Configurações (`Settings.tema`).
- `vite-plugin-pwa` (generateSW) for offline + install.
- Cloud: Supabase (`src/supabase.ts`, schema + RLS in `supabase/schema.sql`). IndexedDB stays what the screens read (offline-first); `src/sync.ts` queues local writes in the `outbox` store, pushes them when there is a cloud session, pulls the cloud copy back (own data, or everything for the admin) and re-pulls on Supabase Realtime changes. Login = Supabase Auth with a hidden e-mail derived from the name; offline falls back to the local copy of the account. Phone-only accounts are moved to the cloud (with their data) at their first online login.
- All data in IndexedDB (`src/db.ts`): stores `events`, `partos`, `audio` (Blobs), `kv` (settings, one per user as `settings:<userId>`), `users`.
- Accounts (`src/auth.ts`): name + password; a local copy (salted SHA-256) allows offline login; session in localStorage. Each `Parto` has a `userId`; partos created before accounts are claimed by the first user who logs in. Admin login `AdminDule` (password hash only in the code; cloud admin rights = `profiles.is_admin`, set by step 2 of the SQL) opens `components/Admin.tsx`: dashboard, full contraction history of every user, share/CSV export, and "Tela do usuário" (the user's own `App` inside a `StoreProvider readOnly`). Admin views refresh live: every IndexedDB write is broadcast on `BroadcastChannel('dule')` (`onDbChange` in `db.ts`), plus a 5 s poll.

## Commands
- `npm run dev` — dev server (use `--host` URL on the phone, same Wi-Fi)
- `npm test` — unit tests for the labour logic (`src/logic.test.ts`)
- `npm run build` — type-check + production build into `dist/`

## Map
- `src/types.ts` — `DuleEvent` (single timeline of contractions, texts, audios, shortcuts), `Parto`, `Settings`.
- `src/content.ts` — all user-facing medical copy: phases + recommendations, pain bands, mood emojis, shortcut defaults. Edit texts here.
- `src/logic.ts` — pure functions: stats, suggested phase, 5-1-1 alert, trend, report builder/text. Keep it pure and tested.
- `src/store.tsx` — React context: loads/saves via `db`, running contraction (persisted in localStorage), clock tick.
- `src/main.tsx` — `Root`: no session → `Login`, admin → `Admin`, user → `StoreProvider` + `App`.
- `src/App.tsx` — main screen (header, pinned timer, banners, phase window, chat, shortcuts, composer) and screen switching.
- `src/components/` — `Timer`, `PhaseWindow`, `Chat` (+`AudioPlayer`), `Composer` (text + hold-to-record + Web Speech transcription), `Sheets` (pain, mood, options, phase picker, edit), `Report`, `ContractionsList`, `Settings`.

## Rules
- Phase is only **suggested** (last 60 min of contractions); expulsivo/nascimento are manual. Never present it as a diagnosis.
- Every record has a timestamp that can be edited.
- One-hand use: tap targets ≥ 44px, primary actions ≥ 56px.
- Data is stored on the device and synced to the user's own Supabase rows (RLS); only the admin can read other users' data.
- Spec lives in the Claude project "Dule.app" (doc "Dule.app — Especificação").
