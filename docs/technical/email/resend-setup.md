---
title: "Set up email with Resend"
description: "Step by step: Resend account and API key, domain verification, EMAIL_MODE, the delivery webhook (POST /notifications/email-webhook) with RESEND_WEBHOOK_SECRET, exposing it locally, verification and troubleshooting."
order: 45
author: "Platform Team"
lastUpdated: 1791072000000
coverImage: "https://images.unsplash.com/photo-1596526131083-e8c633c948d2?w=1200&h=630&fit=crop"
tags: ["email", "resend", "webhooks", "setup"]
---

# Set up email with Resend

Transactional email (verification, password reset, invites, claim codes, security alerts) is sent
through [Resend](https://resend.com). How the templates and the send pipeline work is in
[Email templates and pipeline](./templates.md).

## 1. Choose the mode

| `EMAIL_MODE` | Behaviour | Use for |
| --- | --- | --- |
| `log-only` (`.env.example` default) | Renders and prints each email to the API log, no network | Local development without a Resend account |
| `noop` | Skips delivery entirely | Fast local runs and tests |
| `send` (schema default) | Delivers through Resend; requires `RESEND_API_KEY` | Staging, production, real local tests |

A **deployed production** API (`NODE_ENV=production` and `APP_URL` not localhost) must use `send`
and must set `RESEND_WEBHOOK_SECRET`; the API refuses to boot otherwise.

## 2. Create an API key

1. Sign up at resend.com → **API Keys** → **Create API key** (sending access is enough).
2. Copy it once (`re_…`) into `apps/api/.env`:

   ```bash
   RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
   ```

## 3. Verify your sending domain

Resend only sends from verified domains.

1. **Domains → Add domain** (use a subdomain such as `mail.example.com` if the root domain already
   sends mail).
2. Add the DNS records Resend shows (SPF, DKIM, and the return-path record) at your DNS provider and
   press **Verify**; usually minutes, up to 24 hours.
3. Set the sender:

   ```bash
   EMAIL_FROM_ADDRESS=noreply@mail.example.com     # must be on the verified domain
   EMAIL_REPLY_TO=support@example.com              # optional
   APP_NAME="Acme Rewards"                         # shown in templates and the 2FA issuer
   EMAIL_MODE=send
   ```

Other knobs (all optional): `EMAIL_MAX_ATTEMPTS` (default 3, jittered backoff),
`EMAIL_TIMEOUT_MS` (10000), `EMAIL_RATE_LIMIT_PER_MINUTE` (per recipient, 0 = off) and, **in
development only**, `EMAIL_TEST_TO=you@example.com`, which redirects every outbound email to one inbox
(rejected on a deployed production environment).

## 4. Send a test email

Restart the API (`.env` is read once at boot), sign in to the admin panel, open **Emails →
Templates**, pick a template and press **Send test email**. It runs the real pipeline
(`POST /api/v1/notifications/email-preview/{key}/send`) with sample props. The result appears in
**Emails → Log** with status `sent`.

## 5. Delivery webhook

The webhook tells the platform what happened after sending, so **Emails → Log** shows `delivered`,
`bounced`, `complained` or `failed`.

1. Resend → **Webhooks → Add webhook**.
2. **Endpoint URL:** `https://<your-api-host>/notifications/email-webhook` — note: **no `/api/v1`
   prefix**. This route is deliberately unversioned so the registered URL never changes.
3. **Events:** `email.sent`, `email.delivered`, `email.bounced`, `email.complained`, `email.failed`
   (opened/clicked/delayed events are acknowledged and ignored — open/click tracking is not used).
4. Copy the **signing secret** (`whsec_…`), shown once:

   ```bash
   RESEND_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxx
   WEBHOOK_RATE_LIMIT_PER_MINUTE=120     # per-IP limit on the webhook (0 = off)
   ```

5. Restart the API.

How the endpoint protects itself:

- It is public but **signature-verified** (standard-webhooks scheme: HMAC-SHA256 over
  `<id>.<timestamp>.<raw body>` with the base64 secret after `whsec_`). Resend sends the
  `svix-id` / `svix-timestamp` / `svix-signature` headers; `webhook-*` names are accepted too. A
  missing or wrong signature answers **403** before anything is written.
- If `RESEND_WEBHOOK_SECRET` or `RESEND_API_KEY` is not configured it answers **503**, so Resend
  retries later instead of the event being lost.
- Events for emails this system did not send are acknowledged and ignored; statuses only move
  forward (a late `email.sent` never downgrades a `delivered` row).
- `GET /notifications/email-webhook` returns a short explanation (handy for tunnel health checks).

Sample request and response: [Email API reference](../api-reference/email.md#email-webhook).

### Receiving webhooks on your laptop

Resend must reach your API over HTTPS. Use a tunnel, for example Cloudflare's:

```bash
cloudflared tunnel --url http://localhost:8080      # prints https://<random>.trycloudflare.com
```

Register `https://<random>.trycloudflare.com/notifications/email-webhook` in Resend and set
`TRUST_PROXY=loopback` so the per-IP limit sees the real client IP. A quick tunnel URL changes every
run: recreating the webhook in Resend issues a **new** signing secret — update `.env` and restart.
For a stable URL create a named Cloudflare tunnel.

To test the signature without Resend: `pnpm --filter @workspace/api exec tsx scripts/test-webhook-signature.ts`
prints signed headers and a body (they expire after 5 minutes; send the body byte-for-byte).

## Verify end to end

1. `EMAIL_MODE=send`, webhook configured, API restarted.
2. Trigger a real email (forgot password for your own account, or **Send test email** without
   `EMAIL_TEST_TO`).
3. **Emails → Log** shows the row as `sent`, then `delivered` within seconds (live, over SSE).

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| API exits: `RESEND_API_KEY is required when EMAIL_MODE=send` | Set the key, or use `EMAIL_MODE=log-only` locally. |
| Resend error `invalid_from_address` / domain not verified | `EMAIL_FROM_ADDRESS` must be on a verified domain. |
| Webhook `403 Invalid webhook signature` | Secret in `.env` is stale (webhook recreated) or the API was not restarted. Keep exactly one `RESEND_WEBHOOK_SECRET=` line. |
| Webhook `403 Missing webhook signature header(s)` | The request did not come from Resend (e.g. Swagger "Try it out"). Expected. |
| Webhook `503` | `RESEND_WEBHOOK_SECRET` or `RESEND_API_KEY` missing. |
| Webhook `429` | More than `WEBHOOK_RATE_LIMIT_PER_MINUTE` from one IP; behind a proxy set `TRUST_PROXY`. |
| Every email goes to one inbox | `EMAIL_TEST_TO` is set (development override). |
| Nothing arrives, log says `[log-only]` | `EMAIL_MODE` is not `send`. |
