---
title: "ADR 052: GitHub Pull Requests — Per-Admin Token, Writes as the Admin, Webhook-Driven Live Updates"
tags: ["adr", "api", "mobile", "integration", "github", "security"]
description: "Admins link their own fine-grained GitHub token (stored encrypted, never returned) to read the pull requests of every repository it can see — private ones included — comment, review and close them as themselves, and see changes live through verified GitHub webhooks fanned out over Server-Sent Events."
author: "Platform Team"
lastUpdated: 1792022400000
coverImage: "https://images.unsplash.com/photo-1556075798-4825dfaaf498?w=1200&h=630&fit=crop"
order: 52
---

# ADR 052: GitHub Pull Requests — Per-Admin Token, Writes as the Admin, Webhook-Driven Live Updates

## Status

Accepted (2026-10-15). Extends [ADR 045](./045-github-contributions-integration.md), which deferred
per-user GitHub credentials; ADR 045's read-only contributions integration is unchanged.

## Context

Admins want to work on the pull requests of their GitHub repositories from the mobile app — public
**and private** ones: read the conversation, the changed files and their diffs, each comment's edit
history; comment (on the pull request or on a line), approve, request changes, close and reopen.
Every action must land on GitHub, as the admin, immediately; changes made elsewhere should show up
in the app without a manual refresh. It runs in production.

ADR 045's single server token cannot do this: it is read-only, public-only by design, and anything
written with it would be written as the token's owner for every caller.

## Decision

### Credentials — each admin's own fine-grained token

- An admin links **their own fine-grained personal access token** (`PUT /github/account`). The API
  checks it with GitHub before storing it — who it belongs to and when it expires — and refuses a
  token GitHub rejects. (GitHub does not tell an API what a fine-grained token may do; a missing
  permission shows up as GitHub refusing that one action.)
- Required token permissions: _Pull requests: Read and write_, _Contents: Read and write_ (merging,
  deleting a merged branch, attaching pictures; read-only is enough without them), _Metadata:
  Read-only_, and _Webhooks: Read and write_ (live updates). A token without the webhook permission
  still works; live updates are then reported as unavailable for it.
- Stored in `github_account_links` (one live row per user, soft-deleted on unlink): the token
  encrypted with AES-256-GCM under a dedicated, versioned key ring
  (`GITHUB_CREDENTIAL_ENCRYPTION_KEYS`, same JSON shape as `MFA_ENCRYPTION_KEYS`), with the owner's
  user id as additional authenticated data — a ciphertext copied onto another user's row does not
  decrypt. The token is never returned by any endpoint, never logged, and redacted from the HTTP
  audit log (the field name ends in `token`). The row-change audit (ADR 051) excludes the ciphertext
  column.
- When GitHub answers 401 for a stored token (revoked or expired), the link is marked
  `REJECTED` and every pull-request route answers 409 until the admin links a new token.

### Access — admins only

- New permission resource **`GITHUB_PULL_REQUEST`**: `READ` (list and view) and `UPDATE` (link or
  unlink the token, comment, review, close or reopen). Granted to Admin (and SuperAdmin, which holds
  everything); no other role. Every route is also `@AdminAccessOnly`, like the email log.
- Every read and write uses the **caller's own token**, so GitHub enforces what that person may see
  and do on each repository. Nothing about a repository is shared between users.

### Reads — GitHub is the source of truth

- Nothing about pull requests is copied into the database. The API reads GitHub (GraphQL, plus REST
  for a pull request's files and their patches) and keeps a short **per-user** cache (same
  `GithubResponseCache` as ADR 045: single flight, stale on failure) keyed by user and request.
- The list is searched from a **closed set of filters** — _your repositories_, _created by you_,
  _review requests_, _assigned to you_, _mentions you_ — and _open_ / _closed_. The API builds the
  search query; no client-supplied query text reaches GitHub.

### Writes — straight to GitHub, as the admin

