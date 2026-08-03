# Lyra

A small, personal PWA and native iPhone reader for French light novels, web novels and novels from
[Novel-FR](https://novel-fr.net). Library membership and reading progress sync
through the personal server, while downloaded chapters remain on each device.

## Features

- Server-synchronized library and reading progress with offline retry
- Local Novel-FR search, cached covers and explicit chapter downloads
- Novel-FR discovery, series metadata, chapters, covers and reading content
- Volume-aware chapter identity that preserves repeated chapter numbers
- Volume cards with progress, including a `Prologue / Extras` group
- Persistent show/hide control for read chapters and fully completed volumes
- Series details and sticky `1→N` / `N→1` volume and chapter sorting
- Cinematic, responsive interface with persistent Catppuccin Latte and Mocha appearances
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
React PWA ------> Express API ------> novel-fr.net
  |                   |
  |                   +-> SQLite: canonical library + progress
  +-> IndexedDB: local mirror, sync outbox, covers + downloads

Native iPhone --> Express API
  +-> GRDB/SQLite: local mirror, sync outbox, covers + downloads
```

Each client pushes local changes before pulling the canonical server revision.
Offline mutations remain in a durable outbox and retry after reconnecting. The
deployment is intentionally single-user: anyone who can access the private server
can access its synchronized reader state. The deployed application requires the
Node API; static-only hosting cannot fetch Novel-FR content or synchronize state.

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
listener is required. Synchronized state defaults to `.data/lyra.sqlite`; override
it with `LYRA_DATA_PATH`. `localhost` is treated as a secure PWA context.
Installing on another device requires an HTTPS reverse proxy and an always-running
Node host.

## Managed service

[`citadel.service.json`](citadel.service.json) is the machine-service contract used
by Citadel. It provides the same command, health-check, restart, and graceful-stop
metadata as other locally managed projects. `pnpm service:start` starts only the
already-built production process. The manifest also exposes a fixed **Rebuild**
maintenance action backed by `pnpm service:rebuild`: Citadel builds the current
checkout while the existing process remains available, restarts it only after a
successful build, and retains the previous process when the build fails. Tailscale
route changes remain separate deployment operations. Citadel configures
`LYRA_DATA_PATH=.data/lyra.sqlite`; the ignored `.data/` directory survives normal
builds and restarts. Back up the entire directory while the service is stopped to
preserve the SQLite database and journal files.

The existing `pnpm phone` command remains available for an isolated interactive
session when Citadel is not managing the process.

## Access from a phone over Tailscale

With the phone and computer connected to the same tailnet, run:

```bash
pnpm phone
```

The command builds and starts the production PWA, creates a dedicated Tailscale
Serve HTTPS endpoint on port `8443`, and prints the URL to open on the phone. Keep
the terminal open while reading. Press Ctrl-C to stop Lyra and remove only
that endpoint; any existing Tailscale Serve routes on other ports are left intact.

Override either port when needed:

```bash
APP_PORT=4180 TAILSCALE_HTTPS_PORT=10000 pnpm phone
```

The script refuses to replace an occupied local or Tailscale port. Tailscale Serve
provides the secure context required for PWA installation and offline support;
opening the Node server directly through a `100.x.y.z` HTTP address does not.

## Native iPhone app

The [`ios/`](ios/) project provides a SwiftUI app named **Lyra** for iOS 18 or
later. It uses native networking, GRDB persistence, discovery, library, series,
download, and reader interfaces; it contains no embedded browser or camera
capture feature. On first launch, enter the HTTPS URL printed by `pnpm phone` or
the persistent Tailscale Serve URL for the managed service.

```bash
cd ios
xcodegen generate
open Lyra.xcodeproj
```

Select a personal development team in Xcode, connect the iPhone, and run the
`Lyra` scheme. Pointing the PWA and native app at the same server synchronizes
library membership and reading progress. Downloads, cached covers, Catppuccin Latte/Mocha appearance,
and reader preferences remain local to each client. Use the gear button to change
the configured server.

### Wrapper-to-native migration

TestFlight 1.0 (3) is the one-time migration build for users of the former iPhone
wrapper. Open that build while online and wait for **Migration prête ✓** before
installing the native release over it. The native app imports compatible local
chapter downloads, covers, appearance, and reader preferences after it loads the
synchronized library. Keep the migration build installed until the native import
has been confirmed.

Safari and installed PWA data cannot be imported because browser storage is in a
separate sandbox. Download those chapters again in the native app.

### Physical-device checklist

1. Confirm TestFlight 1.0 (3) reports **Migration prête ✓**, then install the
   native build over it and verify the expected downloads and preferences import.
2. Connect through the persistent Tailscale HTTPS URL and verify library changes
   and reading progress synchronize with the PWA in both directions.
3. Download a chapter, disable connectivity, relaunch Lyra, and verify the
   library, series, and downloaded chapter remain readable while network-only
   actions fail clearly.
4. Exercise continuous, paragraph, and sentence modes, including progress
   restoration, tap/swipe navigation, chapter boundaries, and settings changes.
5. Check Dynamic Type, VoiceOver labels/actions, contrast, reduced motion, and
   one-handed touch targets on the physical iPhone.
6. Read a long chapter online and offline while monitoring launch time, scrolling,
   memory, battery, heat, and any thermal warning or unexpected termination.

### TestFlight release

Lyra uses Fastlane from [`ios/fastlane/`](ios/fastlane/). Its ignored
`ios/fastlane/.env` contains only App Store Connect identifiers, the development
team, and a path to the API private key stored outside the repository. The App
Store Connect app record is a one-time manual prerequisite because API keys
cannot create one. From the `ios` directory, the release lane registers the
bundle ID when needed, verifies the app record, selects the next TestFlight build
number, signs the archive, and waits for upload processing:

```bash
cd ios
fastlane ios beta
```

Generated IPAs, symbols, reports, and local release configuration are ignored.

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
- Library metadata and progress are mirrored in IndexedDB and synchronized with
  the server when connectivity is available.
- Offline library/progress changes stay queued locally until a later sync.
- Covers, chapter downloads, themes and reading preferences remain device-local.
- A chapter is available offline only after using its download button on that
  device.
- Search, metadata refreshes, synchronization and non-downloaded chapters require
  the personal server and a network connection.

## Source maintenance

The Novel-FR adapter lives under `server/source/`. It validates source paths,
parses volume and chapter metadata, preserves repeated chapter numbers across
volumes, and sanitizes chapter markup. Live source markup can change independently
of this project.

## Disclaimer

This project is intended for personal use. It is not affiliated with Novel-FR.
Content remains hosted by and belongs to its source and rights holders. Use it in
accordance with the source's terms and applicable law.
