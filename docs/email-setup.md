---
title: "Email + Webhook Setup (Resend & Cloudflare Tunnel)"
description: "Step-by-step: how the email pipeline works, setting up Resend (API key, verified domain, env vars), and exposing the delivery webhook locally with cloudflared."
order: 17
author: "Acme Inc."
lastUpdated: 1786406400000
coverImage: "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1600&q=80"
---

# Email + Webhook Setup (Resend & Cloudflare Tunnel)

> [!NOTE] This guide is the **operational** half of the email system. It assumes you already
> understand the code — read [Email Template System](./email.md) first for the architecture
> (base template, registry, sender service, log, preview page). Here we answer the three
> questions every dev hits:
>
> 1. **How does an email actually travel through the app?** (the pipeline)
> 2. **How do I set up Resend?** (API key + verified domain + env vars)
> 3. **How do I get delivery webhooks locally?** (cloudflared tunnel + signature verification)
>
> Written so a junior with ~6 months of experience can go from zero to a real send + a
> verified webhook without guessing.

---

## 1. How the pipeline works (the 30-second version)

```
Auth flow (e.g. signup, password reset)
        │
        ▼
apps/api/src/modules/auth/services/email.service.ts   ← facade for auth flows
        │  constructs a template with REAL props
        ▼
apps/api/src/modules/notifications/email/templates/*.template.ts
        │  pure renderers: key, subject, accent, renderBodyHtml(), renderBodyText()
        ▼
apps/api/src/modules/notifications/email/email-sender.service.ts
        │  EmailSenderService.send(template)
        │    1. re-validates props with zod
        │    2. resolves effective recipient (EMAIL_TEST_TO override wins)
        │    3. EMAIL_MODE switch: send | log-only | noop
        │    4. send → Resend API (retry w/ backoff, timeout, rate limit)
        │    5. persists a row in EmailLog
        ▼
Resend API → recipient inbox
        │
        ▼ (delivery event: delivered / bounced / complained / failed)
POST /notifications/email-webhook   ← public, signature-verified
        │
        ▼
email-log.service.ts  ← flips EmailLog.status

```

**Key contract:** `EmailSenderService.send()` **never throws**. Callers inspect the returned
`EmailSendResult` (`{ ok: true, id } | { ok: false, reason, detail }`) and decide what to
surface. A Resend outage can never break a signup or login.

---

## 2. Part 1 — Set up Resend

### 2.1 Create an account + API key

1. Go to [resend.com](https://resend.com) → **Sign up** (free tier: 3,000 emails/month,
   100/day).
2. After sign-in, open **API Keys** (left sidebar) → **Create API Key**.
3. Give it a name (e.g. `local-dev`), leave permission on **Full access**, copy the key —
   it starts with `re_` and is only shown **once**.
4. Put it in `apps/api/.env`:

```bash
# apps/api/.env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 2.2 Verify a sending domain (mandatory for real sends)

Resend only lets you send **from verified domains**. `noreply@example.com` fails unless you
own `example.com`.

1. **API Keys** → **Domains** → **Add Domain** → enter your domain (e.g. `bishenpatel.com`).
2. Resend shows 3 DNS records (SPF `MX` / DKIM `TXT` / Return-Path `TXT` or `CNAME`).
   Add **all three** at your DNS provider (Namecheap, Cloudflare, GoDaddy…).
3. Back in Resend, click **Verify**. Status flips to **Verified** — usually within minutes
   (DNS propagation can take up to 24h, but typically < 5 min).
4. Set the from-address in `apps/api/.env`:

```bash
# apps/api/.env
EMAIL_FROM_ADDRESS="Acme Inc <noreply@bishenpatel.com>"
APP_NAME="Acme Inc"
APP_URL=http://localhost:3000
```

> [!TIP] The `EMAIL_FROM_ADDRESS` format `"Name <address>"` is what Resend shows as the
> sender. If you only have one domain verified, keep the `noreply@` prefix — Resend rejects
> from-addresses on unverified domains with `invalid_from_address`.

### 2.3 The full env-var reference

All of these live in `apps/api/.env` and are read through `TypedConfigService`:

| Variable                        | Default               | Meaning                                                                                                                         |
| ------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `RESEND_API_KEY`                | `""`                  | Resend API key (`re_…`). Empty key ⇒ sends fail with `missing_api_key`.                                                         |
| `EMAIL_FROM_ADDRESS`            | `noreply@example.com` | Sender. Must use a **verified** domain.                                                                                         |
| `EMAIL_MODE`                    | `send`                | `send` (real) · `log-only` (print body, no network) · `noop` (skip entirely).                                                   |
| `EMAIL_TEST_TO`                 | unset                 | **Dev override** — every send redirects here (never spams real recipients).                                                     |
| `EMAIL_REPLY_TO`                | unset                 | `replyTo` on every email.                                                                                                       |
| `EMAIL_MAX_ATTEMPTS`            | `3`                   | Send attempts incl. first try; jittered exponential backoff.                                                                    |
| `EMAIL_TIMEOUT_MS`              | `10000`               | Per-attempt timeout; a hung Resend call is cut.                                                                                 |
| `EMAIL_RATE_LIMIT_PER_MINUTE`   | `0`                   | Per-recipient sends/min; `0` disables.                                                                                          |
| `RESEND_WEBHOOK_SECRET`         | `""`                  | Required for delivery webhooks (Part 2).                                                                                        |
| `WEBHOOK_RATE_LIMIT_PER_MINUTE` | `120`                 | Per-IP cap on the **public** `POST /notifications/email-webhook` route (fixed window / min). `0` disables the limiter entirely. |

### 2.4 Send your first email — the admin "Send test email" button

The fastest way to prove the config is a real send without triggering an auth flow:

1. Start the stack (`apps/api` on `:8080`, `apps/admin` on `:3001`).
2. Open the admin panel → **Settings → Email Templates** (`http://localhost:3001/emails`).
3. Pick any template → click **Send test email**.
   - It fires `POST /notifications/email-preview/:key/send`, which builds the template with
     **sample props** and routes it through `EmailSenderService` — the exact same path auth
     flows use.
   - In dev, set `EMAIL_TEST_TO=you@gmail.com` in `.env` so the sample recipient is
     replaced with your own inbox.
