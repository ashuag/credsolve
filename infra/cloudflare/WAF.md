# Cloudflare WAF for MoneyCash
#
# ## Why Get OTP shows 403 + "Enable JavaScript and cookies to continue"
#
# Production flow when the browser uses same-origin `/api`:
#
# 1. Browser → `POST https://www.moneycash.in/api/auth/send-otp`
# 2. Next.js proxy (`customer/lib/api-proxy.ts`) → `API_SERVER_URL` (often `https://api.moneycash.in/api/...`)
# 3. Cloudflare on **api.moneycash.in** treats the **Node/undici** fetch as a bot → Managed Challenge HTML
# 4. Proxy forwards that HTML 403 to the browser → UI shows "Unable to send OTP…"
#
# Nest never returns that HTML. Fix infra (below), not the OTP use case.

## Zones

- `moneycash.in` / `www.moneycash.in` (customer Next.js; proxies `/api/*` → Nest)
- `api.moneycash.in` (Nest)

## Fix A — preferred: proxy Nest without Cloudflare challenge

On the **customer** host/container, set `API_SERVER_URL` to Nest **behind** Cloudflare:

| Setup | `API_SERVER_URL` |
|-------|------------------|
| Docker Compose (local) | `http://backend:4001/api` |
| Same VPS as Nest | `http://127.0.0.1:4001/api` |
| Private Docker network (prod) | `http://backend:4001/api` (or your service DNS) |
| Avoid | `https://api.moneycash.in/api` while the record is orange-clouded + Bot Fight on |

Browser can keep `NEXT_PUBLIC_API_URL=/api` (same-origin). Only the **server** hop must bypass CF challenges.

## Fix B — Cloudflare custom rules (if server must call the public API host)

Create on **both** `www` and **`api.moneycash.in`** zones (Security → WAF → Custom rules).

### 1) Skip bot challenges on API (required)

**Name:** `Skip bot challenge on API`  
**Expression:**

```txt
(http.request.uri.path matches "^/api/")
```

**Action:** Skip  
**Skip components:**
- Bot Fight Mode
- Super Bot Fight Mode managed challenges
- Browser Integrity Check / Security Level (if listed)
- Do **not** skip OWASP Managed Rules unless you have a reason

Also allowlist the customer Next.js server egress IPs if Bot Fight still challenges server-side fetches.

### 2) Block common scanners on non-API paths (optional)

**Name:** `Block obvious exploit probes`  
**Expression:**

```txt
(http.request.uri.path contains "../")
or (http.request.uri.query contains "union select")
or (http.request.uri.query contains "<script")
or (http.request.uri.path contains "/wp-admin")
or (http.request.uri.path contains "/.env")
```

**Action:** Block

### 3) Rate limit OTP at the edge (optional)

**Matching:**

```txt
(http.request.uri.path eq "/api/auth/send-otp" and http.request.method eq "POST")
```

Prefer a **Rate limiting** rule (e.g. 20 / 10 minutes per IP), not Managed Challenge, once API skip is active.

## Security → Bots

- Prefer **Bot Fight Mode: Off** on `api.moneycash.in`, or only challenge HTML page traffic — never XHR/API.
- Do not leave the zone in permanent “I’m Under Attack” mode.

## Verify

1. From the customer server: `curl -sI -X POST "$API_SERVER_URL/auth/send-otp" -H 'Content-Type: application/json'` → JSON from Nest, **not** `Just a moment…`.
2. Browser DevTools → Get OTP → response is JSON (2xx/4xx), never HTML challenge.
3. If the proxy still sees a challenge, the customer app returns JSON `{ "code": "EDGE_CHALLENGE" }` (see `api-proxy.ts`).

## App-layer WAF (Nest)

| Env | Meaning |
|-----|---------|
| `WAF_ENABLED=true` | Nest middleware on (default) |
| `WAF_MODE=block` | Reject with JSON `{ code: "WAF_BLOCKED" }` |
| `WAF_MODE=log` | Log hits only |

Start with `WAF_MODE=log`, then switch to `block`.
