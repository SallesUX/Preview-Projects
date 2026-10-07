# Dule.app — notes for Claude Code

Personal PWA for a father acting as doula during his wife's labour. UI text is **Brazilian Portuguese**; code/comments in English.

## Stack
- Vite + React 19 + TypeScript, plain CSS (`src/styles.css`, CSS variables). Light theme (soft pink gradients, pill shapes, Nunito, bundled via @fontsource so it works offline) is the default; dark is `:root[data-theme="dark"]`, chosen in Configurações (`Settings.tema`).
- `vite-plugin-pwa` (generateSW) for offline + install. No backend, no login.
- All data in IndexedDB (`src/db.ts`): stores `events`, `partos`, `audio` (Blobs), `kv` (settings).

## Commands
- `npm run dev` — dev server (use `--host` URL on the phone, same Wi-Fi)
- `npm test` — unit tests for the labour logic (`src/logic.test.ts`)
- `npm run build` — type-check + production build into `dist/`

## Map
- `src/types.ts` — `DuleEvent` (single timeline of contractions, texts, audios, shortcuts), `Parto`, `Settings`.
- `src/content.ts` — all user-facing medical copy: phases + recommendations, pain bands, mood emojis, shortcut defaults. Edit texts here.
- `src/logic.ts` — pure functions: stats, suggested phase, 5-1-1 alert, trend, report builder/text. Keep it pure and tested.
- `src/store.tsx` — React context: loads/saves via `db`, running contraction (persisted in localStorage), clock tick.
- `src/App.tsx` — main screen (header, pinned timer, banners, phase window, chat, shortcuts, composer) and screen switching.
- `src/components/` — `Timer`, `PhaseWindow`, `Chat` (+`AudioPlayer`), `Composer` (text + hold-to-record + Web Speech transcription), `Sheets` (pain, mood, options, phase picker, edit), `Report`, `ContractionsList`, `Settings`.

## Rules
- Phase is only **suggested** (last 60 min of contractions); expulsivo/nascimento are manual. Never present it as a diagnosis.
- Every record has a timestamp that can be edited.
- One-hand use: tap targets ≥ 44px, primary actions ≥ 56px.
- Data never leaves the device except via the share/export buttons.
- Spec lives in the Claude project "Dule.app" (doc "Dule.app — Especificação").