4. A toast shows the outcome: `Sent! Resend id <id>` (or the failure reason).
5. The row lands in **Settings → Email Log** (`/email-log`) with a `sent` badge.

> [!NOTE] Why the button is safe: it only ever sends **sample** props, never real user data,
> and with `EMAIL_TEST_TO` set it can only reach _your_ inbox.

---

## 3. Part 2 — Delivery webhooks (status tracking)

Webhooks tell your app what happened _after_ the send: delivered, bounced, complained,
failed. Without them, a password-reset email that bounced silently is a support ticket.

### 3.1 Which events matter

| Event                                                                           | Meaning                   | EmailLog effect                                                                                                        |
| ------------------------------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `email.sent`                                                                    | Accepted by Resend        | `sent` (default row)                                                                                                   |
| `email.delivered`                                                               | Reached the inbox         | `delivered`                                                                                                            |
| `email.bounced`                                                                 | Hard bounce (bad address) | `bounced` + the bounce type/reason in `error`                                                                          |
| `email.complained`                                                              | Recipient marked spam     | `complained` + the complaint reason in `error`                                                                         |
| `email.failed`                                                                  | Permanent failure         | `failed`                                                                                                               |
| `email.opened` / `email.clicked` / `email.forwarded` / `email.delivery_delayed` | Tracking / informational  | **Acknowledged and ignored** — open/click tracking was removed from the system; the log records delivery outcomes only |

> [!IMPORTANT] **Open/click tracking was removed from the system.** The webhook still
> receives `email.opened` / `email.clicked` events (they're part of Resend's event stream),
> but the controller acknowledges and ignores them — the log records delivery outcomes only
> (`sent` → `delivered` / `bounced` / `complained` / `failed`). You can untick
> Opened/Clicked in Resend → Webhooks and disable Open/Click tracking on the domain
> (Domains → Tracking); delivery events keep working either way.
>
> **The admin log is live.** Every write (a new send, a delivery webhook flip) pushes an
> SSE frame down `GET /notifications/email-log/events`, and the `/email-log` page refetches
> instantly — status flips appear the moment the event lands, no polling, no refresh. (See
> [Email Template System → Live updates (SSE)](./email.md) for the wiring.)

### 3.2 Create the webhook in Resend

1. Resend dashboard → **Webhooks** → **Add Webhook**.
2. **Events:** tick Sent, Delivered, Delivery Delayed, Bounced, Complained, Failed. (Opened and
   Clicked are optional — if ticked, the controller acknowledges and ignores them, since open/click
   tracking was removed from the system.)
3. **URL:** your public endpoint (see Part 3 for the tunnel).
4. Save — Resend shows a **Signing secret** (`whsec_…`). Copy it into `apps/api/.env`:

```bash
# apps/api/.env
RESEND_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxx
```