- Comment on the pull request, comment on a line of the diff, edit your own comment, submit a review
  (`COMMENT`, `APPROVE`, `REQUEST_CHANGES` — the app's "reject"), close and reopen, and **merge**
  (merge commit, squash or rebase — whichever the repository allows), optionally deleting the branch.
  A merge is pinned to the head commit the person saw (GitHub refuses it when the branch moved on), and
  deleting the branch afterwards never undoes it — a branch GitHub keeps is reported with its reason.
- Every write requires an `Idempotency-Key` (the platform ledger, `@Idempotent`), so a retried
  request never posts twice; every write is in the HTTP audit log.
- GitHub's own rules apply and are surfaced, not re-implemented: GitHub refuses an approval of your
  own pull request; the API answers GitHub's refusal (REST 422, or 403 for a token that may not
  write there) as a 409 `GITHUB_WRITE_REJECTED` — GitHub's reason, or which permission to add.
- The writes go through GitHub's REST endpoints, which accept a fine-grained token with *Pull
  requests: Read and write* (in testing, GitHub's GraphQL `addComment` refused such a token with
  "Resource not accessible by personal access token").
- A successful write clears the caller's cached reads of that pull request.

### Reactions — REST, set on or off

- Reactions are read with each comment (`reactionGroups`) and set with `PUT …/reactions`
  `{ subject, content, reacted }` through GitHub's REST reaction endpoints, which take a fine-grained
  token (the same reason as the comment writes). A state, not an action: setting it to what it already is
  changes nothing, so it needs no Idempotency-Key. A review's summary has no REST reactions and is shown
  read-only.

### Pictures — the API's lasting addresses to read; the repository to attach, on posting

- **Reading.** Outside pictures are served by GitHub's image proxy, and anyone may load them. Two kinds
  open only for a signed-in reader: an upload to a private repository (GitHub's signed link to it
  expires in about five minutes, and exists only in GitHub's rendering of a body) and a file kept in a
  repository (GitHub neither signs nor proxies those). The API reads `bodyHTML` beside `body` and sends
  each comment's pictures as `images: [{ source, url }]` (the description's as `bodyImages`); clients
  match a markdown address to its entry (`githubImageUrlFor`, by address or upload id). For the two
  signed-in kinds, `url` is an address of the API's own (`/github/pictures/…`) that names the picture
  only — no reader, no expiry — so a cached answer never carries a dead link. The app opens it signed
  in, and the API reads the picture then with the caller's own token (for an upload: the body of the
  node showing it, for a fresh signed link, then the picture through that link without the token). The
  markdown stays the source of what is drawn; the HTML is read for `<img>` tags only and never shown.
- **Attaching.** GitHub has no API for its own uploads (its web editor's endpoint needs a browser
  session). A picture attached from the app is uploaded through the file pipeline as a private
  `GITHUB_COMMENT_IMAGE` (checked like any upload); attaching answers where it will be —
  `github.com/<owner>/<repo>/raw/github-comment-assets/pull-requests/<n>/<upload id>.<ext>` — and the
  draft links it. It is **committed only when a comment or review linking it is posted**, with the
  admin's token, to the repository's own branch `github-comment-assets` (started from a parentless
  commit, never merged), and the upload is then deleted. A picture taken out of the draft is never
  committed; its upload is deleted by the storage sweep after a day (`stagingRetentionMs`). GitHub shows
  a committed picture to exactly who may read the repository — private stays private — in every
  environment. Cost: the token needs _Contents: Read and write_, and each posted picture is a commit on
  that branch.

### Live updates — verified webhooks, fanned out over SSE

