---
title: "Delivering Reliable Email with Resend Webhooks"
description: "Transaction emails are only as good as their delivery pipeline. We wired Resend webhooks into the API with signature verification, per-IP rate limiting and live status tracking."
author: "Acme Inc."
date: 1786665600000
category: "Integrations"
---

# Delivering Reliable Email with Resend Webhooks

Sending an email is easy. Knowing whether it actually arrived is the hard part.

## The setup

We send transactional email through Resend. Every send creates a log row with a
status: `sent`, `delivered`, `bounced`, or `failed`. But the API can't know
what happened after it hands the message to Resend — that's where webhooks
come in.

Resend posts delivery events to a public endpoint on our API:

- the payload is signed with a webhook secret, so a spoofed request can't mark
  our emails as delivered
- the endpoint is rate-limited per IP as defense in depth
- events are only accepted for email IDs our own API created

## The tunnel problem

During local development Resend needs a reachable HTTPS URL. We initially
relied on throwaway `trycloudflare` quick tunnels — which broke every time the
URL rotated. The fix was a named `cloudflared` tunnel with a stable
`webhooks.yourdomain.com` address, so the webhook URL never changes and no
`start-tunnel.py` is needed.

## The payoff

The admin UI shows each email's live status without a page refresh, and the
delivery log doubles as an audit trail: who sent what, when, and whether it
made it. When a "sent but never delivered" support ticket arrives, the answer
is one query away instead of a weekend of packet sniffing.
