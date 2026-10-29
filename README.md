<p align="center">
  <img src="./docs/assets/readme-banner.png" alt="One contract, every surface: a NestJS API, three Next.js apps, an Astro docs site and an Expo app, typed end to end by shared Zod schemas in one Turborepo" width="100%" />
</p>

<p align="center">
  A production-grade <strong>NestJS + Next.js + Expo</strong> monorepo: one NestJS API on Fastify, three Next.js apps, an Astro docs site and an Expo mobile app, all typed end to end by one set of Zod schemas. It ships with a complete reference product (a multi-tenant rewards platform) so every pattern is shown working, not described.
</p>

<p align="center">
  <a href="https://nestjs.com"><img src="https://img.shields.io/badge/NestJS-12-E0234E?logo=nestjs&logoColor=white" alt="NestJS 12" /></a>
  <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white" alt="Next.js 16" /></a>
  <a href="https://expo.dev"><img src="https://img.shields.io/badge/Expo-SDK%2058-1C2024?logo=expo&logoColor=white" alt="Expo SDK 58" /></a>
  <a href="https://react.dev"><img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React 19" /></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-7-3178C6?logo=typescript&logoColor=white" alt="TypeScript 7" /></a>
  <a href="https://zod.dev"><img src="https://img.shields.io/badge/Zod-4-408AFF?logo=zod&logoColor=white" alt="Zod 4" /></a>
  <a href="https://tanstack.com"><img src="https://img.shields.io/badge/TanStack-Query%20%C2%B7%20Form%20%C2%B7%20Table%20%C2%B7%20Virtual-FF4154" alt="TanStack Query, Form, Table and Virtual" /></a>
</p>

<p align="center">
  <a href="https://www.postgresql.org"><img src="https://img.shields.io/badge/PostgreSQL-18-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL 18" /></a>
  <a href="https://www.prisma.io"><img src="https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white" alt="Prisma 7" /></a>
  <a href="https://fastify.dev"><img src="https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white" alt="Fastify" /></a>
  <a href="https://redis.io"><img src="https://img.shields.io/badge/Redis-8-FF4438?logo=redis&logoColor=white" alt="Redis 8" /></a>
  <a href="https://kafka.apache.org"><img src="https://img.shields.io/badge/Kafka-4-231F20?logo=apachekafka&logoColor=white" alt="Kafka 4" /></a>
  <a href="https://tailwindcss.com"><img src="https://img.shields.io/badge/Tailwind%20CSS-4-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS 4" /></a>
  <a href="https://turborepo.com"><img src="https://img.shields.io/badge/Turborepo-2-FF1E56?logo=turborepo&logoColor=white" alt="Turborepo 2" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node-24.22.1-339933?logo=node.js&logoColor=white" alt="Node 24.22.1" /></a>
  <a href="https://pnpm.io"><img src="https://img.shields.io/badge/pnpm-12-F69220?logo=pnpm&logoColor=white" alt="pnpm 12" /></a>
</p>

<p align="center">
  <a href="./docs/technical/getting-started.md"><strong>Getting started</strong></a>
  ·
  <a href="./docs/technical/architecture.md">Architecture</a>
  ·
  <a href="./docs/README.md">All documentation</a>
  ·
  <a href="./docs/user-guide/README.md">User guide</a>
  ·
  <a href="./docs/adr/README.md">Decisions (ADRs)</a>
</p>

---

## Contents

