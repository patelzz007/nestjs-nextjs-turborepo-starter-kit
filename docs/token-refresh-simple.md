---
title: "Token Refresh — The Simple Version"
description: "A no-jargon walkthrough of how silent refresh works: why there are two layers (proxy vs browser), when each one runs, and why you sometimes see a 401 in the Network tab. For anyone who found the main guide too technical."
order: 4
author: "Acme Inc."
lastUpdated: "2026-08-04"
coverImage: "https://images.unsplash.com/photo-1495615080073-6b89c9839ce0?auto=format&fit=crop&w=1600&q=80"
---

# Token Refresh — The Simple Version

> [!NOTE] This is the "explain it to me like I'm five" version of
> [Token Refresh — How It Works](./token-refresh.md). If you understand this page,
> you understand 90% of what's happening in the network tab. No jargon, no code
> reading required.

---

## The 30-second version

Your app uses **two keys** to keep you logged in:

1. A **short-lived key** (the access token) — like a movie ticket that expires
   after 15 minutes.
2. A **long-lived key** (the refresh token) — like a season pass that can get you
   a new ticket whenever the old one runs out.

When the ticket expires, the app **quietly trades in the season pass for a fresh
ticket** — and you never notice. That's "silent refresh."

The trick is that this swap can happen in **two different places**, and that's
what confuses everyone:

- **Place 1: the server** (only happens on a full page load — like pressing Cmd+R)
- **Place 2: the browser** (happens whenever an API call comes back with "401
  Unauthorized" — including when you click around the admin panel)

---

## The two layers, using a coffee-shop analogy

Imagine a coffee shop. Your access token is a **stamped hand** (it's only good for
10 minutes). Your refresh token is a **receipt** that can get you a new stamp.

### Layer 1 — the doorman (server-side refresh)

When you **walk into the shop** (load a page the normal way — refresh, new tab,
typed URL), the **doorman** checks your hand.

If your stamp is expired, the doorman himself runs to the back and gets you a new
stamp **before you even reach the counter**. You never see this happen.

- You can't see it in DevTools — the doorman does it behind the counter
  (server-to-server, never touching your browser).
- The barista (the first API call) never sees an expired stamp.

### Layer 2 — the barista (client-side refresh)

But if you're **already inside the shop** (the page is already open) and you walk
up to the barista with an expired stamp, the barista says:

> [!NOTE] "401 — sorry, this stamp is no good."

Then the barista quietly goes and gets you a new stamp using your receipt, and
takes your order anyway. **You never get kicked out.**

- This one **you CAN see** in DevTools: you'll see `401`, then a call to
  `/auth/refresh`, then the original request tried again (and succeeding).

**Both do the same thing — they get you a fresh stamp. They just work in
different rooms.**

---

## When does each layer run? (the part everyone gets stuck on)

| What you do | Which layer runs | Will I see it in DevTools? |
| --- | --- | --- |
| Press Cmd+R / refresh the page | **Layer 1** (server) | ❌ No — it's server-to-server |
| Open a new tab / type a URL | **Layer 1** (server) | ❌ No |
| Click a link in the sidebar (SPA navigation) | **Layer 2** (browser) | ✅ Yes — you'll see the 401 + refresh |
| A background request happens while the page is open | **Layer 2** (browser) | ✅ Yes |

### The one sentence that explains everything

> [!NOTE] **Full page loads refresh invisibly on the server. Anything that happens while
> the page is already open refreshes visibly from the browser.**

---

## "Why do I see a 401 in the Network tab when I click around?"

Because clicking a link in the sidebar is **SPA navigation** — the page doesn't
reload, the app just swaps the content. The server (Layer 1) is **not involved**.
So an expired stamp actually reaches the barista, the barista says "401", and
**Layer 2** kicks in to fix it.

**That 401 is not an error.** It's the *trigger* that makes the silent refresh
start. The sequence you see is:

```
1. GET /session            → 401 Unauthorized  (expired stamp, expected)
2. POST /auth/refresh      → 200              (trade receipt for new stamp)
3. GET /session (retry)    → 200              (order goes through)
```

"Silent" means **you** don't have to do anything (no login screen, no redirect).
It does **not** mean "invisible in DevTools." Seeing those three lines is the
silent refresh working correctly.

---

## "Why doesn't it just refresh on navigation like Cmd+R does?"

Because the server only does Layer 1 when it sees a **real page load** — the
browser literally asks the server "give me a new page." SPA navigation doesn't do
that: the browser already has the page, it just swaps the contents around. The
server never gets asked, so Layer 1 never runs.

That's why we added a tiny **session-check badge** to the admin dashboard and the
settings pages. It makes one small API call every time you navigate to those
pages, which gives Layer 2 something to react to — so your token gets refreshed
even when you're just clicking around the panel.

---

## The coffee-shop recap

- **Cmd+R** = walking into the shop → the doorman (Layer 1) sorts it out before
  you reach the counter. Invisible.
- **Clicking around the panel** = already inside, walking up to the barista
  (Layer 2) → you might see a quick "401" while they sort you out. Visible, but
  painless.
- **Seeing a 401 in DevTools** = not a bug. That's Layer 2 doing its job.

If you want the full technical details (the actual code, the timing, the
deployment notes, the FAQ), read
[Token Refresh — How It Works](./token-refresh.md).

---

_Last updated: August 4, 2026_
