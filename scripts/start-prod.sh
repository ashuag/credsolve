#!/usr/bin/env bash
#
# Production deploy / restart for MoneyCash.
# Usage (from anywhere):
#   ./scripts/start-prod.sh
#   bash scripts/start-prod.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Space-separated PM2 process names (matches production: api, customer app, los).
PM2_APPS="${PM2_APPS:-moneycash-api moneycash-los moneycash-app}"
PM2_LOG_LINES="${PM2_LOG_LINES:-80}"
LOG_WAIT_SECONDS="${LOG_WAIT_SECONDS:-8}"
MIN_UPTIME_MS="${MIN_UPTIME_MS:-3000}"

declare -A PM2_RESTARTS_SNAPSHOT=()

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { printf '%b\n' "${BLUE}==>${NC} $*"; }
ok()   { printf '%b\n' "${GREEN}✓${NC} $*"; }
warn() { printf '%b\n' "${YELLOW}WARN:${NC} $*"; }
fail() { printf '%b\n' "${RED}ERROR:${NC} $*" >&2; exit 1; }

run_step() {
  local title="$1"
  shift
  log "$title"
  "$@"
  ok "$title"
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

pm2_metric() {
  local app_name="$1"
  local field="$2"
  pm2 jlist | node -e "
    const list = JSON.parse(require('fs').readFileSync(0, 'utf8'));
    const app = list.find((p) => p.name === process.argv[1]);
    if (!app) process.exit(2);
    const env = app.pm2_env || {};
    switch (process.argv[2]) {
      case 'status':
        process.stdout.write(env.status || 'unknown');
        break;
      case 'restarts':
        process.stdout.write(String(env.restart_time ?? 0));
        break;
      case 'uptime':
        process.stdout.write(String(Math.max(0, Date.now() - (env.pm_uptime || Date.now()))));
        break;
      default:
        process.exit(3);
    }
  " "$app_name" "$field" 2>/dev/null
}

check_pm2_app() {
  local app_name="$1"
  local restarts_before="$2"
  local has_issue=0
  local has_warning=0

  log "Checking PM2: ${app_name}"

  if ! pm2 describe "$app_name" >/dev/null 2>&1; then
    warn "PM2 process '${app_name}' was not found — skip or create it first."
    return 1
  fi

  local status restarts_after uptime_ms restarts_delta
  status="$(pm2_metric "$app_name" status || echo unknown)"
  restarts_after="$(pm2_metric "$app_name" restarts || echo 0)"
  uptime_ms="$(pm2_metric "$app_name" uptime || echo 0)"
  restarts_delta=$((restarts_after - restarts_before))

  printf '  status=%s  uptime=%sms  restarts=%s (+%s since restart)\n' \
    "$status" "$uptime_ms" "$restarts_after" "$restarts_delta"

  if [[ "$status" != "online" ]]; then
    warn "${app_name}: not online (status=${status})"
    has_issue=1
  elif [[ "$restarts_delta" -gt 2 ]]; then
    warn "${app_name}: crash loop suspected (${restarts_delta} restarts in ${LOG_WAIT_SECONDS}s)"
    has_issue=1
  elif [[ "$uptime_ms" -lt "$MIN_UPTIME_MS" ]]; then
    warn "${app_name}: uptime too low (${uptime_ms}ms < ${MIN_UPTIME_MS}ms) — may still be crashing"
    has_issue=1
  else
    ok "${app_name}: process healthy"
  fi

  local out_tail err_tail
  out_tail="$(pm2 logs "$app_name" --out --lines 25 --nostream 2>/dev/null | grep -E '^\d+\|' | tail -10 || true)"
  err_tail="$(pm2 logs "$app_name" --err --lines 25 --nostream 2>/dev/null | grep -E '^\d+\|' | tail -10 || true)"

  case "$app_name" in
    moneycash-api)
      if printf '%s\n' "$out_tail" | grep -qE 'Nest application successfully started|listening on http'; then
        ok "${app_name}: boot confirmed (API listening)"
      else
        warn "${app_name}: no recent boot success line in stdout"
        has_issue=1
      fi
      ;;
    moneycash-los|moneycash-app)
      if printf '%s\n' "$out_tail" | grep -q 'Ready in'; then
        ok "${app_name}: boot confirmed (Next.js ready)"
      else
        warn "${app_name}: no recent Ready line in stdout"
        has_issue=1
      fi
      ;;
  esac

  if [[ -n "$err_tail" ]]; then
    if printf '%s\n' "$err_tail" | grep -qiE '(MODULE_NOT_FOUND|Cannot find module|pool timeout|pool is ending|EADDRINUSE|ENOMEM|no executable was found)'; then
      warn "${app_name}: recent stderr issues (last 10 lines):"
      printf '%s\n' "$err_tail"
      if printf '%s\n' "$err_tail" | grep -qiE '(MODULE_NOT_FOUND|Cannot find module|pool timeout|pool is ending|EADDRINUSE|ENOMEM)'; then
        has_issue=1
      else
        has_warning=1
      fi
    fi
  fi

  if [[ "$has_issue" -ne 0 ]]; then
    echo ""
    log "Recent stdout for ${app_name} (last 25 lines):"
    pm2 logs "$app_name" --out --lines 25 --nostream 2>/dev/null || true
    return 1
  fi

  if [[ "$has_warning" -ne 0 ]]; then
    warn "${app_name}: running with non-fatal warnings (e.g. Chromium path for PDFs)"
  fi

  return 0
}