> [!IMPORTANT] Three rules that prevent every webhook 403 we've ever seen:
>
> 1. **The signing secret is per-webhook and shown once.** Copy it into `.env` the moment
>    the webhook is created. If you ever **delete and recreate** the webhook (common when
>    the tunnel URL changes — see 4.2), Resend generates a **new** secret — the old one in
>    `.env` goes stale and every real delivery fails verification with `403 Invalid
webhook signature (No matching signature found)`, even though emails still send fine.
> 2. **`.env` changes need an API restart.** Env vars are read once at boot — `nest start
--watch` hot-reloads source files but NOT `.env`. After editing
>    `RESEND_WEBHOOK_SECRET`, restart the API (`Ctrl+C`, then `pnpm run dev` again), or
>    the old secret stays loaded in the running process.
> 3. **Keep exactly ONE uncommented `RESEND_WEBHOOK_SECRET=` line.** Delete stale
>    duplicates (including commented-out ones with corrupted values like a doubled
>    `whsec_whsec_` prefix) so a wrong value is never pasted by accident.

### 3.3 How signature verification works (why it's safe to expose)

The endpoint `POST /notifications/email-webhook` is `@Public()` — anyone can reach it. What
keeps it safe is **verification**:

- Resend signs every payload with HMAC-SHA256 using your `whsec_…` secret. The signing
  scheme is **standard-webhooks**: the secret is base64-decoded (after stripping the
  `whsec_` prefix) and the HMAC is computed over `<msgId>.<timestamp>.<rawBody>`.
- Resend's webhook delivery runs on **Svix** infrastructure, so the signature headers
  arrive as **`svix-id` / `svix-timestamp` / `svix-signature`** — NOT the
  `webhook-*` names shown in most docs. The controller reads **both** naming schemes
  (a genuine delivery is accepted under either), then hands the canonical
  `{ id, timestamp, signature }` to `resend.webhooks.verify(...)`.
- The controller verifies via `resend.webhooks.verify(...)` (the `resend` SDK wraps
  `standardwebhooks`). Wrong or missing signature ⇒ **403**, and the payload is rejected
  _before_ any DB write.
- You can prove it locally (Part 4.4) — a tampered signature is rejected even though the
  route is public.
- **The route is rate-limited per IP as defense-in-depth** (`WEBHOOK_RATE_LIMIT_PER_MINUTE`,
  default `120`/min, fixed window via `@nestjs/throttler`). Every request costs signature
  work + a log line, so even though the trust boundary is the HMAC signature, a client
  (attacker or a misbehaving script) can't hammer the endpoint. The IP is resolved from
  `cf-connecting-ip` (set by Cloudflare's edge, unspoofable through the tunnel), falling
  back to the first `x-forwarded-for` hop, then the socket address. **Important:** a request
  that fails signature verification still **counts against the limit** (the guard runs before
  the handler), so brute-forcing is throttled too. Over-limit requests get `429 Too Many
Requests`. Set `0` to disable (empty throttlers = guard passes everything).
- **Events for emails this system never sent are never written.** A signed event whose
  `email_id` doesn't match a row in `EmailLog` is acknowledged (`200`, so Resend stops
  retrying) but **no row is created or updated** — a spoofed event, or one for an email
  sent from the Resend dashboard / another app on the same account, cannot inject fake
  history. (Logged as `Webhook for unknown resend_id …`.)
- **Statuses only move forward.** The webhook is monotonic: `sent → delivered → bounced /
complained / failed`, and re-applying the same status is idempotent. Two safe
  exceptions: `delivered` may override a `bounced` row (Resend retries **soft** bounces
  and emits `delivered` when a later attempt succeeds — the row must reflect the eventual
  outcome), while `sent` can **never** override anything. A replayed or out-of-order event
  (e.g. an `email.sent` arriving after the row was `delivered`) is ignored — a captured,
  still-valid webhook can never downgrade a row. (Logged as
  `Webhook ignored: … would regress status`.)

> [!WARNING] **The `svix-*` vs `webhook-*` gotcha.** A real Resend delivery arrives with a
> `User-Agent: Svix-Webhooks/rolling` and the `svix-*` header names. If you ever see
> `403 Missing webhook signature header(s)` in the Resend dashboard or in the API log
> (`Webhook rejected: missing signature header(s) ... UA=Svix-Webhooks/rolling`) while
> your **local** signed test passes, the running controller is an older build that only
> looked for `webhook-*`. Restart the API so the dual-scheme fix is live — genuine
> deliveries are then accepted (200).

---

## 4. Part 3 — cloudflared: expose your local API to the internet

The API runs on `localhost:8080`, which Resend can't reach. **cloudflared** (Cloudflare's
tunnel client) gives you a public `https://<random>.trycloudflare.com` URL that forwards to
your localhost — no router config, no public IP, no domain.