- Enabled when `GITHUB_WEBHOOK_URL` (the API's public https receiver) and
  `GITHUB_WEBHOOK_SECRET` are set together (the receiver is `/api/v1/github/webhook`). An admin turns live updates on per repository; the API
  registers one webhook there with their token (pull requests, reviews, review comments and threads,
  issue comments; JSON; the shared secret) and records it in `github_webhook_subscriptions` — one row per
  repository, shared by every admin, soft-deleted when turned off. A hook already delivering to this
  address is adopted instead of duplicated, and the row is claimed in one statement, so concurrent
  turn-ons end on one hook.
- The receiver (`POST /github/webhook`, public; hooks are registered with the configured address, so a
  new API version re-points them by turning live updates on again) checks
  `X-Hub-Signature-256` — HMAC-SHA256 of the raw body with the secret, compared in constant time —
  before parsing anything; deliveries are de-duplicated by `X-GitHub-Delivery`
  (`github_webhook_deliveries`, primary key, pruned after 7 days).
- **Fan-out through Postgres, not Redis:** the delivery is recorded and its change announced with
  `pg_notify` in one transaction; every API instance LISTENs (`GithubPullRequestChangesHub`), drops its
  cached reads of that pull request for every user, and passes the change to its streams. No extra
  infrastructure, and the announcement can never run ahead of the record.
- Clients listen per repository on `GET /github/live-updates/:owner/:repository/events` (SSE), opened only
  after the API checks with the caller's own token that they can see the repository — a broadcast of
  every change would tell admins about repositories GitHub does not show them. Events name the
  repository and pull request, never their content; the app refetches what it shows, and only while the
  screen is showing and the app is in the foreground.
- Without the webhook settings — local development — nothing breaks: the app reads on open and on
  pull-to-refresh, and shows no live-updates row.

## Alternatives

- **GitHub App with user-to-server tokens** — the narrowest, expiring, per-repository access, and the
  recommended model for a multi-tenant product. Not chosen now: it needs an app registration, an
  OAuth-style install flow and token refresh. The token is behind one service (`GithubCredentials`),
  so a GitHub App can replace the personal token without touching the routes.
- **OAuth App with the `repo` scope** — full read/write to every repository and its code, tokens that
  never expire.
- **Reuse the server token of ADR 045** — every write would be made as the token owner, and every
  admin would see whatever that token sees.
- **Mirror pull requests in the database** — a sync engine and a second source of truth; webhooks
  plus a short cache give the same freshness.
- **Polling instead of webhooks** — burns the per-token rate limit and is never live.
- **Redis pub/sub for the fan-out** — another moving part for what Postgres LISTEN/NOTIFY already does
  transactionally (the audit trail's live signal uses it too).
- **One stream of every repository's changes** — simpler, but it would leak the names of private
  repositories (and their activity) to admins whose tokens cannot see them.
- **Push notifications** — reach the phone when the app is closed, but need Expo push credentials
  (FCM, APNs). Separate decision.
- **Pictures: proxy GitHub's uploads through the API** (fetch `github.com/user-attachments/…` with the
  admin's token) — GitHub does not accept API tokens on those addresses; its signed links are the
  only way (which is why the API reads a fresh one from the body each time). **Short-lived signed links
  of our own, naming the reader** (built first, replaced the same day) — any cached answer then carried
  links that died within minutes. **Commit a picture as soon as it is attached** (built first, replaced
  the same day) — a picture taken out of the draft stayed in the repository's history for good. **This app's public storage for attached pictures** (built first, replaced the same day) —
  readable by anyone with the address even for a private repository, and invisible on GitHub whenever
  storage is not public (local development). **Render `bodyHTML` instead of markdown** — a second renderer for HTML in the app, for
  what one `<img>` list already gives. **Upload to GitHub's attachment endpoint** — undocumented and
  tied to a browser session; it would break without notice.

## Consequences

- An admin must create and paste a fine-grained token; when it expires, the app asks for a new one.
- Rotating `GITHUB_CREDENTIAL_ENCRYPTION_KEYS`: add a new version; old tokens keep decrypting with
  their version and are re-encrypted on the next link.
- Webhooks need a public HTTPS URL for the API; GitHub retries failed deliveries, duplicates are
  ignored.
- Attached pictures live in the repository, on `github-comment-assets`: they follow the repository's
  access, and a picture taken out of a draft before posting stays committed there, unreferenced.
- Two more tables with data the platform owns (`github_account_links`, `github_webhook_subscriptions`)
  and one delivery log; no pull-request content is stored.
