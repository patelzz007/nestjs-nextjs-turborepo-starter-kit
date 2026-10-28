---
title: "Local email with Mailpit"
description: "How local development delivers every email into a native Mailpit inbox (EMAIL_PROVIDER=mailpit), how to read codes and links from it — including from an AI agent with pnpm mail:latest — and how to switch to Resend locally."
order: 44
author: "Platform Team"
lastUpdated: 1792108800000
coverImage: "https://images.unsplash.com/photo-1596526131083-e8c633c948d2?w=1200&h=630&fit=crop"
tags: ["email", "mailpit", "local-development", "ai-agents"]
---

# Local email with Mailpit

Locally, the API delivers every email (sign-in codes, verification and reset links, invites) into
[Mailpit](https://mailpit.axllent.org), a local inbox. Nothing leaves your machine, so you can sign
up and sign in with any address, and a script (or an AI agent testing the app) can read the
six-digit code back without access to a real mailbox.

Every **deployed** environment (dev, staging, production) delivers through
[Resend](./resend-setup.md). The API refuses to boot with `EMAIL_PROVIDER=mailpit` unless
`APP_URL` is localhost.

## Set it up

Mailpit is one of the Docker services in `compose.yml`, so `pnpm docker:up` starts it with the rest
(nothing to install):

```bash
pnpm docker:up            # Redis, Kafka, RabbitMQ, Bull Board and Mailpit
pnpm mailpit              # or Mailpit alone (docker compose up -d mailpit)
```

The inbox and its API answer on `http://localhost:8025`, SMTP on `127.0.0.1:1025`, both bound to
`127.0.0.1` only (override the host ports with `MAILPIT_UI_PORT` / `MAILPIT_SMTP_PORT`). Messages live
in memory, so restarting the container empties the inbox.

In `apps/api/.env` (the defaults of `.env.example`):

```dotenv
EMAIL_MODE=send
EMAIL_PROVIDER=mailpit
# MAILPIT_URL=http://localhost:8025
```

If Mailpit is not running when the API starts, the API logs one warning; each send then fails
(after its retries) with a hint to run `pnpm mailpit`, and the email log row is marked `failed`.

`EMAIL_TEST_TO` (redirect every email to one address) is ignored with Mailpit: Mailpit already keeps
every email under its real recipient, which is what `pnpm mail:latest --to <email>` searches by.

## Read an email

- **Browser:** <http://localhost:8025>.
- **Terminal / scripts / AI agents:** `pnpm mail:latest`.

```bash
pnpm mail:latest                                  # newest email: recipient, subject, codes, links, body
pnpm mail:latest --to admin@example.com           # newest email sent to that address
CODE=$(pnpm mail:latest --to admin@example.com --code)   # only the first six-digit code
```

`--code` prints just the code on stdout and exits `1` when there is no matching email or no code,
so a test or an agent can sign in with it directly. Each message is tagged with its template key
(`login-verification`, `verification`, `password-reset`, …), and carries the email log id in an
`X-Email-Log-Id` header, so you can also search the inbox (`tag:login-verification`) or call the
[Mailpit API](https://mailpit.axllent.org/docs/api-v1/) yourself.

Search by the account's own address: `EMAIL_TEST_TO` does not apply with Mailpit, so every email keeps
its real recipient.

## Switch to Resend locally

To check how an email looks in a real inbox, set `EMAIL_PROVIDER=resend` with a `RESEND_API_KEY`
(and usually `EMAIL_TEST_TO=<your address>`), then restart the API. See
[Set up email with Resend](./resend-setup.md).

| Setting | Where emails go |
| --- | --- |
| `EMAIL_MODE=send`, `EMAIL_PROVIDER=mailpit` | the local Mailpit inbox (local default) |
| `EMAIL_MODE=send`, `EMAIL_PROVIDER=resend` | real inboxes through Resend (every deployed environment) |
| `EMAIL_MODE=log-only` | the API log only |
| `EMAIL_MODE=noop` | nowhere (e2e tests) |

## How it works

`EmailSenderService` owns validation, the email log, rate limiting, retries and the timeout. It
hands the rendered email to an `EmailTransport` chosen by `EMAIL_PROVIDER`
(`apps/api/src/contexts/notifications/infrastructure/adapters/transports`):

- `ResendEmailTransport` sends through the Resend SDK, with the email log id as idempotency key
  and as the `emailLogId` tag that delivery webhooks echo back.
- `MailpitEmailTransport` posts to Mailpit's `POST /api/v1/send`. Mailpit has no idempotency
  keys and sends no delivery webhooks: a retry after a timeout can store a second copy (harmless in
  a local inbox), and the email log row's `resendId` stays empty. The row's metadata records
  `provider: "mailpit"`.