### 4.1 Install

```bash
# macOS (Homebrew)
brew install cloudflared

# Linux (Debian/Ubuntu) — or download from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
sudo apt-get update && sudo apt-get install -y cloudflared

# Windows (winget)
winget install --id Cloudflare.cloudflared
```

Verify: `cloudflared --version`.

### 4.2 Quick tunnel (one-liner)

```bash
cloudflared tunnel --url http://localhost:8080 --protocol http2 --region us
```

- `--protocol http2` — avoids some flaky HTTP/1.1 routing on free tunnels.
- `--region us` — pins the edge region (a different region was producing 530s on this
  machine).
- Output prints a URL like `https://hudson-browsers-deal-group.trycloudflare.com`. **This
  URL is your webhook URL** — add `/notifications/email-webhook` to it in Resend:
  `https://<random>.trycloudflare.com/notifications/email-webhook`.

> [!WARNING] Quick tunnels are **ephemeral**. Restarting cloudflared (or your machine)
> changes the URL, which silently breaks the webhook until you update it in Resend. Worse:
> if you **recreate** the webhook to change the URL, Resend **regenerates the signing
> secret** too — so `RESEND_WEBHOOK_SECRET` in `.env` goes stale at the same time (symptom:
> emails still send, but every delivery 403s with `Invalid webhook signature`). After any
> restart, re-sync **BOTH** the URL and the signing secret in Resend → Webhooks (see 3.2),
> then restart the API. This repo's dev setup avoids all of this with a **named tunnel**
> (4.3) — the URL never changes, so no re-pointing or secret rotation is ever needed.
> The `start-tunnel.py` quick-tunnel script (4.3.1) is the fallback; it re-points the
> Resend webhook automatically and preserves the signing secret.

### 4.3 Named tunnel (recommended) — the stable webhook URL

**This repo's dev setup now uses a named Cloudflare tunnel, so the webhook URL NEVER
changes.** No re-pointing after restarts, no dead-URL 403s, no `[Admin] Webhook delivery
failing` emails — the `start-tunnel.py` quick-tunnel flow (4.3.1) exists only as a
fallback.

**Stable endpoint:** `https://webhooks.bishenpatel.com/notifications/email-webhook`

#### One-time setup (already done on this machine, 2026-08-12)

```bash
cloudflared tunnel login                                  # browser OAuth → ~/.cloudflared/cert.pem
cloudflared tunnel create email-webhook                   # → tunnel id 16d038ce-f7eb-4b80-b220-a402338784f7
cloudflared tunnel route dns email-webhook webhooks.bishenpatel.com   # CNAME → <tunnel-id>.cfargotunnel.com
```

> [!NOTE] `cloudflared tunnel login` is interactive — it opens a browser. Pick the
> Cloudflare account that **owns `bishenpatel.com`** (the zone must be on Cloudflare) and
> click Allow. It writes `~/.cloudflared/cert.pem` once.

#### Config

The tunnel config is versioned in the repo at
**`apps/api/scripts/cloudflared-email-webhook.yml`** and installed to
`~/.cloudflared/config.yml` (cloudflared's default lookup path, so a bare
`cloudflared tunnel run email-webhook` finds it):

```yaml
tunnel: 16d038ce-f7eb-4b80-b220-a402338784f7
credentials-file: /Users/patel/.cloudflared/16d038ce-f7eb-4b80-b220-a402338784f7.json
no-autoupdate: true
protocol: http2
region: us

ingress:
  - hostname: webhooks.bishenpatel.com
    service: http://localhost:8080
  - service: http_status:404 # catch-all: everything else → 404
```

#### Run it

Foreground (easy to watch logs):

```bash
cloudflared tunnel run email-webhook
```

Or detached (survives the terminal closing) with the same double-fork pattern the
quick-tunnel script uses:

```bash
python3 - <<'EOF'
import os, subprocess, sys
pid = os.fork()
if pid > 0: sys.exit(0)
os.setsid()
pid2 = os.fork()
if pid2 > 0: os._exit(0)
with open('/tmp/cloudflared-named.log', 'w') as f:
    subprocess.Popen(['cloudflared', 'tunnel', 'run', 'email-webhook'], stdout=f, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL, start_new_session=True)
os._exit(0)
EOF
```

#### Survive reboots (optional but recommended)

Install cloudflared as a macOS LaunchDaemon so the tunnel starts at boot and reconnects
automatically — the URL still never changes:

```bash
sudo cp ~/.cloudflared/config.yml /etc/cloudflared/config.yml   # the daemon reads this path
sudo cloudflared service install
sudo launchctl start com.cloudflare.cloudflared
```

