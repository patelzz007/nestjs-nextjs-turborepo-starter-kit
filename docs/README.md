---
title: "Documentation"
description: "Where to start: the user guide for people operating the platform, the technical documentation for engineers, the generated API reference and the architecture decisions."
order: 1
author: "Platform Team"
lastUpdated: 1791072000000
coverImage: "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&w=1600&q=80"
tags: ["overview", "documentation"]
---

# Documentation

A production-grade **NestJS + Next.js** Turborepo starter kit (there is no Expo app in this repository yet; `rules/04` covers one), shipped with a working
rewards platform (merchants, stores, rewards, customer claims, POS checkout, referrals, analytics) as
the reference product.

| You are… | Start with |
| --- | --- |
| Operating the platform — platform admin, merchant owner or staff, support | **[User guide](./user-guide/README.md)** — every task in order, with flowcharts |
| An engineer building on the kit | **[Technical documentation](./technical/README.md)** — setup, architecture, dos and don'ts, configuration, security, storage, email, operations |
| Integrating with the API (frontend, POS, partner) | **[API reference](./technical/api-reference/README.md)** — every endpoint with a real request and response from the seed data |
| Asking "why is it built this way?" | **[Architecture decision records](./adr/README.md)** |
| An AI coding agent | [`AGENTS.md`](../AGENTS.md) and the rulebook in `rules/` |

## Layout of this folder

```text
docs/
├── user-guide/        operator guide: setup → onboarding → stores/team → rewards → claims → POS → referrals → analytics → admin → security
├── technical/         engineering docs
│   ├── api/           conventions, routes registry, errors, list queries, response contracts, HTTP server (Fastify)
│   ├── api-reference/ GENERATED — do not edit (pnpm docs:api)
│   ├── authorization/ kernel, RBAC internals, tenancy & RLS, frontend can(), recipes, testing, troubleshooting, dos & don'ts
│   ├── security/      authentication & MFA, token refresh, database security, encryption & KMS, threat model
│   ├── storage/       overview, AWS S3 setup, Firebase Storage setup
│   ├── email/         Resend setup, templates and pipeline
│   ├── configuration/ API and frontend environment variables
│   ├── frontend/      routing, admin panel, toasts, streams (RxJS)
│   ├── tooling/       TypeScript, ESLint, dependencies
│   └── operations/    CI, local infrastructure, observability, multi-tenancy runbook
├── adr/               architecture decision records (history — never deleted)
├── generated/         openapi.json and api-samples.json (inputs of the API reference)
├── images/, assets/   screenshots and logos
└── meta.json          sidebar order of the docs site
```

The docs site (`pnpm dev` → `http://localhost:3002`, or `pnpm --filter @workspace/docs dev`) renders
this folder; how to add a page is in [`apps/docs/README.md`](../apps/docs/README.md). Every internal
link is checked by `pnpm docs:check-links` and in CI.

## Keeping it true

- Update the relevant page in the same change as the code ([`rules/14`](../rules/14-documentation.md)).
- After an API change: `pnpm --filter @workspace/api openapi:export`, re-capture samples if needed,
  then `pnpm docs:api` — the docs tests fail when the reference is stale.
- A decision that changes direction gets a new ADR; the old one is marked superseded, not deleted.
