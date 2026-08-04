---
title: "Token Refresh — How It Works"
description: "Why tokens rotate, the two refresh layers (server-side proxy refresh + client-side 401 refresh), how to observe each one, deployment notes, and common questions."
order: 3
author: "Acme Inc."
lastUpdated: "2026-08-03"
coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1600&q=80"
---

# Token Refresh — How It Works

> This guide explains the session-refresh machinery end to end: why tokens rotate,
> the **two independent refresh layers** (a server-side one in the route proxies and
> a client-side one in `useApi`), how to tell which one fired, and how to deploy and
> tune it. Written for a junior developer with ~6 months of experience.
>
> 🍵 **Just want the intuition?** Read [Token Refresh — The Simple Version](./token-refresh-simple.md)
> (the coffee-shop analogy, zero jargon) first, then come back here for the details.

---

## Table of Contents

1. [The big picture](#1-the-big-picture)
2. [Tokens & cookies](#2-tokens--cookies)
3. [Layer 1 — server-side (proxy) refresh](#3-layer-1--server-side-proxy-refresh)
4. [Layer 2 — client-side (reactive) refresh](#4-layer-2--client-side-reactive-refresh)
5. [Which layer fires when](#5-which-layer-fires-when)
6. [Dead sessions & transient failures](#6-dead-sessions--transient-failures)
7. [Observability — watching both layers](#7-observability--watching-both-layers)
8. [Deployment notes](#8-deployment-notes)
9. [Security & trade-offs](#9-security--trade-offs)
10. [Tuning](#10-tuning)
11. [FAQ](#11-faq)

---

## 1. The big picture

Every request that hits the API is authenticated with a **JWT access token**. Access
tokens are short-lived on purpose (`JWT_ACCESS_EXPIRY`, default `15m`): if one leaks,
it expires quickly. To avoid making the user log in every 15 minutes, the API also
issues a long-lived **refresh token** (`JWT_REFRESH_EXPIRY`, default `7d`) that can be
exchanged for a brand-new token pair.

The exchange is called a **rotation**: the API issues a new access token **and** a new
refresh token, and **invalidates the old refresh token** (it's stored hashed in the
database, so the old one can't be reused). This means a stolen refresh token can only
be used once — the thief and the real user can't both hold a valid refresh token.

When do we rotate? **Whenever the access token is expired (or close to it) and a
request needs a valid one.** That can happen in two different places — a server-side
layer and a client-side layer:

```
                ┌─────────────────────────────────────────────┐
                │             THE API (:8080)                 │
                │  /auth/refresh → new tokens via Set-Cookie  │
                └──────────▲──────────────────────▲──────────┘
                           │                      │
            LAYER 1 (server)│            LAYER 2 (browser)
        Next.js proxy (:3000/:3001)      useApi / AuthProvider
        on full page navigation          on any 401 response
```

---

## 2. Tokens & cookies

- **Both tokens live in `httpOnly` cookies** — browser JavaScript can never read them
  (`document.cookie` hides httpOnly cookies). No token ever touches JS memory, so XSS
  can't steal them.
- **The API sets them as session cookies** (no `Max-Age`/`Expires`). That's a
  deliberate choice: closing the browser ends the session, and the user logs in again
  on the next visit. (The refresh token's real lifetime is still enforced server-side
  by `JWT_REFRESH_EXPIRY`.)
- **Web and admin use isolated cookie sets** — the web app uses `accessToken` /
  `refreshToken`; the admin panel uses `adminAccessToken` / `adminRefreshToken`. A web
  login can't reach the admin panel and vice versa. The backend picks the cookie set
  from the `X-Client-Type` header (`admin` for the panel).
- **The route proxies read the httpOnly cookies server-side** (unlike browser JS).
  That's the superpower that makes Layer 1 possible.

---

## 3. Layer 1 — server-side (proxy) refresh

**Where:** `apps/web/proxy.ts` and `apps/admin/proxy.ts` (Next.js 16 `proxy.ts`
convention — runs on the **Node.js runtime**, see [Deployment](#8-deployment-notes)).

**When it fires:** on a **full page navigation** (browser refresh, typing a URL,
hard link navigation) **and** all of these are true:

1. The route isn't public;
2. both the access-token and refresh-token cookies are present;
3. the request looks like a document navigation (`sec-fetch-mode: navigate`, or
   `Accept: text/html`) — RSC/prefetch data requests are skipped;
4. the access token is expired **or expires within 30s** (`REFRESH_SKEW_MS`, absorbs
   clock drift between server and browser).

**What happens:**

```
 browser ── GET /hello (full navigation) ──► Next.js proxy
                                                 │ reads httpOnly cookies
                                                 │ access token expired?
                                                 │   └─ no  → serve page as-is
                                                 ▼ yes
                                      POST /auth/refresh  (server→API, 3s timeout)
                                                 │
                                    ┌────────────┴────────────┐
                                    │ 200: new Set-Cookie      │ 401/403: refresh token
                                    │      headers             │     dead → clear cookies
                                    ▼                         ▼      + redirect to login
                            rotated cookies attached   (network/5xx → serve page
                            to the page response            with stale session)
                                                 │
 browser ◄── 200 + Set-Cookie (new tokens) ─────┘
```

Key properties:

- **Invisible in the browser's Network tab** — the refresh is a server-to-server
  `fetch`, so it never appears in DevTools. The browser only sees the rotated cookies
  attached to the page response (`Set-Cookie` headers on the document request).
- **The first API call after the page loads never 401s** — e.g. `/auth/me` runs with a
  freshly rotated access token.
- **Never blocks navigation for long** — the refresh call has a 3s timeout
  (`REFRESH_TIMEOUT_MS`); a slow API adds at most 3s to the page load, then the page
  is served anyway.
- **Observed in the server console** via the `[proxy:web]` / `[proxy:admin]` log lines
  (see [Observability](#7-observability--watching-both-layers)).

---

## 4. Layer 2 — client-side (reactive) refresh

**Where:** `packages/client/src/lib/auth.tsx` (`AuthProvider.handleRefresh`) +
`packages/client/src/lib/use-api.ts` (the `401 → refresh → retry` pipeline).

**When it fires:** on **any API call that returns `401`** while the page is already
loaded — SPA-style navigations (Next.js `Link`, `router.push` — the admin panel
navigates like this), background refetches, mutations, etc. The proxy doesn't run for
these, so an expired token reaches the API and comes back as `401`.

**What happens:**

```
 browser ── GET /auth/me ──► API
                              │ 401 (access token expired)
                              ▼
                     useApi sees 401
                              │ calls onRefresh() (single-flighted)
                              ▼
                 POST /auth/refresh  (browser→API, appears in Network tab)
                              │
                ┌─────────────┴──────────────┐
                │ ok: retry /auth/me (200)    │ fail: onUnauthorized →
                └─────────────────────────────┘   clear state + redirect to login
```

Key properties:

- **Visible in the browser's Network tab** — this refresh is a normal browser `fetch`
  (`credentials: "include"`), so you'll see `POST /auth/refresh` followed by the
  retried request.
- **Single-flighted** — concurrent 401s (e.g. `/auth/me` + `/auth/user` failing at the
  same time) share **one** refresh call. This matters because rotation invalidates the
  old refresh token: two parallel refreshes would rotate twice and break the session.
- **Refresh is routed through `apiFetch`** (not `useApi`) so it never re-enters the
  `401 → refresh` pipeline it drives (no recursion).
- **Only if the refresh itself fails** do you get bounced to `/auth/login`.

---

## 5. Which layer fires when

| Situation                                                        | Layer               | Visible in Network tab?        |
| ---------------------------------------------------------------- | ------------------- | ------------------------------ |
| Hard refresh / new tab / typed URL with an expired token         | 1 (proxy)           | ❌ No (only server console)    |
| Hard refresh with a valid token                                  | neither (no-op)     | —                              |
| SPA navigation (click a Link / router.push) with expired token   | 2 (client 401)      | ✅ Yes (`POST /auth/refresh`)  |
| Any in-page refetch / mutation that 401s                         | 2 (client 401)      | ✅ Yes                         |
| Refresh token dead (any layer)                                   | redirect to login   | ✅ the 401s are visible        |

Rule of thumb: **full page loads refresh invisibly on the server; anything that
happens while the page is already open refreshes visibly from the browser.**

---

## 6. Dead sessions & transient failures

- **Dead session (refresh token rejected — `401`/`403` on refresh):** the session is
  genuinely over. Layer 1 clears the stale cookies (the proxy *can* delete httpOnly
  cookies — browser JS can't) and redirects to login; Layer 2 clears auth state and
  redirects. Clearing is important: without it, the stale access cookie would keep the
  proxy thinking the user is logged in, causing a bounce loop between the panel and
  the login page.
- **Transient failure (network error, timeout, `5xx`):** the proxy **does not** log
  the user out. It serves the page with the stale session and lets the API/`useApi`
  decide — a temporary API blip shouldn't kill a session. Layer 2's refresh would also
  fail → redirect, but that's the fallback only when the API is genuinely refusing.

**Proxy refresh cooldown.** To keep a dead API from being hammered, each proxy
memoizes a transient failure for **60 seconds** (`PROXY_REFRESH_COOLDOWN_MS`). Inside
that window, later navigations **skip** the refresh call entirely (you'll see
`[proxy:*] ... cooldown-active — refresh skipped` in the server console) and the stale
page is served — no repeated `ECONNREFUSED` noise. The cooldown is cleared by a
successful refresh, a dead session, or a fresh login. ⚠️ **One caveat:** the web
(`:3000`) and admin (`:3001`) proxies run in the **same Next.js server process**, each
with its own cooldown instance. If you have both apps open on one host and the API
dies, one app's transient failure doesn't directly share the other's cooldown — but
because the API is down for both, both will independently skip refreshes for the same
minute. If the API were flaky enough to fail for only one client type, that app's
refresh would be suppressed for up to 60s while the other keeps retrying. That is an
accepted trade-off of the per-instance memoization — it self-heals on the next
successful refresh or after the window elapses.

---

## 7. Observability — watching both layers

**Layer 1 (server-side refresh)** — watch the **Next.js server console** (the terminal
running `pnpm dev:web` / `pnpm dev:admin`):

```
[proxy:web] /hello: refreshed — rotated 2 cookie(s) (API 200, 14ms)
[proxy:admin] /: dead-session — refresh rejected, clearing cookies (API 401, 6ms)
[proxy:web] /hello: transient-failure — refresh failed (network/5xx) — connect ECONNREFUSED 127.0.0.1:8080, keeping stale session (API 0, 8ms)
```

**Layer 2 (client-side refresh)** — watch the browser's **Network tab**: look for
`POST /auth/refresh` (status 200) followed by the retried request.

Try this end-to-end: set `JWT_ACCESS_EXPIRY=1m` in `apps/api/.env`, log in, wait a
minute, then **hard refresh** with the Network tab open. You'll see `/auth/me` return
`200` with **no** `/auth/refresh` in the tab — but the `[proxy:web] ... refreshed`
line in the server console.

---

## 8. Deployment notes

- **The proxies run on the Node.js runtime.** Next.js 16 runs `proxy.ts` on Node by
  design (only the legacy `middleware.ts` convention can opt into Edge), so there is
  **no Edge runtime to configure** — the proxies deploy like any other Node app on
  DigitalOcean / Linode droplets, Railway, Vercel, etc.
- **The proxy must be able to reach the API** (`NEXT_PUBLIC_API_URL`) from the server.
  Same machine, private network, or public HTTPS URL all work — the proxy's fetch is
  server-to-server, so CORS does not apply.
- **Cookies must be first-party and `SameSite=Lax`.** The web (`:3000`) and admin
  (`:3001`) apps talk to the API (`:8080`) via `NEXT_PUBLIC_API_URL`; in production,
  serve the app and API under the same site (e.g. `app.example.com` + `api.example.com`
  with `Secure` cookies enabled by `NODE_ENV=production`).

---

## 9. Security & trade-offs

- **Tokens never touch JavaScript.** `httpOnly` cookies only.
- **Rotation invalidates the old refresh token**, so a leaked refresh token is single-use.
- **Web/admin cookie isolation** (`X-Client-Type`) keeps the two apps' sessions apart.
- **Trade-off — independent single-flight domains:** the proxy refresh (per
  navigation) and the client refresh (per 401, per tab) don't coordinate. A rotation in
  one tab can invalidate an in-flight rotation in another (worst case: a spurious
  re-login). This is accepted in exchange for not building cross-tab coordination.
- **Trade-off — per-instance proxy cooldown:** each app's proxy memoizes transient
  failures separately (see [Dead sessions & transient failures](#6-dead-sessions--transient-failures)).
  On a shared host where both apps point at one API, a failure that only affects one
  app suppresses that app's proxy refresh for up to 60s while the other keeps trying.
  Harmless in practice (a genuinely dead API fails for both; a healthy API never
  cooldowns) and self-healing, but it's a deliberate "per instance" choice.
- **No proactive background refresh.** Refreshes happen on demand (navigation or 401) —
  not on a timer. There's deliberately no JS-visible expiry cookie or `setTimeout`
  scheduler; that experiment was tried and reverted (the httpOnly access cookie is
  unreadable by JS, so any client-side "is it expired yet?" check can't see the truth).

---

## 10. Tuning

| Setting                 | Where                    | Default | Effect                                              |
| ----------------------- | ------------------------ | ------- | --------------------------------------------------- |
| `JWT_ACCESS_EXPIRY`     | `apps/api/.env`          | `15m`   | How often tokens rotate. `1m` is handy for testing. |
| `JWT_REFRESH_EXPIRY`    | `apps/api/.env`          | `7d`    | Max session length (before a re-login is needed).   |
| `REFRESH_SKEW_MS`       | `proxy-refresh.ts` const | `30000` | Refresh this early before `exp` (clock-drift buffer). |
| `REFRESH_TIMEOUT_MS`    | `proxy-refresh.ts` const | `3000`  | Max time a proxy refresh may add to a page load.    |

With `JWT_ACCESS_EXPIRY=1m`, Layer 1 fires on nearly every navigation and Layer 2 on
nearly every stale call — that's expected for testing. Revert to `15m` for real use.

---

## 11. FAQ

**Why does `/auth/me` still 401 on a cold page load sometimes?**
If the page loads *without* a full navigation (e.g. an SPA nav or a background refetch)
the proxy doesn't run — the 401 fires, Layer 2 refreshes and retries, and the retry
succeeds. The 401 you see in the Network tab is the *trigger*, not a failure.

**Why do I get logged out after closing the browser?**
Session cookies by design (see [Tokens & cookies](#2-tokens--cookies)). The refresh
token never outlives the browser session.

**Why don't I see `/auth/refresh` in the Network tab?**
Because it ran server-side (Layer 1). If it was a client-side refresh (Layer 2), you
would see it.

**Why do I see `/auth/refresh` twice in the Network tab?**
Single-flighting only dedupes *concurrent* 401s in one tab. Two refreshes in sequence
are two rotations — e.g. a 401, refresh, then another 401 shortly after.

**Why did my session die while another tab stayed logged in?**
The rotation race described in [Security & trade-offs](#9-security--trade-offs) — the
two layers don't coordinate across tabs.

---

_Last updated: August 3, 2026_
