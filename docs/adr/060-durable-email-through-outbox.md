---
title: "ADR 060: Durable Email Through the Outbox"
tags: ["adr", "email", "outbox", "notifications"]
description: "An email is requested in the same transaction as the business row. The outbox routes notification.email.requested to the existing BullMQ email queue, with an inline send when Redis is off."
author: "Platform Team"
lastUpdated: 1792281600000
coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&h=630&fit=crop"
order: 60
---

# ADR 060: Durable Email Through the Outbox

## Status

Accepted (2026-10-18). Extends ADR 015.

## Context

Password reset, invites, claim OTPs and owner notices used to send mail after the business transaction committed. A crash in that gap left the business row saved and the email never requested. A retry of the HTTP request could not tell that the mail had not been asked for.

The email pipeline itself (the BullMQ `emailSend` queue, the log row, the provider) already existed and is durable once a job is enqueued. The hole was the step between "the business row committed" and "a job exists".

## Decision

1. Callers depend on `EmailRequestPort` (`EMAIL_REQUEST`). They do not call the sender class.
2. The request is written in the caller's transaction: an `EmailLog` row in `pending`, plus an outbox row whose type is `notification.email.requested`. The idempotency key is `email-log/<id>`, the same key the queue already uses so a redelivery does not send twice.
3. The outbox dispatcher routes that type to the existing BullMQ email queue. When Redis is disabled, the dispatcher uses the existing inline delivery path instead of dropping the row.
4. Retention of these rows is the same as every other outbox row (ADR 015). There is no second retention policy for mail.
5. A stored email-log status that is not one of the known statuses is a corrupt aggregate (`CORRUPT_AGGREGATE_STATE`), not a value the mapper guesses.

## Consequences

- A failure after commit can no longer be the only reason a password-reset email was never requested. The row and the outbox record commit together, or neither does.
- The BullMQ processor still performs delivery. This record does not replace the provider, the template, or the log.
- Call sites that still send after commit are unfinished and are listed in the migration gaps file. The port and the corrupt-status failure are in place.