#### Verify

```bash
curl -s -o /dev/null -w '%{http_code}' https://webhooks.bishenpatel.com/notifications/email-webhook  # 200
cloudflared tunnel list    # email-webhook shows connections
```

---

### 4.3.1 Fallback: quick tunnel via `start-tunnel.py`

A quick tunnel dies the moment the terminal that launched it closes. Plain `nohup … &`
is **not** reliable — the launching shell can still reap the child (and macOS has no
`setsid` command at all), which silently kills the tunnel mid-session. The repo ships a
daemonizer that is immune to this: **`apps/api/scripts/start-tunnel.py`**.

It uses the classic **double-fork** trick (`os.setsid()` + a second fork), so cloudflared
runs in a brand-new session and keeps running long after the shell that started it exits.

#### Prerequisites

- `cloudflared` installed — verify with `cloudflared --version` (see 4.1).
- (for webhooks) the API running on `localhost:8080` — `curl -s localhost:8080/health`
  returns `200`. The tunnel can start without it, but the URL will serve `530` until it's up.

#### Start the tunnel (run from the repo root)

```bash
python3 apps/api/scripts/start-tunnel.py
```

It launches cloudflared detached, waits up to **30 seconds** for the URL to register, then
prints:

```
Tunnel URL: https://<random>.trycloudflare.com
Webhook URL: https://<random>.trycloudflare.com/notifications/email-webhook
Resend webhook re-pointed → https://<random>.trycloudflare.com/notifications/email-webhook
```

Exit code `0` = tunnel is up. Exit code `1` = no URL within 30s (read
`/tmp/cloudflared.log` for why).

#### Auto-wiring — the fresh URL is propagated automatically

Every quick-tunnel URL dies on the next restart, which used to silently break the webhook
until you manually updated it in the Resend dashboard. `start-tunnel.py` now **auto-wires**
the fresh URL the moment it registers:

- **The Resend webhook endpoint is re-pointed via the Resend API** — the script reads
  `RESEND_API_KEY` from `apps/api/.env` and `PATCH`es the existing webhook (it never
  deletes/recreates it, so **the signing secret is preserved** and
  `RESEND_WEBHOOK_SECRET` stays valid). Look for the `Resend webhook re-pointed → …`
  line in the output.

> [!WARNING] **Resend's update-webhook API field is `endpoint`, NOT `url`.** Sending
> `{"url": …}` returns `2xx` but is **silently ignored** — the endpoint never changes
> (verified 2026-08-12; the create API rejects `url` with a 422, and the update API
> accepts it but does nothing). `start-tunnel.py` sends the correct `endpoint` field.
> If you ever hand-PATCH via curl, use `endpoint` too — otherwise you'll _think_ the
> re-point worked while Resend keeps posting to the old URL.

The step is **non-fatal**: if the API key is missing or Resend is unreachable, the script
prints the exact URL to paste manually and the tunnel still starts.

#### What it runs under the hood

```bash
cloudflared tunnel --url http://localhost:8080 --no-autoupdate \
  --protocol http2 --region us --logfile /tmp/cloudflared.log
```

- `--protocol http2` — avoids some flaky HTTP/1.1 routing on free tunnels.
- `--region us` — pins the edge region (a different region produced 530s on this machine).
- `--logfile /tmp/cloudflared.log` — all tunnel logs land here, including the URL.

#### Verify it's running / find the current URL anytime

```bash
pgrep -fl cloudflared                 # process is alive

# current URL (last one in the log):
grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cloudflared.log | tail -1
```

#### Stop the tunnel

```bash
pkill -f 'cloudflared tunnel'         # or: kill <pid from pgrep -fl cloudflared>
```

#### Restart (now mostly automatic)

> [!IMPORTANT] After any tunnel restart, `start-tunnel.py` re-points the Resend webhook
> **automatically** — and because it `PATCH`es the existing webhook (rather than
> recreating it), the **signing secret never changes**, so `RESEND_WEBHOOK_SECRET` stays
> valid across restarts.
>
> Two cases still need a manual step:
>
> 1. The script printed `WARN: RESEND_API_KEY not found …` or
>    `WARN: could not update Resend webhook …` — paste the printed **Webhook URL** into
>    **Resend → Webhooks** (edit the existing webhook) and save.
> 2. You ever **delete** the webhook and recreate it manually — Resend issues a **new
>    signing secret**. Copy it into `apps/api/.env` as `RESEND_WEBHOOK_SECRET` (one line
>    only) and **restart the API** (env vars load at boot, see 3.2).
>
> Verify with Resend's **Send test event** → expect `200`.

