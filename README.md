# LN Reader

A small, personal PWA for reading French light novels, web novels and novels from
[Novel-FR](https://novel-fr.net) and [Mangas-Origines](https://mangas-origines.fr).
The library, reading progress and downloaded chapters stay in the browser's local
IndexedDB database.

## Features

- Local library with merged title search and cached covers
- Novel-FR as the primary catalog, with Mangas-Origines releases as fallback
- Conservative chapter deduplication that retains every available source release
- Source filtering that excludes manga results
- Series details, source labels and sticky `1→N` / `N→1` chapter sorting
- Cinematic, responsive interface with a persistent light/dark appearance toggle
- Continuous, page-free reading
- Per-chapter progress and automatic completion near the end
- Explicit chapter downloads for offline reading
- Installable PWA with an offline application shell
- Responsive phone and desktop interface

## How it works

A local Express server aggregates both catalogs behind a small same-origin API.
Novel-FR is queried first. Matching series and chapter numbers are merged while
retaining their release URLs, so a chapter can retry on Mangas-Origines when its
preferred Novel-FR release fails.

Mangas-Origines is protected by Cloudflare and does not expose cross-origin browser
APIs, so its adapter owns a paced Playwright browser session and obtains Cloudflare
clearance. Its chapter HTML is decrypted with the source's PBKDF2/AES-GCM
algorithm. Content from both sources is sanitized on the server and rendered
without source scripts or advertisements. Only chapters explicitly downloaded by
the user are persisted for offline use.

```text
                         +-> novel-fr.net (primary)
React PWA -> Express API |
    |                    +-> Playwright -> mangas-origines.fr (fallback)
    |
    +-> IndexedDB: library, canonical progress, cached covers and downloads
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

## Access from a phone over Tailscale

With the phone and computer connected to the same tailnet, run:

```bash
pnpm phone
```

The command builds and starts the production PWA, creates a dedicated Tailscale
Serve HTTPS endpoint on port `8443`, and prints the URL to open on the phone. Keep
the terminal open while reading. Press Ctrl-C to stop LN Reader and remove only
that endpoint; any existing Tailscale Serve routes on other ports are left intact.

Override either port when needed:

```bash
APP_PORT=4180 TAILSCALE_HTTPS_PORT=10000 pnpm phone
```

The script refuses to replace an occupied local or Tailscale port. Tailscale Serve
provides the secure context required for PWA installation and offline support;
opening the Node server directly through a `100.x.y.z` HTTP address does not.

## Commands

```bash
pnpm dev        # frontend and API with watch mode
pnpm phone      # production PWA over tailnet-only HTTPS
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

The source adapters and merger live under `server/source/`. They validate source
paths, deduplicate matching series and chapters, preserve alternate releases, and
sanitize chapter markup. The Mangas-Origines adapter additionally serializes
browser requests, retries expired Cloudflare clearance, filters search results by
`type: "text"`, and decrypts protected chapters. Live source markup can change
independently of this project.

## Disclaimer

This project is intended for personal use. It is not affiliated with Novel-FR or
Mangas-Origines. Content remains hosted by and belongs to its respective source
and rights holders. Use it in accordance with the source's terms and applicable
law.
