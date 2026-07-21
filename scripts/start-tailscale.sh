#!/usr/bin/env bash

set -Eeuo pipefail

APP_PORT="${APP_PORT:-4174}"
TAILSCALE_HTTPS_PORT="${TAILSCALE_HTTPS_PORT:-8443}"
APP_PID=""
SERVE_ACTIVE=0

find_tailscale() {
  if command -v tailscale >/dev/null 2>&1; then
    command -v tailscale
  elif [[ -x /Applications/Tailscale.app/Contents/MacOS/Tailscale ]]; then
    printf '%s\n' /Applications/Tailscale.app/Contents/MacOS/Tailscale
  else
    return 1
  fi
}

validate_port() {
  local name="$1"
  local value="$2"
  if [[ ! "$value" =~ ^[0-9]+$ ]] || (( value < 1 || value > 65535 )); then
    printf 'Error: %s must be a port between 1 and 65535.\n' "$name" >&2
    exit 1
  fi
}

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM HUP

  if (( SERVE_ACTIVE )); then
    printf '\nRemoving the Tailscale HTTPS mapping on port %s…\n' "$TAILSCALE_HTTPS_PORT"
    "$TAILSCALE" serve --yes --https="$TAILSCALE_HTTPS_PORT" off >/dev/null || true
  fi

  if [[ -n "$APP_PID" ]] && kill -0 "$APP_PID" 2>/dev/null; then
    printf 'Stopping LN Reader…\n'
    kill -TERM "$APP_PID" 2>/dev/null || true
    wait "$APP_PID" 2>/dev/null || true
  fi

  exit "$exit_code"
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM HUP

validate_port APP_PORT "$APP_PORT"
validate_port TAILSCALE_HTTPS_PORT "$TAILSCALE_HTTPS_PORT"

TAILSCALE="$(find_tailscale || true)"
if [[ -z "$TAILSCALE" ]]; then
  printf 'Error: Tailscale is not installed.\n' >&2
  exit 1
fi

if [[ ! -x node_modules/.bin/tsx ]]; then
  printf 'Error: dependencies are missing. Run "pnpm install" first.\n' >&2
  exit 1
fi

status_json="$("$TAILSCALE" status --json)"
backend_state="$(printf '%s' "$status_json" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.parse(s).BackendState||''))")"
dns_name="$(printf '%s' "$status_json" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write((JSON.parse(s).Self?.DNSName||'').replace(/\\.$/,'')))")"

if [[ "$backend_state" != "Running" || -z "$dns_name" ]]; then
  printf 'Error: Tailscale is not connected or MagicDNS is unavailable.\n' >&2
  exit 1
fi

serve_json="$("$TAILSCALE" serve status --json)"
if SERVE_JSON="$serve_json" SERVE_PORT="$TAILSCALE_HTTPS_PORT" node -e 'const x=JSON.parse(process.env.SERVE_JSON); process.exit(x.TCP?.[process.env.SERVE_PORT] ? 0 : 1)'; then
  printf 'Error: Tailscale HTTPS port %s is already in use; refusing to replace it.\n' "$TAILSCALE_HTTPS_PORT" >&2
  printf 'Choose another port with TAILSCALE_HTTPS_PORT=<port> pnpm phone.\n' >&2
  exit 1
fi

if command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:"$APP_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  printf 'Error: local port %s is already in use.\n' "$APP_PORT" >&2
  printf 'Choose another port with APP_PORT=<port> pnpm phone.\n' >&2
  exit 1
fi

printf 'Building the production PWA…\n'
pnpm build

printf 'Starting LN Reader on local port %s…\n' "$APP_PORT"
PORT="$APP_PORT" ./node_modules/.bin/tsx server/index.ts &
APP_PID=$!

ready=0
for _ in {1..80}; do
  if curl --fail --silent --show-error "http://127.0.0.1:$APP_PORT/api/health" >/dev/null 2>&1; then
    ready=1
    break
  fi
  if ! kill -0 "$APP_PID" 2>/dev/null; then
    break
  fi
  sleep 0.25
done

if (( ! ready )); then
  printf 'Error: LN Reader did not become ready on port %s.\n' "$APP_PORT" >&2
  exit 1
fi

printf 'Creating an isolated Tailscale HTTPS mapping on port %s…\n' "$TAILSCALE_HTTPS_PORT"
"$TAILSCALE" serve --bg --yes --https="$TAILSCALE_HTTPS_PORT" "$APP_PORT" >/dev/null
SERVE_ACTIVE=1

if [[ "$TAILSCALE_HTTPS_PORT" == "443" ]]; then
  phone_url="https://$dns_name"
else
  phone_url="https://$dns_name:$TAILSCALE_HTTPS_PORT"
fi

printf '\nLN Reader is available to devices in your tailnet:\n\n  %s\n\n' "$phone_url"
printf 'Keep this terminal open. Press Ctrl-C to stop the app and remove only this mapping.\n'

set +e
wait "$APP_PID"
app_exit=$?
set -e
exit "$app_exit"