#### Troubleshooting

| Symptom                                         | Cause / fix                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `python3: can't open file '...start-tunnel.py'` | Wrong path — run from the **repo root**: `python3 apps/api/scripts/start-tunnel.py`.                                                                                                                                                                                                                                               |
| `cloudflared: command not found`                | cloudflared not installed (4.1) or not on `PATH`.                                                                                                                                                                                                                                                                                  |
| Prints `no URL registered within 30s`           | cloudflared can't reach Cloudflare's edge (offline / VPN / region). Read `/tmp/cloudflared.log` for the reason, then re-run.                                                                                                                                                                                                       |
| Tunnel up but `/health` returns `530`           | The API on `:8080` isn't running — start `apps/api`, then re-test.                                                                                                                                                                                                                                                                 |
| Old URL stops working after a restart           | Expected — quick tunnels are ephemeral. Grab the new URL and update Resend (see above).                                                                                                                                                                                                                                            |
| `429 Too Many Requests` from the webhook        | `WEBHOOK_RATE_LIMIT_PER_MINUTE` exceeded for your IP (delivery bursts + your manual tests can share a bucket). Wait ~1 min or raise the value (e.g. `600`), then restart the API. **Note:** Resend/Svix treats `429` like a terminal failure (no auto-retry) — if a delivery was dropped, re-trigger it from the Resend dashboard. |

### 4.4 Test the webhook end-to-end (sign → 200, tamper → 403)

A quick way to prove signature verification without waiting for a real delivery event —
sign the payload locally the way `standardwebhooks` does:

```js
// test-webhook-sig.mjs  (run with: node test-webhook-sig.mjs)
import { createHmac, timingSafeEqual } from "node:crypto";

const SECRET = "whsec_xxxxxxxxxxxxxxxx"; // your RESEND_WEBHOOK_SECRET
const URL = "https://<random>.trycloudflare.com/notifications/email-webhook";
const msgId = "msg_1";
const timestamp = String(Math.floor(Date.now() / 1000));
const payload = JSON.stringify({
	type: "email.delivered",
	data: { email_id: "e5e8d669-9ef0-44de-98f9-4097dcab36d8" },
});

// standard-webhooks scheme: base64-decode the part AFTER "whsec_", then
// HMAC-SHA256 over "<msgId>.<timestamp>.<payload>"
const key = Buffer.from(SECRET.replace(/^whsec_/, ""), "base64");
const signedContent = `${msgId}.${timestamp}.${payload}`;
const signature = createHmac("sha256", key).update(signedContent).digest("base64");

const res = await fetch(URL, {
	method: "POST",
	headers: {
		"content-type": "application/json",
		"webhook-id": msgId,
		"webhook-timestamp": timestamp,
		"webhook-signature": `v1,${signature}`,
	},
	body: payload,
});
console.log("signed request   →", res.status); // expect 200

// Now tamper: flip a character in the payload but keep the old signature.
const tampered = JSON.stringify({
	type: "email.delivered",
	data: { email_id: "deadbeef-0000-0000-0000-000000000000" },
});
const res2 = await fetch(URL, {
	method: "POST",
	headers: {
		"content-type": "application/json",
		"webhook-id": msgId,
		"webhook-timestamp": timestamp,
		"webhook-signature": `v1,${signature}`,
	},
	body: tampered,
});
console.log("tampered request →", res2.status); // expect 403
```

**Expected output:** `signed request   → 200` and `tampered request → 403`. That proves the
endpoint is reachable _and_ that only Resend-signed payloads are accepted.

> [!IMPORTANT] The signature is **byte-exact** and **time-limited** — this trips up
> everyone who tries Swagger's "Try it out":
>
> 1. **The HMAC covers the RAW body bytes.** If the body in your request differs from
>    the one the script signed — Swagger pretty-prints the example, your editor adds a
>    trailing newline, you reformat the JSON — verification fails with `403 Invalid
webhook signature`. Paste the body **exactly as the script printed it** (single
>    line, no changes), or use the `curl` one-liner the script also prints.
> 2. **The timestamp expires after 5 minutes** (standard-webhooks tolerance). Generate
>    the values and paste them into Swagger within 5 minutes, or re-run the script.
> 3. **Send `content-type: application/json`** on manual tests. Without it the body
>    parser never captures the raw bytes, so the controller verifies `{}` instead of
>    your payload and every signed request 403s. Swagger adds this header
>    automatically; only curl/Postman tests can forget it.
>
> The endpoint's 403 now names the exact cause (`No matching signature found` vs
> `Message timestamp too old`) so you know which mistake to fix.

