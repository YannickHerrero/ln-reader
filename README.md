# LN Reader

A small, personal PWA for reading French light novels, web novels and novels from
[Novel-FR](https://novel-fr.net). The library, reading progress and downloaded
chapters stay in the browser's local IndexedDB database.

## Features

- Local library with Novel-FR search and cached covers
- Novel-FR discovery, series metadata, chapters, covers and reading content
- Volume-aware chapter identity that preserves repeated chapter numbers
- Volume cards with progress, including a `Prologue / Extras` group
- Persistent show/hide control for read chapters and fully completed volumes
- Series details and sticky `1→N` / `N→1` volume and chapter sorting
- Cinematic, responsive interface with a persistent light/dark appearance toggle
- Reader-only typography, line spacing, font family and paper appearance controls
- Focused paragraph and sentence modes with centered text, tap zones and unit-by-unit navigation
- Continuous, page-free reading
- Per-chapter progress and automatic completion near the end
- Explicit chapter downloads for offline reading
- Installable PWA with an offline application shell
- Responsive phone and desktop interface

## How it works

A local Express server exposes Novel-FR through a small same-origin API. Chapter
HTML is sanitized on the server and rendered without source scripts or
advertisements. Novel-FR volume and chapter numbers are stored separately, while
source URLs remain the stable chapter identities. Only chapters explicitly
downloaded by the user are persisted for offline use.

```text
React PWA -> Express API -> novel-fr.net
    |
    +-> IndexedDB: library, progress, cached covers and downloads
```

The deployed application requires the Node API; static-only hosting cannot fetch
Novel-FR content.

## Requirements

- Node.js 24+
- pnpm 11+

## Setup

```bash
pnpm install
pnpm dev
```

Open <http://localhost:4173>. Vite proxies `/api` to the Express server on port
4174.

## Production

```bash
pnpm build
PORT=4174 pnpm start
```

The Express process serves both `dist/` and the API at <http://localhost:4174>.
It binds to `127.0.0.1` by default; set `HOST` only when an intentional non-loopback
listener is required. `localhost` is treated as a secure PWA context. Installing on
another device requires an HTTPS reverse proxy and an always-running Node host.

## Managed service

[`citadel.service.json`](citadel.service.json) is the machine-service contract used
by Citadel. It provides the same command, health-check, restart, and graceful-stop
metadata as other locally managed projects. `pnpm service:start` starts only the
already-built production process. The manifest also exposes a fixed **Rebuild**
maintenance action backed by `pnpm service:rebuild`: Citadel builds the current
checkout while the existing process remains available, restarts it only after a
successful build, and retains the previous process when the build fails. Tailscale
route changes remain separate deployment operations.

The existing `pnpm phone` command remains available for an isolated interactive
session when Citadel is not managing the process.

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

The Novel-FR adapter lives under `server/source/`. It validates source paths,
parses volume and chapter metadata, preserves repeated chapter numbers across
volumes, and sanitizes chapter markup. Live source markup can change independently
of this project.

## Disclaimer

This project is intended for personal use. It is not affiliated with Novel-FR.
Content remains hosted by and belongs to its source and rights holders. Use it in
accordance with the source's terms and applicable law.