- [Why this kit](#why-this-kit)
- [Screenshots](#screenshots)
- [What's inside](#whats-inside)
- [Tech stack](#tech-stack)
- [Architecture at a glance](#architecture-at-a-glance)
- [Domain-driven design, CQRS and multi-tenancy](#domain-driven-design-cqrs-and-multi-tenancy)
- [The reference product](#the-reference-product)
- [Quick start](#quick-start)
- [Demo accounts](#demo-accounts)
- [Everyday commands](#everyday-commands)
- [Quality gate](#quality-gate)
- [Repository layout](#repository-layout)
- [Building the mobile app](#building-the-mobile-app)
- [Working with AI coding agents](#working-with-ai-coding-agents)
- [Documentation](#documentation)

---

## Why this kit

Most starters stop at a login page. This one is the foundation other products are built on, so every
concern a real product meets is already solved, tested and documented:

- **One contract, everywhere.** Every request and response shape is a Zod schema in
  `@workspace/shared`. The API validates with it, the frontends and the phone validate with the same
  schema, and Swagger and the generated API reference come from it. A change to a shape is one edit
  that the compiler carries to every app.
- **Security that is enforced, not hoped for.** Server-side authorization on every endpoint (roles,
  grants, ownership, store scope), PostgreSQL row-level security as the last line of defence,
  httpOnly cookies per app, MFA, rate limits, CSRF protection and an append-only audit log of every
  state-changing request.
- **Multi-tenant by design.** Tenant isolation in the URL, the service layer and the database (RLS),
  with a switch for single-tenant products.
- **Reliable messaging.** A transactional outbox feeds Kafka; BullMQ on Redis runs background jobs;
  every payment-like operation is idempotent.
- **Operable from day one.** Structured logs with correlation ids and stack traces, health checks, an
  operations console (servers, dependencies, alerts, backups, load tests) and a local CI that runs
  exactly what CI runs.
- **Built to be extended by people and by AI agents.** A rulebook in `rules/`, 70 architecture
  decision records, a golden reference implementation and a completion gate (`lint` + `test`) that
  every change must pass.

## Screenshots

Every screen below is the starter kit as it ships, running against the seeded demo data. Click a section's **More** to see the rest.

### Web: the customer app (`:3000`)

Customers browse local rewards, claim them and redeem them in store with a QR code.

<p align="center"><img src="./docs/images/readme/web-landing.webp" alt="Public landing page" width="100%" /></p>

<details>
<summary><strong>More Web screens (9)</strong></summary>
<br />

<table>
<tr>
<td width="50%"><img src="./docs/images/readme/web-dashboard.webp" alt="Browse rewards, filtered by city and category" /><br /><sub>Browse rewards, filtered by city and category</sub></td>
<td width="50%"><img src="./docs/images/readme/web-dashboard-dark.webp" alt="The same page in dark mode" /><br /><sub>The same page in dark mode</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/web-wallet.webp" alt="Wallet: every claim and its status" /><br /><sub>Wallet: every claim and its status</sub></td>
<td width="50%"><img src="./docs/images/readme/web-activity.webp" alt="My activity: spending, visits and rewards over time" /><br /><sub>My activity: spending, visits and rewards over time</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/web-referrals.webp" alt="Referrals: a personal code and who used it" /><br /><sub>Referrals: a personal code and who used it</sub></td>
<td width="50%"><img src="./docs/images/readme/web-account.webp" alt="Account: profile picture, email, password, two-factor" /><br /><sub>Account: profile picture, email, password, two-factor</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/web-login.webp" alt="Sign in, with one-click demo accounts in development" /><br /><sub>Sign in, with one-click demo accounts in development</sub></td>
<td width="50%"><img src="./docs/images/readme/web-signup.webp" alt="Sign up, with an optional referral code" /><br /><sub>Sign up, with an optional referral code</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/web-landing-dark.webp" alt="Landing page in dark mode" /><br /><sub>Landing page in dark mode</sub></td>
<td width="50%"><img src="./docs/images/readme/web-landing-dark.webp" alt="Landing page in dark mode" /><br /><sub>Landing page in dark mode</sub></td>
</tr>
</table>

</details>

### Admin: the platform panel (`:3001`)

The platform team runs everything from here: users, merchants, the catalogue, rewards review, the audit log, emails and the operations console.

<p align="center"><img src="./docs/images/readme/admin-home.webp" alt="Overview: platform sales and merchants" width="100%" /></p>

<details>
<summary><strong>More Admin screens (20)</strong></summary>
<br />

<table>
<tr>
<td width="50%"><img src="./docs/images/readme/admin-home-dark.webp" alt="Overview in dark mode" /><br /><sub>Overview in dark mode</sub></td>
<td width="50%"><img src="./docs/images/readme/admin-analytics.webp" alt="Analytics across every merchant" /><br /><sub>Analytics across every merchant</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/admin-users.webp" alt="Users: roles, referrers and access" /><br /><sub>Users: roles, referrers and access</sub></td>
<td width="50%"><img src="./docs/images/readme/admin-merchants.webp" alt="Merchants: verification and status" /><br /><sub>Merchants: verification and status</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/admin-rewards-review.webp" alt="Rewards waiting for review" /><br /><sub>Rewards waiting for review</sub></td>
<td width="50%"><img src="./docs/images/readme/admin-catalog-products.webp" alt="Catalogue: products with filters and export" /><br /><sub>Catalogue: products with filters and export</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/admin-audit-logs.webp" alt="Audit log: every request and database change in one timeline" /><br /><sub>Audit log: every request and database change in one timeline</sub></td>
<td width="50%"><img src="./docs/images/readme/admin-audit-logs-dark.webp" alt="Audit log in dark mode" /><br /><sub>Audit log in dark mode</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/admin-emails.webp" alt="Email templates with a live preview and test send" /><br /><sub>Email templates with a live preview and test send</sub></td>
<td width="50%"><img src="./docs/images/readme/admin-operations-servers.webp" alt="Operations: live server metrics and open alerts" /><br /><sub>Operations: live server metrics and open alerts</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/admin-operations-servers-dark.webp" alt="Operations in dark mode" /><br /><sub>Operations in dark mode</sub></td>
<td width="50%"><img src="./docs/images/readme/admin-operations-alerts.webp" alt="Alerts and their thresholds" /><br /><sub>Alerts and their thresholds</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/admin-operations-backups.webp" alt="Database backups and their schedule" /><br /><sub>Database backups and their schedule</sub></td>
<td width="50%"><img src="./docs/images/readme/admin-operations-load-tests.webp" alt="Load tests: runs compared side by side" /><br /><sub>Load tests: runs compared side by side</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/admin-geography.webp" alt="Geography reference data" /><br /><sub>Geography reference data</sub></td>
<td width="50%"><img src="./docs/images/readme/admin-settings-access.webp" alt="Access control: roles and permissions" /><br /><sub>Access control: roles and permissions</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/admin-account-security.webp" alt="Account security: password and two-factor" /><br /><sub>Account security: password and two-factor</sub></td>
<td width="50%"><img src="./docs/images/readme/admin-components.webp" alt="The component gallery for the UI kit" /><br /><sub>The component gallery for the UI kit</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/admin-kanban.webp" alt="A kanban board built from the kit" /><br /><sub>A kanban board built from the kit</sub></td>
<td width="50%"><img src="./docs/images/readme/admin-login.webp" alt="Admin sign-in" /><br /><sub>Admin sign-in</sub></td>
</tr>
</table>

</details>

### Merchant: the portal for businesses (`:3003`)

Each business works inside its own tenant (`/t/<tenant>/…`): rewards, redemptions, stores, POS terminals, API keys and its team.

<p align="center"><img src="./docs/images/readme/merchant-dashboard.webp" alt="Tenant dashboard" width="100%" /></p>

<details>
<summary><strong>More Merchant screens (13)</strong></summary>
<br />

<table>
<tr>
<td width="50%"><img src="./docs/images/readme/merchant-dashboard-dark.webp" alt="Tenant dashboard in dark mode" /><br /><sub>Tenant dashboard in dark mode</sub></td>
<td width="50%"><img src="./docs/images/readme/merchant-analytics.webp" alt="Analytics for the tenant's stores" /><br /><sub>Analytics for the tenant's stores</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/merchant-analytics-dark.webp" alt="Analytics in dark mode" /><br /><sub>Analytics in dark mode</sub></td>
<td width="50%"><img src="./docs/images/readme/merchant-rewards.webp" alt="Rewards: live, in review, drafts and ended" /><br /><sub>Rewards: live, in review, drafts and ended</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/merchant-reward-new.webp" alt="Creating a reward, with a live customer preview" /><br /><sub>Creating a reward, with a live customer preview</sub></td>
<td width="50%"><img src="./docs/images/readme/merchant-redemptions.webp" alt="Redemptions at the counter" /><br /><sub>Redemptions at the counter</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/merchant-terminals.webp" alt="POS terminals and their pairing" /><br /><sub>POS terminals and their pairing</sub></td>
<td width="50%"><img src="./docs/images/readme/merchant-api-keys.webp" alt="POS API keys, scoped to stores" /><br /><sub>POS API keys, scoped to stores</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/merchant-team.webp" alt="Team: members and what each role can do" /><br /><sub>Team: members and what each role can do</sub></td>
<td width="50%"><img src="./docs/images/readme/merchant-roles.webp" alt="Roles, editable per tenant" /><br /><sub>Roles, editable per tenant</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/merchant-settings.webp" alt="Business profile and support access" /><br /><sub>Business profile and support access</sub></td>
<td width="50%"><img src="./docs/images/readme/merchant-branding.webp" alt="Store branding" /><br /><sub>Store branding</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/merchant-login.webp" alt="Merchant sign-in" /><br /><sub>Merchant sign-in</sub></td>
<td width="50%"><img src="./docs/images/readme/merchant-login.webp" alt="Merchant sign-in" /><br /><sub>Merchant sign-in</sub></td>
</tr>
</table>

</details>

### Docs: the documentation site (`:3002`)

The Astro site renders `docs/` and `blog/`: guides, the user guide, the generated API reference and every ADR, with search.

<p align="center"><img src="./docs/images/readme/docs-home.webp" alt="Learning Center home" width="100%" /></p>

<details>
<summary><strong>More Docs screens (9)</strong></summary>
<br />

<table>
<tr>
<td width="50%"><img src="./docs/images/readme/docs-home-dark.webp" alt="Home in dark mode" /><br /><sub>Home in dark mode</sub></td>
<td width="50%"><img src="./docs/images/readme/docs-getting-started.webp" alt="Getting started" /><br /><sub>Getting started</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/docs-architecture.webp" alt="Architecture" /><br /><sub>Architecture</sub></td>
<td width="50%"><img src="./docs/images/readme/docs-architecture-dark.webp" alt="Architecture in dark mode" /><br /><sub>Architecture in dark mode</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/docs-context-map.webp" alt="The bounded-context map" /><br /><sub>The bounded-context map</sub></td>
<td width="50%"><img src="./docs/images/readme/docs-adr.webp" alt="An architecture decision record" /><br /><sub>An architecture decision record</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/docs-api-reference.webp" alt="Generated API reference" /><br /><sub>Generated API reference</sub></td>
<td width="50%"><img src="./docs/images/readme/docs-user-guide.webp" alt="User guide for operators" /><br /><sub>User guide for operators</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/docs-blog.webp" alt="Engineering blog" /><br /><sub>Engineering blog</sub></td>
<td width="50%"><img src="./docs/images/readme/docs-blog.webp" alt="Engineering blog" /><br /><sub>Engineering blog</sub></td>
</tr>
</table>

</details>

### Mobile: the Expo app (iOS and Android)

The same API and the same Zod contract, on the phone: sign-in with demo accounts, a home with highlights, analytics, the till's QR scanner, an in-app PDF viewer with search, and four themes. Captured from a release APK on an Android emulator.

<table>
<tr>
<td width="25%"><img src="./docs/images/readme/mobile-onboarding.webp" alt="Onboarding" /><br /><sub>Onboarding</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-sign-in.webp" alt="Sign in" /><br /><sub>Sign in</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-home.webp" alt="Home" /><br /><sub>Home</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-analytics.webp" alt="Analytics" /><br /><sub>Analytics</sub></td>
</tr>
</table>

<details>
<summary><strong>More mobile screens (11)</strong></summary>
<br />

<table>
<tr>
<td width="25%"><img src="./docs/images/readme/mobile-profile.webp" alt="Profile" /><br /><sub>Profile</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-settings.webp" alt="Settings" /><br /><sub>Settings</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-security.webp" alt="Security" /><br /><sub>Security</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-devices.webp" alt="Signed-in devices" /><br /><sub>Signed-in devices</sub></td>
</tr>
<tr>
<td width="25%"><img src="./docs/images/readme/mobile-till.webp" alt="Till: pair this phone as a POS" /><br /><sub>Till: pair this phone as a POS</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-pdf.webp" alt="PDF viewer" /><br /><sub>PDF viewer</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-pdf-search.webp" alt="PDF search with highlights" /><br /><sub>PDF search with highlights</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-home-dark.webp" alt="Home, dark theme" /><br /><sub>Home, dark theme</sub></td>
</tr>
<tr>
<td width="25%"><img src="./docs/images/readme/mobile-analytics-dark.webp" alt="Analytics, dark theme" /><br /><sub>Analytics, dark theme</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-settings-dark.webp" alt="Settings, dark theme" /><br /><sub>Settings, dark theme</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-home-nord.webp" alt="Home, Nord theme" /><br /><sub>Home, Nord theme</sub></td>
</tr>
</table>

</details>

## What's inside

| Surface | Package | Port | What it is |
| --- | --- | --- | --- |
| **API** | `@workspace/api` | `8080` | NestJS 12 on Fastify: every endpoint, authentication, authorization, Prisma, queues, the outbox. Swagger at `/v1/docs`. |
| **Web** | `@workspace/web` | `3000` | The customer app: public landing, sign-up, wallet, rewards, referrals and activity. |
| **Admin** | `@workspace/admin` | `3001` | The platform panel: users, merchants, catalogue, rewards review, audit log, emails, operations console, settings. |
| **Docs** | `@workspace/docs` | `3002` | The Astro documentation site for `docs/` and the blog. |
| **Merchant** | `@workspace/merchant` | `3003` | The merchant portal: dashboard, rewards, redemptions, stores, terminals, API keys, team and roles. |
| **Mobile** | `@workspace/mobile` | `8081` (Metro) | The Expo (SDK 58) app for iOS and Android: sign-in, app lock, the till's QR scanner, an in-app PDF viewer, analytics and settings. |
| **Analytics consumer** | `@workspace/analytics-consumer` | — | A Kafka consumer that turns outbox events into analytics rows, with an inbox for exactly-once handling. |
| **AWS infrastructure** | `@workspace/aws-infrastructure` | — | A CDK stack for object storage: S3 buckets, CloudFront and the API's upload user. |

Shared packages keep every surface consistent:

| Package | What it holds |
| --- | --- |
| `@workspace/shared` | **The contract.** Zod schemas, the API route registry, permissions and pure helpers. |
| `@workspace/client` | The typed API client (TanStack Query), auth and session, `can()`, shared auth forms. |
| `@workspace/api-client` | The framework-free HTTP client the apps and the phone share. |
| `@workspace/ui` | Presentational, data-agnostic web components (shadcn and ReUI based, TanStack Table and Virtual). |
| `@workspace/ui-native` | The same idea for React Native: the mobile UI kit. |
| `@workspace/tokens` | Design tokens (colour, type, radius, motion) generated into CSS for the web and the phone, plus the brand mark. |
| `@workspace/messaging` | Reusable Redis, BullMQ, Kafka and RabbitMQ wiring. |
| `@workspace/tooling` | Repository scripts: `ci:local`, secret scan, migration-history check, dependency policy. |

## Tech stack

| Layer | Technology |
| --- | --- |
| **API** | [NestJS](https://nestjs.com) 12 on [Fastify](https://fastify.dev), CQRS, domain-driven bounded contexts |
| **Web apps** | [Next.js](https://nextjs.org) 16 (App Router), [React](https://react.dev) 19, [Tailwind CSS](https://tailwindcss.com) 4, shadcn/ui and ReUI |
| **Mobile** | [Expo](https://expo.dev) SDK 58, React Native 0.88, Expo Router, Uniwind, Reanimated |
| **Docs** | [Astro](https://astro.build) |
| **Contracts and validation** | [Zod](https://zod.dev) 4, shared by the API, the browser and the phone |
| **Data fetching and forms** | [TanStack](https://tanstack.com) Query, Form, Table and Virtual; Zustand; nuqs for URL state |
| **Database** | [PostgreSQL](https://www.postgresql.org) 18 with row-level security, [Prisma](https://www.prisma.io) 7 |
| **Messaging and jobs** | Transactional outbox, [Kafka](https://kafka.apache.org) 4, [BullMQ](https://bullmq.io) on [Redis](https://redis.io) 8, RabbitMQ |
| **Email** | React Email templates, [Resend](https://resend.com) in production, [Mailpit](https://mailpit.axllent.org) locally |
| **Storage** | Local disk, AWS S3 + CloudFront or Firebase Storage, behind one port, with direct browser uploads |
| **Language and tooling** | [TypeScript](https://www.typescriptlang.org) 7, [Oxlint](https://oxc.rs) and Oxfmt, Vitest, Jest, Playwright |
| **Monorepo** | [Turborepo](https://turborepo.com) 2 + [pnpm](https://pnpm.io) 12 workspaces, syncpack |

**Data flow:** `PostgreSQL → Prisma → Zod (shared) → NestJS → Next.js / Expo (smart components) → UI (presentational props)`

## Architecture at a glance

```mermaid
flowchart LR
    subgraph Clients
      W[Web :3000]
      A[Admin :3001]
      M[Merchant :3003]
      P[Mobile app]
      T[POS till<br/>X-API-Key]
    end
    W & A & M -->|httpOnly cookies| API[NestJS API :8080<br/>Fastify]
    P -->|Bearer tokens| API
    T -->|API key| API
    API --> PG[(PostgreSQL 18<br/>row-level security)]
    API --> R[(Redis<br/>caches, rate limits, BullMQ)]
    API -->|outbox| K[(Kafka)]
    K --> C[analytics-consumer] --> PG
    API -->|signed URLs| S[(Object storage)]
    W & A & M -.direct upload.-> S
```

Every request goes through the same pipeline: request context and correlation id, authentication,
authorization, Zod validation of params, query and body, a transaction with the caller's tenant and
store scope set for row-level security, then a response contract check and an audit-log row.
Dependencies only point down: `@workspace/ui` never imports data code, the frontends never import
Prisma or NestJS, and Oxlint import-boundary rules enforce it. More in
[Architecture](./docs/technical/architecture.md) and the [context map](./docs/architecture/context-map.md).

## Domain-driven design, CQRS and multi-tenancy

The API is a **modular monolith**: one deployable, split into bounded contexts that own their own
language, data and rules ([ADR 058](./docs/adr/058-ddd-modular-monolith-bounded-contexts.md)).

### Bounded contexts

Each context lives in `apps/api/src/contexts/<name>/` and is layered the same way:

```text
contexts/claims/
├── domain/           aggregates, value objects, domain events, policies, errors, repository ports
├── application/      commands, queries, event handlers, application services, ports
├── infrastructure/   Prisma repositories and adapters behind the ports
├── presentation/     controllers and jobs: HTTP and scheduler entry points
├── claims.module.ts
└── public-api.ts     the only file another context may import
```

The contexts are `identity`, `authorization`, `tenancy`, `catalog`, `rewards`, `claims`, `pos`,
`referrals`, `reporting`, `notifications`, `files`, `audit`, `operations`, `reference-data`,
`integrations-github` and `kanban`. Dependencies point inward: the domain imports nothing from
NestJS or Prisma, and contexts talk to each other only through a `public-api.ts` or an integration
event. The [context map](./docs/architecture/context-map.md) draws who depends on whom.

- **Aggregates** guard their invariants and record **domain events** as they change.
- **Value objects** carry the rules of a single value (money, codes, slugs) and are validated with Zod.
- **Repositories** are ports in the domain with Prisma adapters in infrastructure, so the domain is
  tested without a database.

### CQRS, where it pays

CQRS is applied selectively ([ADR 059](./docs/adr/059-selective-cqrs-and-event-mechanisms.md)):

| Use case | Shape |
| --- | --- |
| Changes state, enforces an invariant or emits an event | a **command** and its handler |
| Reads a model that is not the aggregate (lists, reports, dashboards) | a **query** and its handler |
| Plain CRUD with neither | an **application service** |

Scheduled jobs and workers enter through a `SystemCommandDispatcher`, so a cron tick runs the same
command a user request would. Events are three separate mechanisms, never one:

1. **Domain events**, published inside the same database transaction as the change.
2. **In-process integration events**, dispatched to other contexts after the commit.
3. **The transactional outbox**, the only path out of the process (Kafka, durable email), so nothing is
   lost when the process crashes between the commit and the send
   ([ADR 015](./docs/adr/015-transactional-outbox-and-inbox.md), [ADR 060](./docs/adr/060-durable-email-through-outbox.md)).

Every list endpoint issues the same number of SQL statements for a page of 1 or 25 rows, and a test
proves it.

### Multi-tenancy and tenant isolation

Isolation is enforced at every layer, not trusted to one
([ADR 062](./docs/adr/062-tenancy-modes-and-isolation.md),
[multi-tenancy plan](./docs/architecture/multi-tenancy-plan.md)):

- **Two modes, one code path.** `TENANCY_ENABLED=true` runs multi-tenant with no default tenant;
  `false` runs a single-tenant product against a boot-verified `DEFAULT_TENANT_ID`.
- **The tenant comes from the route or the credential, never the body.** User requests carry it in
  `/tenants/:tenantSlug/…`; machine requests (POS tills, API keys) carry it in the credential. A
  `tenantId` in a request is rejected, and another tenant's resource answers `404`, not `403`.
- **PostgreSQL row-level security as the last line.** Every request runs in a transaction whose
  settings name the user, tenant and store scope. `FORCE ROW LEVEL SECURITY` is on every tenant table,
  the runtime role provably cannot bypass it (checked at boot and in CI), and composite
  `(tenantId, id)` foreign keys stop cross-tenant references.
- **No silent bypass.** Platform staff act on a tenant only through an approved, time-limited support
  access grant, and impersonation needs one too. Every system job names the tables it touches.
- **Authorization on top.** Roles and permissions per tenant, temporary or permanent extra
  permissions per member (for example 48 hours for a cashier), sharing of single resources and store
  scope ([ADR 067](./docs/adr/067-unified-authorization-model.md), [authorization](./docs/technical/authorization/overview.md)).
- **Proved by tests.** The end-to-end suites run in multi-tenant mode on a shared two-tenant fixture,
  with a targeted single-tenant suite and an RLS suite under the runtime database role.

## The reference product

The kit ships a working multi-tenant **rewards platform** so every pattern is exercised end to end:

- **Merchants** onboard, verify, add stores and terminals, invite a team and define custom roles.
- **Rewards** are created, reviewed by the platform, claimed by customers and redeemed at a POS till
  (QR code or backup code), idempotently.
- **Referrals** credit the referrer and notify both sides.
- **Analytics** flow from the outbox through Kafka into reports for merchants and the platform.
- **The platform team** manages users, merchants, the catalogue, emails, the audit log and the
  operations console (live servers, dependencies, alerts, backups and load tests).

Replace it with your own domain, or keep the parts you need. The
[user guide](./docs/user-guide/README.md) walks through every flow with flowcharts.

## Quick start

**Prerequisites**

- **Node 24.22.1** (`nvm use` reads `.nvmrc`) and **pnpm 12**
- **PostgreSQL 18**, installed natively
- **Docker**, for the rest of the local stack: `pnpm docker:up` starts Redis, Kafka, RabbitMQ, Bull
  Board and the Mailpit inbox ([local infrastructure](./docs/technical/operations/local-infrastructure.md))
- For the phone: **Expo Go** (SDK 58), or an Android emulator / iOS Simulator

```bash
# 1. Install dependencies and build the shared contract
pnpm setup

# 2. Environment files (macOS / Linux; on Windows use Copy-Item)
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/admin/.env.example apps/admin/.env
cp apps/merchant/.env.example apps/merchant/.env
cp apps/mobile/.env.example apps/mobile/.env
# then fill in the secrets and DATABASE_URL in apps/api/.env

# 3. Create the database named in DATABASE_URL, then start the local stack
pnpm docker:up

# 4. Build shared → generate the Prisma client → deploy migrations → apply RLS → seed
pnpm setup:db

# 5. Start web, admin, merchant, docs and the API
pnpm dev

# 6. Optional: the mobile app in Expo Go
pnpm dev:mobile
```

Open `http://localhost:3000` (web), `:3001` (admin), `:3003` (merchant), `:3002` (docs) and the API's
Swagger at `http://localhost:8080/v1/docs`. The full walk-through, including troubleshooting, is in
[Getting started](./docs/technical/getting-started.md).

### Rebuild the dev database (and keep your GitHub token)

The superadmin's GitHub token is stored encrypted in the database, so a rebuild deletes it unless you
carry it across. With the dev servers stopped:

```bash
pnpm kill:all                                              # stop the dev servers and Metro
pnpm tools db:carry-github-link -- export                  # save the link (skip if none is linked)
pnpm db:reset                                              # drop, migrate, generate, apply RLS, seed
pnpm tools db:carry-github-link -- import --in ~/.starter-kit/github-link.json
pnpm dev
```

The import works while `GITHUB_CREDENTIAL_ENCRYPTION_KEYS` in `apps/api/.env` still holds the key it
was saved under. Otherwise, link a token again under **Account → GitHub token** in the admin panel.

## Demo accounts

In development every login page lists the seeded demo accounts as one-click buttons. Sign-in codes and
verification links arrive in Mailpit; read them from the terminal with
`pnpm mail:latest --to <email> --code`.

| App | Email | Password |
| --- | --- | --- |
| Admin | `superadmin@example.com` | `SuperAdmin@123` |
| Admin (platform developer) | `developer@example.com` | `Developer@123` |
| Merchant | `brew.owner@kl-rewards.demo` | `BrewOwner@123` |
| Mobile | the same accounts, as quick sign-in buttons | |

A release build of the mobile app offers them only when built with `EXPO_PUBLIC_SHOW_DEMO_ACCOUNT=true`
(an internal test build, never a store build).

## Everyday commands

The root `package.json` holds what you run every day. `pnpm tools` lists the occasional commands,
grouped and described, and `pnpm tools <name>` runs one.

| Command | What it does |
| --- | --- |
| `pnpm setup` | Install dependencies and build `@workspace/shared` |
| `pnpm setup:db` | First-time database: build shared, generate, deploy migrations, apply RLS, seed |
| `pnpm dev` | Start every dev server (Turbo) |
| `pnpm dev:web` / `dev:admin` / `dev:merchant` / `dev:api` / `dev:mobile` | Start one app |
| `pnpm build` | Build every workspace |
| `pnpm format` / `lint` / `typecheck` / `test` | Format and the quality checks across the monorepo |
| `pnpm test:e2e` | The API and analytics-consumer end-to-end suites |
| `pnpm ci:local` | Run what CI runs, locally, including the browser suites |
| `pnpm db:migrate` / `db:migrate:create` / `db:generate` / `db:seed` / `db:studio` / `db:reset` | Database ([database guide](./docs/technical/database.md)) |
| `pnpm db:seed -- --scenario empty\|development\|enterprise [--seed <n>]` | Seed a specific dataset |
| `pnpm docker:up` / `docker:down` | The local infrastructure |
| `pnpm mailpit` / `mail:latest` | Start the local inbox alone, and print the newest email in it |
| `pnpm kill:all` | Stop whatever is listening on the dev ports 3000–3003, 8080 (API) and 8081 (Metro) |
| `pnpm tools` | List the occasional commands: database checks, tunnels, generators, dependency hygiene |

## Quality gate

A change is done when this passes, at the repository root, after the last edit:

```bash
pnpm run lint    # zero errors
pnpm run test    # every test passes
```

CI also runs typecheck, build, bundle budgets, the RLS manifest check, dependency and migration
history checks, a dependency audit, a secret scan, the docs link check, the database and API end-to-end
suites (on throwaway databases) and the browser suites. `pnpm ci:local` runs the same set locally.
Suppressions (`oxlint-disable`, `@ts-ignore`), skipped tests and weakened assertions are not allowed;
see [CI and quality gates](./rules/13-ci-cd-and-quality-gates.md).

## Repository layout

```text
apps/
├── api/                  NestJS + Prisma API (Fastify, CQRS, bounded contexts in src/contexts/)
├── web/                  Customer app (Next.js)
├── admin/                Platform admin panel (Next.js)
├── merchant/             Merchant portal (Next.js)
├── docs/                 Documentation site (Astro)
├── mobile/               Expo app (Expo Router, Uniwind, local native modules)
├── analytics-consumer/   Kafka consumer → analytics
├── aws-infrastructure/   CDK stack for object storage
├── load-runner/          Load-test runner used by the operations console
└── server-agent/         Host agent reporting server metrics

packages/
├── shared/               Zod schemas, routes, permissions: the contract
├── client/               Typed API client, auth, can()
├── api-client/           Framework-free HTTP client
├── ui/                   Web UI kit (presentational only)
├── ui-native/            Mobile UI kit
├── tokens/               Design tokens and the brand mark
├── messaging/            Redis, BullMQ, Kafka, RabbitMQ wiring
├── tooling/              ci:local and repository checks
├── oxlint-config/        Lint presets and custom rules
└── typescript-config/    Compiler presets

docs/                     User guide, technical docs, ADRs, generated API reference
rules/                    The engineering rulebook (start with 00-non-negotiables.md)
```

## Building the mobile app

Day to day the app runs in Expo Go. For an installable app (an APK for testers, an AAB for Google Play,
an iOS build, or a test APK that talks to the API on your machine over Wi-Fi or your phone's hotspot),
follow [Building installable apps](./docs/technical/mobile/building-installable-apps.md). The same
guide is kept identical in the companion Expo boilerplate repository.

## Working with AI coding agents

The repository is maintained with AI coding agents (Claude Code, Cursor, Codex, Copilot) in the loop.

- [`AGENTS.md`](./AGENTS.md) is the entry point: it routes each kind of task to the rules it needs.
- [`rules/`](./rules) holds the rulebook: non-negotiables, architecture, backend, web, mobile,
  contracts, testing, security, observability and more, with decision trees and an anti-pattern
  catalogue.
- Every task ends with the completion gate above, and the result is reported honestly.

## Documentation

Start with **[Getting started](./docs/technical/getting-started.md)**, then
**[Architecture](./docs/technical/architecture.md)**. The full index is
**[docs/README.md](./docs/README.md)**:

| You are… | Start with |
| --- | --- |
| Operating the platform (admin, merchant, support) | [User guide](./docs/user-guide/README.md) |
| An engineer building on the kit | [Technical documentation](./docs/technical/README.md) |
| Integrating with the API | [API reference](./docs/technical/api-reference/README.md) |
| Asking "why is it built this way?" | [Architecture decision records](./docs/adr/README.md) |
| An AI coding agent | [`AGENTS.md`](./AGENTS.md) and [`rules/`](./rules) |

The docs site (`pnpm dev`, then `http://localhost:3002`) renders the same folder.

The README banner is `docs/assets/readme-banner.png`. The social preview image shown when the repository
link is shared is `docs/assets/og-image.png` (1280×640 PNG, under 1 MB); GitHub reads it from
**Settings → General → Social preview**, so upload it there once.

---

<p align="center">
  <sub>NestJS · Next.js · Expo · PostgreSQL. Typed from the database to the browser and the phone.</sub>
</p>