check_all_pm2_apps() {
  local app_name
  local failed=0

  log "PM2 health check (waiting ${LOG_WAIT_SECONDS}s after restart)..."
  sleep "$LOG_WAIT_SECONDS"

  for app_name in $PM2_APPS; do
    if ! check_pm2_app "$app_name" "${PM2_RESTARTS_SNAPSHOT[$app_name]:-0}"; then
      failed=1
    fi
    echo ""
  done

  log "PM2 summary:"
  pm2 status || true

  return "$failed"
}

main() {
  require_command npm
  require_command node
  require_command pm2

  log "Starting production deploy from ${ROOT}"
  cd "$ROOT"

  # ── Backend ─────────────────────────────────────────────────────────────────
  run_step "Backend: npm install" bash -c "cd '$ROOT/backend' && npm install"

  run_step "Backend: Chromium / PDF runtime setup" bash -c "cd '$ROOT/backend' && npm run loan-docs:setup-chromium"

  if [[ -f "$ROOT/backend/.env" ]]; then
    browser_path="$(grep -E '^PUPPETEER_EXECUTABLE_PATH=' "$ROOT/backend/.env" | cut -d= -f2- | tr -d '\"' || true)"
    if [[ -n "$browser_path" && ! -x "$browser_path" ]]; then
      warn "PUPPETEER_EXECUTABLE_PATH=$browser_path is not executable — PDF generation may fail"
      warn "Run: cd backend && sudo npm run loan-docs:setup-chromium"
    fi
  fi

  run_step "Backend: ensure Puppeteer Chrome binary" bash -c "cd '$ROOT/backend' && node scripts/ensure-puppeteer-chrome.mjs"

  run_step "Backend: verify Puppeteer Chrome (--check)" bash -c "cd '$ROOT/backend' && node scripts/ensure-puppeteer-chrome.mjs --check"

  run_step "Backend: npm run build" bash -c "cd '$ROOT/backend' && npm run build"

  run_step "Backend: prisma migrate deploy" bash -c "cd '$ROOT/backend' && npm run prisma:migrate:deploy"

  run_step "Backend: prisma seed" bash -c "cd '$ROOT/backend' && npm run prisma:seed"

  # ── LOS ───────────────────────────────────────────────────────────────────
  run_step "LOS: npm install" bash -c "cd '$ROOT/los' && npm install"

  run_step "LOS: npm run build" bash -c "cd '$ROOT/los' && npm run build"

  # ── Customer ──────────────────────────────────────────────────────────────
  run_step "Customer: npm install" bash -c "cd '$ROOT/customer' && npm install"

  run_step "Customer: npm run build" bash -c "cd '$ROOT/customer' && npm run build"

  # ── PM2 ───────────────────────────────────────────────────────────────────
  PM2_RESTARTS_SNAPSHOT=()
  for app_name in $PM2_APPS; do
    PM2_RESTARTS_SNAPSHOT["$app_name"]="$(pm2_metric "$app_name" restarts 2>/dev/null || echo 0)"
  done

  log "PM2: restart all apps --update-env (${PM2_APPS})"
  for app_name in $PM2_APPS; do
    if pm2 describe "$app_name" >/dev/null 2>&1; then
      pm2 restart "$app_name" --update-env
      ok "restarted ${app_name}"
    else
      warn "skipped ${app_name} (not registered in PM2)"
    fi
  done

  if check_all_pm2_apps; then
    echo ""
    ok "Production deploy completed successfully."
  else
    echo ""
    warn "Deploy finished but one or more PM2 apps look unhealthy. Inspect logs:"
    for app_name in $PM2_APPS; do
      echo "  pm2 logs ${app_name}"
    done
    exit 1
  fi
}

main "$@"
