---
title: "Outgoing webhooks"
description: "How a merchant sends their store's events to their own systems: turning webhooks on locally, adding an endpoint in the merchant console, running a receiver that checks the signature, triggering every event type, rotating secrets, retries, redelivery, auto-disable, the payload catalog and troubleshooting."
order: 27
author: "Platform Team"
lastUpdated: 1793836800000
coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&h=630&fit=crop"
tags: ["api", "webhooks", "integrations", "merchant", "guide"]
---

# Outgoing webhooks

A merchant can ask the platform to **call their own server** whenever something happens in their store: a
reward goes live, a customer claims or redeems one, a till checks out a bill, a payment succeeds, fails or is
refunded. Each call is an HTTPS `POST` with a JSON body, signed so the server can prove it came from us.

The design and its reasons are in [ADR 082](../../adr/082-outgoing-webhooks.md). This page is the hands-on guide.

| You want to… | Go to |
|---|---|
| Try it on your machine in ten minutes | [Quick start](#1-quick-start-local) |
| Use the merchant console | [The console](#2-the-merchant-console) |
| Write the receiving server | [Receiving a webhook](#3-receiving-a-webhook) |
| Make each event happen | [Triggering every event](#4-triggering-every-event) |
| Know exactly what is sent | [Payload reference](#5-payload-reference) |
| Understand retries and failures | [Delivery, retries and auto-disable](#6-delivery-retries-and-auto-disable) |
| Call the API directly | [The API](#7-the-api) |
| Fix something | [Troubleshooting](#8-troubleshooting) |

> **Phone app:** there are no webhook screens in the Expo app. Webhooks are a business setting, managed in the
> **merchant web console** (which works in a phone's browser too). Anything the phone app does (claiming a reward,
> for example) still *triggers* webhooks, exactly like the web app does.

---

## 1. Quick start (local)

### 1.1 Turn outgoing webhooks on

Two settings in `apps/api/.env`:

| Variable | Value | Why |
|---|---|---|
| `WEBHOOK_SECRET_ENCRYPTION_KEYS` | `pnpm tools secrets:generate` fills it, or `'{"1":"<openssl rand -base64 32>"}'` | Signing secrets are stored encrypted with this key ring. **Without it webhooks are off**: adding an endpoint answers `503 WEBHOOKS_NOT_CONFIGURED`, and the seed skips the demo endpoints |
| `WEBHOOK_ALLOW_LOOPBACK_URLS` | `true` | Lets an endpoint be `http://localhost:…`, so you can receive on your own machine. Refused when `NODE_ENV=production` |

Restart the API after changing them. To have the demo endpoints and delivery log too, re-seed (`pnpm db:seed`):
the seed seals their secrets with the same key ring.

### 1.2 Run a receiver

Save this as `receiver.mjs` anywhere (it needs only Node, no packages) and run
`WEBHOOK_SECRET=whsec_… node receiver.mjs`. You get the secret in step 1.3; start it with any value first and
restart it once you have the real one.

```js
import crypto from "node:crypto";
import http from "node:http";

const SECRET = process.env.WEBHOOK_SECRET ?? "";
const TOLERANCE_SECONDS = 300;

function isSigned(rawBody, header) {
  const parts = header.split(",");
  const t = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!t || Math.abs(Date.now() / 1000 - Number(t)) > TOLERANCE_SECONDS) return false;
  const expected = crypto.createHmac("sha256", SECRET).update(`${t}.${rawBody}`).digest("hex");
  return signatures.some((s) => s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}

http
  .createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const ok = isSigned(body, req.headers["webhook-signature"] ?? "");
      console.log(ok ? "✔ signed" : "✘ BAD SIGNATURE", req.headers["webhook-id"], body);
      res.statusCode = ok ? 200 : 401;
      res.end();
    });
  })
  .listen(4000, () => console.log("Listening on http://localhost:4000/webhooks"));
```

### 1.3 Add the endpoint

1. Start the apps (`pnpm dev`) and open the merchant console: <http://localhost:3003>.
2. Sign in as the demo owner **`brew.owner@kl-rewards.demo` / `BrewOwner@123`** (a one-click button on the login page).
3. In the sidebar: **Operations → Webhooks** (or go to `/t/brew-bean-kl/webhooks`).
4. **Add endpoint** → URL `http://localhost:4000/webhooks`, tick a few events (for example `sale.completed` and
   `payment.succeeded`) → **Add endpoint**.
5. The **signing secret** (`whsec_…`) is shown **once**. Copy it, restart the receiver with
   `WEBHOOK_SECRET=<it>`, then press **I've saved it**.

### 1.4 Send a test

Open the endpoint (click its row) → **Send test event**. Within a second the receiver prints `✔ signed` with a
`webhook.test` body, and the endpoint's **Recent deliveries** shows it as **Delivered**. Stop the receiver and send
another test: it shows **Retrying** with the error, and is tried again later.

---

## 2. The merchant console

Who can use it: members holding **`merchant:manage_webhooks`**. By default that is only the **Owner** role (a
manager or cashier sees "Webhook access required"). An owner can grant it to another role under Settings → Team →
Roles (the capability reads "Send events to the business's own systems").

| Page | What it does |
|---|---|
| **Webhooks** (`/t/<store>/webhooks`) | The endpoints (status, events, failure note), **Add endpoint**, the newest 25 deliveries of all endpoints, and a receiver example to copy |
| **One endpoint** (`/t/<store>/webhooks/<id>`) | Read-only facts (events, `whsec_…` hint, last delivery, when the previous secret stops signing), and the actions: **Send test event**, **Edit**, **Switch off / on**, **Replace signing secret**, **Remove**; its own delivery log with **Send again** |
| **Edit** (`/t/<store>/webhooks/<id>/edit`) | Change the URL, the description or the events. Saving returns to the endpoint |

| Action | What happens |
|---|---|
| Add endpoint | The URL is checked (HTTPS; a public host; no `user:password@`). Up to 10 per business. The secret is shown once |
| Send test event | One `webhook.test` event to **this** endpoint only, sent at once. Refused while it is switched off |
| Switch off | Nothing is sent to it; deliveries still waiting are cancelled. **Switch on** forgets its failure streak |
| Replace signing secret | A new secret, shown once. By default the **old one keeps signing for 24 hours** too (two `v1=` in the header), so you can update your server without missing a delivery. Untick the box if the old secret leaked: it stops at once |
| Send again | Re-sends a delivery that was delivered, gave up or was cancelled, from attempt one, with the **same `Webhook-Id`** |
| Remove | Soft delete: nothing more is sent; its past deliveries stay in the log |

Delivery statuses in the log:

| Status | Meaning |
|---|---|
| Queued | Waiting for its first attempt (or a "Send again") |
| Retrying | The last attempt failed; the next one is scheduled (the row says when) |
| Delivered | Your server answered with a `2xx` |
| Gave up | Every attempt failed (about three hours of retries) |
| Cancelled | The endpoint was switched off or removed before it was sent |

---

## 3. Receiving a webhook

### 3.1 The request

```http
POST /webhooks HTTP/1.1
Content-Type: application/json
User-Agent: Webhooks/1
Webhook-Id: 0193f2c4-…            ← the delivery id: the same on every retry and "Send again"
Webhook-Timestamp: 1793836800     ← unix seconds, the same as the signature's t=
Webhook-Signature: t=1793836800,v1=5f2c…e9a1

{"id":"0193f2c4-…","type":"sale.completed","apiVersion":"2026-11-01","createdAt":1793836799512,"tenantId":"019b…","data":{…}}
```

### 3.2 Checking it, in four rules

1. **Verify the signature on the raw bytes.** Compute `HMAC-SHA256(secret, "<t>.<raw body>")` in hex and compare
   it, in constant time, with **each** `v1=` value (there are two during a secret rotation). Never re-serialise the
   JSON first: one changed space breaks the signature.
2. **Refuse old timestamps.** Reject a `t` more than **300 seconds** from your clock (a replayed request).
3. **Skip repeats.** Delivery is *at least once*: remember each `Webhook-Id` you handled and answer `200` again
   without redoing the work.
4. **Answer fast.** Reply `2xx` within **10 seconds**, then do slow work in the background. Any other answer, a
   redirect, or a timeout counts as a failure and is retried.

The same check in Python (Flask):

```python
import hashlib, hmac, os, time
from flask import Flask, request, abort

SECRET = os.environ["WEBHOOK_SECRET"].encode()
app = Flask(__name__)

@app.post("/webhooks")
def webhooks():
    raw = request.get_data()  # the raw bytes
    parts = request.headers.get("Webhook-Signature", "").split(",")
    t = next((p[2:] for p in parts if p.startswith("t=")), "")
    if not t or abs(time.time() - int(t)) > 300:
        abort(401)
    expected = hmac.new(SECRET, f"{t}.".encode() + raw, hashlib.sha256).hexdigest()
    if not any(hmac.compare_digest(p[3:], expected) for p in parts if p.startswith("v1=")):
        abort(401)
    event = request.get_json()
    print(event["type"], event["data"])
    return "", 200
```

### 3.3 Receiving from a deployed API

A deployed API only calls **public HTTPS** addresses (loopback, private networks, link-local and cloud metadata
addresses are refused, and every address the host resolves to is checked again at connection time). To test a
deployed environment against your laptop, expose the receiver through a tunnel (for example
`cloudflared tunnel --url http://localhost:4000` or `ngrok http 4000`) and register the `https://…` address it gives
you. A public request-inspection site also works, but it shows your events to a third party: use test data only.

---

## 4. Triggering every event

Subscribe a local endpoint to all events, keep the receiver running, then:

| Event | How to make it happen locally |
|---|---|
| `webhook.test` | The endpoint page → **Send test event** |
| `reward.published` (`via: "review"`) | Merchant console → Rewards → create a reward and submit it; admin app (<http://localhost:3001>, `superadmin@example.com` / `SuperAdmin@123`) → approve it in the reward review queue |
| `reward.published` (`via: "schedule"`) | A submitted reward whose review window passes publishes itself (the review timer job) |
| `reward.rejected` | The same review queue → reject it with a reason |
| `claim.created` | Web app (<http://localhost:3000>) or the phone app, signed in as a customer → claim one of Brew & Bean's live rewards |
| `claim.redeemed` and `sale.completed` | Check the claimed reward out at a till: pair a terminal (merchant console → POS terminals) and call `validate` then `checkout` as in the [POS guide](../pos-integration.md) |
| `claim.expired` | A claim left unredeemed past its expiry, when the claims expiry job runs |
| `payment.succeeded` / `payment.failed` | Merchant console → Payments → new payment through the **fake gateway** (needs `PAYMENTS_FAKE_SECRET` in `apps/api/.env`), then play the gateway: send its signed callback with the recipe below |
| `payment.refunded` | A paid payment's page → **Refund** |

The fake gateway's callback (`<payment id>` is the last part of the payment page's URL, `<provider id>` its **Gateway reference**; status `PAID` or `FAILED`):

```bash
BODY='{"id":"<provider id>","reference":"<payment id>","status":"PAID","amount":2500}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$PAYMENTS_FAKE_SECRET" -hex | sed 's/^.* //')
curl -X POST http://localhost:8080/api/v1/payments/callbacks/fake \
  -H "content-type: application/json" -H "x-fake-signature: $SIG" -d "$BODY"
```

`amount` must be the payment's amount in sen, or the callback is ignored (a gateway reporting another amount never
marks a payment paid).

Each event is written **in the same database transaction** as the change it describes, so a change that rolls
back never produces a webhook, and a repeated payment callback (same news) produces nothing new.

---

## 5. Payload reference

Every body is an envelope; `data` depends on `type`. The schemas live in
`packages/shared/src/contexts/webhooks/schemas/outbound-webhook-events.ts` (`WebhookEventEnvelopeSchema`), and every
body is checked against them before it leaves the platform. Bodies **never** contain a customer's or payer's name,
email or phone number.

| Field | Meaning |
|---|---|
| `id` | The event id. Two endpoints (or a redelivery) receiving the same event see the same id |
| `type` | One of the types below |
| `apiVersion` | `2026-11-01`. A breaking payload change gets a new version |
| `createdAt` | When it happened, epoch milliseconds |
| `tenantId` | The business it belongs to |

| `type` | `data` |
|---|---|
| `reward.published` | `rewardId`, `title`, `via` (`"review"` or `"schedule"`) |
| `reward.rejected` | `rewardId`, `title`, `reason` (the reviewer's note) |
| `claim.created`, `claim.redeemed`, `claim.expired` | `claimId`, `rewardId`, `isReferrerCredit` |
| `sale.completed` | `saleId`, `locationId` (or `null`), `terminalId`, `billTotalMinor` (sen), `currency`, `claimIds` |
| `payment.succeeded`, `payment.failed`, `payment.refunded` | `paymentId`, `provider`, `amountMinor`, `currency`, `providerPaymentId` (or `null`), `paidAt` (or `null`) |
| `webhook.test` | `endpointId`, `message` |

Example (`sale.completed`):

```json
{
  "id": "0193f2c4-7e1a-7c55-9d0e-3b9a2f61c001",
  "type": "sale.completed",
  "apiVersion": "2026-11-01",
  "createdAt": 1793836799512,
  "tenantId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
  "data": {
    "saleId": "0193f2c4-7e1a-7c55-9d0e-3b9a2f61c0aa",
    "locationId": "019b76da-a800-701a-abbd-a9a411b6958b",
    "terminalId": "FRONT-COUNTER-01",
    "billTotalMinor": 2850,
    "currency": "MYR",
    "claimIds": ["019b76da-a800-7544-9869-4da94e4d5b08"]
  }
}
```

---

## 6. Delivery, retries and auto-disable

| Step | Behaviour |
|---|---|
| First attempt | Right after the change commits (a sweeper on every API instance picks up anything missed within 30 seconds) |
| Retries | 10 attempts in total: 30 s, 1, 2, 4, 8, 16, 32 minutes, then hourly, each ±20% — about three hours |
| Gave up | After the 10th failure. **Send again** from the log restarts it |
| Auto-disable | After **5 deliveries in a row gave up**, the endpoint turns itself off ("Turned off") and the owners get an in-app notice and an email linking to it. Fix the server, **Switch on**, then **Send again** the deliveries you need |
| Order | Not guaranteed across events. Use each event's `createdAt` |
| Kept for | 30 days, then purged |

---

## 7. The API

Every console action is an endpoint under `/api/v1/tenants/:tenantSlug/webhooks` (Swagger: **Tenant Webhooks**,
<http://localhost:8080/v1/docs>). They need a signed-in member with `merchant:manage_webhooks`; API keys are refused.
The typed client is `api.tenants.webhooks.*` in `@workspace/api-client`.

| Method and path | What it does |
|---|---|
| `GET …/endpoints` | The endpoints (one page; at most 10) |
| `POST …/endpoints` `{ url, description?, eventTypes }` | Register one → `{ endpoint, secret }` (the secret only here) |
| `GET …/endpoints/:endpointId` | One endpoint |
| `PATCH …/endpoints/:endpointId` `{ url?, description?, eventTypes? }` | Change it |
| `DELETE …/endpoints/:endpointId` | Remove it (soft delete) |
| `POST …/endpoints/:endpointId/enable` · `/disable` | Switch on or off |
| `POST …/endpoints/:endpointId/rotate-secret` `{ keepPreviousForHours: 0–72 }` (default 24) | New secret → `{ endpoint, secret }` |
| `POST …/endpoints/:endpointId/test` | Queue a test event → the delivery (`202`) |
| `GET …/deliveries?filter[endpointId][eq]=…&filter[status][in]=DEAD,FAILED` | The delivery log, newest first |
| `POST …/deliveries/:deliveryId/redeliver` | Send a settled delivery again (`202`) |

| Error | Status | When |
|---|---|---|
| `WEBHOOKS_NOT_CONFIGURED` | 503 | `WEBHOOK_SECRET_ENCRYPTION_KEYS` is not set |
| `VALIDATION_ERROR` (`reason: WEBHOOK_ENDPOINT_URL_REFUSED`) | 400 | Not HTTPS, credentials in the URL, or a private/local host |
| `CONFLICT` (`WEBHOOK_ENDPOINT_LIMIT_REACHED`) | 409 | Already 10 endpoints |
| `CONFLICT` (`WEBHOOK_ENDPOINT_NOT_ACTIVE`) | 409 | Test or redeliver to a switched-off endpoint |
| `CONFLICT` (`WEBHOOK_DELIVERY_IN_PROGRESS`) | 409 | Redeliver one still queued or retrying |
| `CONFLICT` (`WEBHOOK_ENDPOINT_CHANGED`) | 409 | Someone else changed the endpoint at the same moment: reload and retry |
| `NOT_FOUND` | 404 | No such endpoint or delivery in this business (another business's is answered the same way) |

---

## 8. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| "Webhooks are not set up on this platform yet" (503) | Set `WEBHOOK_SECRET_ENCRYPTION_KEYS` (§1.1) and restart the API |
| "Enter an http(s) address" / the URL is refused | Locally, set `WEBHOOK_ALLOW_LOOPBACK_URLS=true` for `http://localhost`. `127.0.0.1` is loopback too; a LAN address (`192.168.…`) is always refused |
| Receiver prints `BAD SIGNATURE` | The secret is wrong (it is shown once: rotate to get a new one), or the body was parsed and re-serialised before checking. Check the raw bytes |
| Deliveries show "Retrying" with "No answer within 10000 ms" | The receiver is slow: answer first, work later |
| "HTTP 301/302" in the log | Redirects are not followed. Register the final URL |
| A manager can't see Webhooks | It is owner-only by default; grant "Send events to the business's own systems" to their role |
| The seed printed "outgoing webhooks skipped" | The key ring was not set when you seeded. Set it and re-seed |
| Nothing arrives for a real event | Is the endpoint **On** and subscribed to that type? A test event works but a real one doesn't → check the type in §4 |