### 4.5 Production: named tunnel or deployed API

> [!NOTE] **Option B below is exactly what this repo already runs locally (4.3)** —
> `webhooks.bishenpatel.com` is live today via the `email-webhook` named tunnel. For a
> production deploy, the same setup moves to the server or you skip tunnels entirely
> with Option A.

For anything real, don't use a quick tunnel:

- **Option A — deployed API:** put the API behind a real domain (Vercel/Railway/Fly/etc.)
  and register `https://api.yourdomain.com/notifications/email-webhook` in Resend. No
  tunnel at all.
- **Option B — named tunnel (stable URL):**
  1. `cloudflared tunnel login` → pick your zone.
  2. `cloudflared tunnel create email-webhook` → gives a persistent tunnel ID.
  3. Add a DNS `CNAME` (`webhooks.yourdomain.com` → `<tunnel-id>.cfargotunnel.com`).
  4. Run with a config file pointing `service: http://localhost:8080` and the ingress rule
     `{ hostname: "webhooks.yourdomain.com", service: "http://localhost:8080" }`.
     The URL never changes, so Resend's webhook config stays valid across restarts.

---

## 5. End-to-end verification checklist

After setup, run through this in order — each step builds on the last:

| #   | Check                    | Command / action                                                                                                                  | Passes when                                            |
| --- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 1   | API is up                | `curl -s -o /dev/null -w '%{http_code}' localhost:8080/health`                                                                    | `200`                                                  |
| 2   | Key loaded               | `grep RESEND_API_KEY apps/api/.env`                                                                                               | starts with `re_`                                      |
| 3   | Domain verified          | Resend dashboard → Domains                                                                                                        | status **Verified**                                    |
| 4   | Real send                | Admin → Email Templates → Send test email                                                                                         | toast shows a Resend id                                |
| 5   | Log row                  | Admin → Email Log                                                                                                                 | row with `sent` badge + Resend id                      |
| 6   | Tunnel up                | `cloudflared tunnel list` + `curl -s -o /dev/null -w '%{http_code}' https://webhooks.bishenpatel.com/notifications/email-webhook` | `email-webhook` shows connections, curl → `200`        |
| 7   | Webhook reachable        | run `test-webhook-sig.mjs`                                                                                                        | `200` signed / `403` tampered                          |
| 8   | Live event flips status  | send to a bad address (e.g. `bounce@resend.dev`), wait ~1 min                                                                     | EmailLog flips to `bounced` with the reason in `error` |
| 9   | Resend delivery accepted | Resend → Webhooks → **Send test event**                                                                                           | the attempt shows **`200`** (not `403`)                |

> [!NOTE] Open/click tracking is **not** part of this checklist — it was deliberately removed
> from the system. No pixels, no `opened_at`/`clicked_at` columns, no engagement UI. The log
> records delivery outcomes only (`sent` → `delivered` / `bounced` / `complained` / `failed`).

> [!TIP] `bounce@resend.dev` and `delivered@resend.dev` are Resend's built-in test
> addresses — they trigger hard bounces / successful deliveries without a real mailbox, so
> they're perfect for validating step 8.

---

## 6. Troubleshooting

