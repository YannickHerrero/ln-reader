# LN Reader

A small, personal PWA for reading French light novels, web novels and novels from
[Mangas-Origines](https://mangas-origines.fr). The library, reading progress and
downloaded chapters stay in the browser's local IndexedDB database.

## Features

- Local library with title search and cached covers
- Source filtering on Madara's `text` type, so manga results are excluded
- Series details and chapter lists
- Continuous, page-free reading
- Per-chapter progress and automatic completion near the end
- Explicit chapter downloads for offline reading
- Installable PWA with an offline application shell
- Responsive phone and desktop interface

## How it works

The React application cannot request Mangas-Origines directly because the site is
protected by Cloudflare and does not expose cross-origin browser APIs. A local
Express server therefore owns a paced Playwright browser session, obtains
Cloudflare clearance, and exposes a small same-origin API.

Chapter HTML is decrypted with the PBKDF2/AES-GCM algorithm shipped by the source,
sanitized on the server, and then rendered without source scripts or advertisements.
Only chapters explicitly downloaded by the user are persisted for offline use.

```text
React PWA -> Express API -> Playwright browser -> mangas-origines.fr
    |
    +-> IndexedDB: library, progress, cached covers and downloads
```

This architecture requires a persistent Node process. Static-only or short-lived
serverless hosting will not work reliably.

## Requirements

- Node.js 24+
- pnpm 11+
- Chromium installed through Playwright, or a local Chrome executable

## Setup

```bash
pnpm install
pnpm exec playwright install chromium
pnpm dev
```

Open <http://localhost:4173>. Vite proxies `/api` to the Express server on port
4174.

If bundled Chromium cannot pass Cloudflare, use an installed Chrome build:

```bash
CHROME_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" pnpm dev
```

Set `PLAYWRIGHT_HEADLESS=false` when a visible browser is needed to diagnose a
Cloudflare challenge.

## Production

```bash
pnpm build
PORT=4174 pnpm start
```

The Express process serves both `dist/` and the API at <http://localhost:4174>.
`localhost` is treated as a secure PWA context. Installing on another device
requires an HTTPS reverse proxy and an always-running Node host capable of running
Playwright.

## Commands

```bash
pnpm dev        # frontend and API with watch mode
pnpm lint       # ESLint
pnpm test       # unit, API, storage and UI tests
pnpm typecheck  # strict TypeScript checking
pnpm build      # typecheck and production/PWA build
```

## Offline behavior

- The service worker precaches the application shell.
- Library metadata, chapter lists, covers and progress are kept in IndexedDB.
- A chapter is available offline only after using its download button.
- Search, metadata refreshes and non-downloaded chapters require the source server
  and a network connection.
- Browser data is device-local and can be removed by the browser or operating
  system. There is no account or cloud synchronization.

## Source maintenance

The source adapter lives under `server/source/`. It validates all source paths,
serializes requests, retries after expired Cloudflare clearance, filters search
results by `type: "text"`, and sanitizes decrypted chapter markup. Live source
markup can change independently of this project.

## Disclaimer

This project is intended for personal use. It is not affiliated with
Mangas-Origines. Content remains hosted by and belongs to its respective source
and rights holders. Use it in accordance with the source's terms and applicable
law.