| Symptom                                                                                                                                    | Cause                                                                                                                                                                                                                                                                                                                        | Fix                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `missing_api_key` / sends fail immediately                                                                                                 | `RESEND_API_KEY` empty or malformed (e.g. a bare `  =re_…` with no `RESEND_API_KEY=` prefix)                                                                                                                                                                                                                                 | Fix the line to `RESEND_API_KEY=re_…` (no leading spaces), restart the API.                                                                                                                                                                                                                                                                                                                                                                                                   |
| `invalid_from_address`                                                                                                                     | `EMAIL_FROM_ADDRESS` domain not verified in Resend                                                                                                                                                                                                                                                                           | Verify the domain (2.2) or use the verified domain's `noreply@`.                                                                                                                                                                                                                                                                                                                                                                                                              |
| `EADDRINUSE: :::8080`                                                                                                                      | A previous API process is still running (incl. an orphaned `nest start --watch` daemon that respawns the app)                                                                                                                                                                                                                | `pnpm kill:port` (kills whatever holds 8080), then re-run `pnpm run dev`. Check `lsof -nP -i :8080 -sTCP:LISTEN` if it recurs — kill the whole process tree, not just the child.                                                                                                                                                                                                                                                                                              |
| Webhook URL stops working                                                                                                                  | Named tunnel not running, or the API on `:8080` is down                                                                                                                                                                                                                                                                      | Start it with `cloudflared tunnel run email-webhook` (4.3) — the URL never changes, so no re-pointing is ever needed. Check `cloudflared tunnel list` shows connections.                                                                                                                                                                                                                                                                                                      |
| Opening the webhook URL in a browser returns `404 Cannot GET /notifications/email-webhook`                                                 | The browser sends a **GET**, but the endpoint only serves **POST** (Resend's delivery method) — so there's no GET route                                                                                                                                                                                                      | Expected. A GET now returns a friendly JSON note explaining the endpoint is POST-only. Real webhooks (POST) work fine — verify with 4.4 or by sending a real email.                                                                                                                                                                                                                                                                                                           |
| Webhook returns `403 Missing webhook signature header(s)`                                                                                  | (a) A manual test (browser/curl/Postman/Swagger) that sent no signed headers, or (b) the request is a **genuine Resend delivery** arriving with the **`svix-*`** header names (`svix-id`/`svix-timestamp`/`svix-signature` — Resend runs on Svix) while the running controller is an older build that only reads `webhook-*` | Real Resend deliveries are logged with `UA=Svix-Webhooks/rolling` and the controller now accepts **both** naming schemes — if the API log shows that UA alongside `missing signature header(s)`, restart the API (the dual-scheme fix hot-reloads via `nest start --watch`, so a plain `pnpm run dev` is enough). For manual tests, sign the payload the standard-webhooks way (see 4.4). Still failing? Check the webhook URL + secret in the Resend dashboard match `.env`. |
| Webhook returns `403 Invalid webhook signature (No matching signature found)`                                                              | Two causes: (a) the body bytes differ from what was signed — usually Swagger pretty-printed the JSON or your editor added whitespace; (b) **the signing secret in `.env` doesn't match the current webhook's** — e.g. the webhook was recreated (new URL → new secret) or `.env` changed without an API restart              | (a) Paste the body **byte-exact** as the test script printed it (or use its `curl` one-liner). (b) Copy the `whsec_…` from Resend → Webhooks into `.env` (one line only), then **restart the API** — env vars load at boot. Verify with Resend's **Send test event** → `200`.                                                                                                                                                                                                 |
| Webhook returns `403 Invalid webhook signature (Message timestamp too old)`                                                                | Headers present but the `webhook-timestamp` is older than 5 minutes (standard-webhooks tolerance)                                                                                                                                                                                                                            | You took too long copying values into Swagger. Re-run the script and paste within 5 minutes.                                                                                                                                                                                                                                                                                                                                                                                  |
| Email sent but status stays `sent`                                                                                                         | Webhook events not ticked, URL not registered (named tunnel down or API not running), or every delivery 403s (secret mismatch)                                                                                                                                                                                               | Confirm events + URL + signing secret in Resend → Webhooks (3.2); start the named tunnel (`cloudflared tunnel run email-webhook`, 4.3); test with 4.4.                                                                                                                                                                                                                                                                                                                        |
| Resend dashboard shows **attempting** (or you got the `[Admin] Webhook delivery failing` email) even though the email arrived in the inbox | That **attempting** is **webhook delivery**, not the email — the email is delivered/opened (check Resend → Emails → the row), but Resend is retrying a webhook endpoint that doesn't respond. Emails themselves are unaffected.                                                                                              | Ensure the named tunnel is running (`cloudflared tunnel run email-webhook`, 4.3) and the API is up, then in Resend → Webhooks hit **Send test event** until the attempt shows `200`. With the stable URL this should never recur.                                                                                                                                                                                                                                             |
| Emails arrive but Resend shows `403`                                                                                                       | The webhook URL or signing secret changed after a tunnel restart / webhook recreation                                                                                                                                                                                                                                        | Re-sync BOTH in Resend → Webhooks (3.2) and restart the API.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `rate_limit_exceeded`                                                                                                                      | Exceeded Resend's per-second rate or free-tier day limit                                                                                                                                                                                                                                                                     | Back off, or check `EMAIL_RATE_LIMIT_PER_MINUTE` isn't misconfigured.                                                                                                                                                                                                                                                                                                                                                                                                         |
| Emails going to spam                                                                                                                       | Sender domain not fully verified / DKIM missing                                                                                                                                                                                                                                                                              | Re-check all 3 DNS records (2.2); they can take up to 24h.                                                                                                                                                                                                                                                                                                                                                                                                                    |

---

## 7. Related docs

- **[Email Template System](./email.md)** — the architecture: base template, registry,
  sender service internals, EmailLog, admin preview/log pages, how to add a new email.
- **[Getting Started](./getting-started.md)** — the monorepo env setup + running all apps.
- **[Logging system](./logging.md)** — where send logs land and how to query them.

_Last updated: 2026-08-11._
