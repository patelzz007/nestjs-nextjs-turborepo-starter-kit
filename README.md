<p align="center">
  <img src="./docs/images/readme-banner.png" alt="One contract, every surface: a NestJS API, three Next.js apps, an Astro docs site and an Expo app, typed end to end by shared Zod schemas in one Turborepo" width="100%" />
</p>

<p align="center">
  A production-grade <strong>NestJS + Next.js + Expo</strong> monorepo: one NestJS API on Fastify, three Next.js apps, a TanStack Start docs site and an Expo mobile app, all typed end to end by one set of Zod schemas. It ships with a complete reference product (a multi-tenant rewards platform) so every pattern is shown working, not described.
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
- [Environment variables](#environment-variables)
- [Getting keys for outside services](#getting-keys-for-outside-services)
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
<summary><strong>More Web screens (19)</strong></summary>
<br />

<table>
<tr>
<td width="50%"><img src="./docs/images/readme/web-dashboard.webp" alt="Browse rewards, filtered by city and category" /><br /><sub>Browse rewards, filtered by city and category</sub></td>
<td width="50%"><img src="./docs/images/readme/web-dashboard-dark.webp" alt="The same page in dark mode" /><br /><sub>The same page in dark mode</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/web-dashboard-nord.webp" alt="The same page in Nord" /><br /><sub>The same page in Nord</sub></td>
<td width="50%"><img src="./docs/images/readme/web-reward.webp" alt="One reward: how it works and how to claim it" /><br /><sub>One reward: how it works and how to claim it</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/web-wallet.webp" alt="Wallet: every claim and its status" /><br /><sub>Wallet: every claim and its status</sub></td>
<td width="50%"><img src="./docs/images/readme/web-wallet-dark.webp" alt="Wallet in dark mode" /><br /><sub>Wallet in dark mode</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/web-activity.webp" alt="My activity: spending, visits and rewards over time" /><br /><sub>My activity: spending, visits and rewards over time</sub></td>
<td width="50%"><img src="./docs/images/readme/web-activity-dark.webp" alt="My activity in dark mode" /><br /><sub>My activity in dark mode</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/web-referrals.webp" alt="Referrals: a personal code and who used it" /><br /><sub>Referrals: a personal code and who used it</sub></td>
<td width="50%"><img src="./docs/images/readme/web-account.webp" alt="Account: profile picture, email, password, two-factor" /><br /><sub>Account: profile picture, email, password, two-factor</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/web-notifications.webp" alt="Notifications inbox" /><br /><sub>Notifications inbox</sub></td>
<td width="50%"><img src="./docs/images/readme/web-notification-settings.webp" alt="What reaches you, and where" /><br /><sub>What reaches you, and where</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/web-login.webp" alt="Sign in, with one-click demo accounts in development" /><br /><sub>Sign in, with one-click demo accounts in development</sub></td>
<td width="50%"><img src="./docs/images/readme/web-login-dark.webp" alt="Sign in, dark mode" /><br /><sub>Sign in, dark mode</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/web-signup.webp" alt="Sign up, with an optional referral code" /><br /><sub>Sign up, with an optional referral code</sub></td>
<td width="50%"><img src="./docs/images/readme/web-forgot-password.webp" alt="Reset a password" /><br /><sub>Reset a password</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/web-status.webp" alt="Public service status page" /><br /><sub>Public service status page</sub></td>
<td width="50%"><img src="./docs/images/readme/web-landing-dark.webp" alt="Landing page in dark mode" /><br /><sub>Landing page in dark mode</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/web-landing-nord.webp" alt="Landing page in Nord" /><br /><sub>Landing page in Nord</sub></td>
<td width="50%"></td>
</tr>
</table>

</details>

### Admin: the platform panel (`:3001`)

The platform team runs everything from here: users, merchants, the catalogue, rewards review, the audit log, emails and the operations console.

<p align="center"><img src="./docs/images/readme/admin-home.webp" alt="Overview: platform sales and merchants" width="100%" /></p>

<details>
<summary><strong>More Admin screens (56)</strong></summary>
<br />

<table>
<tr>
<td width="50%"><img src="./docs/images/readme/admin-home-dark.webp" alt="Overview in dark mode" /><br /><sub>Overview in dark mode</sub></td>
<td width="50%"><img src="./docs/images/readme/admin-home-nord.webp" alt="Overview in Nord" /><br /><sub>Overview in Nord</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/admin-analytics.webp" alt="Analytics across every merchant" /><br /><sub>Analytics across every merchant</sub></td>
<td width="50%"><img src="./docs/images/readme/admin-analytics-dark.webp" alt="Analytics in dark mode" /><br /><sub>Analytics in dark mode</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/admin-users.webp" alt="Users: roles, referrers and access" /><br /><sub>Users: roles, referrers and access</sub></td>
<td width="50%"><img src="./docs/images/readme/admin-users-dark.webp" alt="Users in dark mode" /><br /><sub>Users in dark mode</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/admin-users-mfa-recovery.webp" alt="Two-factor recovery requests" /><br /><sub>Two-factor recovery requests</sub></td>
<td width="50%"><img src="./docs/images/readme/admin-users-support-access.webp" alt="Support access into merchants" /><br /><sub>Support access into merchants</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/admin-merchants.webp" alt="Merchants: verification and status" /><br /><sub>Merchants: verification and status</sub></td>
<td width="50%"><img src="./docs/images/readme/admin-merchant-invites.webp" alt="Inviting a merchant, with a live email preview" /><br /><sub>Inviting a merchant, with a live email preview</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/admin-merchant-store-requests.webp" alt="Store location requests" /><br /><sub>Store location requests</sub></td>
<td width="50%"><img src="./docs/images/readme/admin-merchant-verification.webp" alt="Business verification review" /><br /><sub>Business verification review</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/admin-rewards-review.webp" alt="Rewards waiting for review" /><br /><sub>Rewards waiting for review</sub></td>
<td width="50%"><img src="./docs/images/readme/admin-reward-review.webp" alt="Reviewing one reward" /><br /><sub>Reviewing one reward</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/admin-catalog-products.webp" alt="Catalogue: products with filters and export" /><br /><sub>Catalogue: products with filters and export</sub></td>
<td width="50%"><img src="./docs/images/readme/admin-catalog-product.webp" alt="One product" /><br /><sub>One product</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/admin-catalog-product-new.webp" alt="Adding a product" /><br /><sub>Adding a product</sub></td>
<td width="50%"><img src="./docs/images/readme/admin-catalog-categories.webp" alt="Catalogue categories" /><br /><sub>Catalogue categories</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/admin-audit-logs.webp" alt="Audit log: every request and database change in one timeline" /><br /><sub>Audit log: every request and database change in one timeline</sub></td>
<td width="50%"><img src="./docs/images/readme/admin-audit-logs-dark.webp" alt="Audit log in dark mode" /><br /><sub>Audit log in dark mode</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/admin-emails.webp" alt="Email templates with a live preview and test send" /><br /><sub>Email templates with a live preview and test send</sub></td>
<td width="50%"><img src="./docs/images/readme/admin-emails-log.webp" alt="Every email sent" /><br /><sub>Every email sent</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/admin-emails-broadcasts.webp" alt="Broadcasts to users" /><br /><sub>Broadcasts to users</sub></td>
<td width="50%"><img src="./docs/images/readme/admin-emails-broadcast-new.webp" alt="Writing a broadcast" /><br /><sub>Writing a broadcast</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/admin-operations-servers.webp" alt="Operations: live server metrics and open alerts" /><br /><sub>Operations: live server metrics and open alerts</sub></td>
<td width="50%"><img src="./docs/images/readme/admin-operations-servers-dark.webp" alt="Operations in dark mode" /><br /><sub>Operations in dark mode</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/admin-operations-server.webp" alt="One server's history and disks" /><br /><sub>One server's history and disks</sub></td>
<td width="50%"><img src="./docs/images/readme/admin-operations-alerts.webp" alt="Alerts and their thresholds" /><br /><sub>Alerts and their thresholds</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/admin-operations-backups.webp" alt="Database backups and their schedule" /><br /><sub>Database backups and their schedule</sub></td>
<td width="50%"><img src="./docs/images/readme/admin-operations-cache.webp" alt="Cache: Redis and every keyed cache" /><br /><sub>Cache: Redis and every keyed cache</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/admin-operations-queues.webp" alt="Queues and failed jobs" /><br /><sub>Queues and failed jobs</sub></td>
<td width="50%"><img src="./docs/images/readme/admin-operations-rate-limits.webp" alt="Rate limits and who is near them" /><br /><sub>Rate limits and who is near them</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/admin-operations-load-tests.webp" alt="Load tests: runs compared side by side" /><br /><sub>Load tests: runs compared side by side</sub></td>
<td width="50%"><img src="./docs/images/readme/admin-operations-load-test.webp" alt="One load test run" /><br /><sub>One load test run</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/admin-operations-status.webp" alt="Status page incidents" /><br /><sub>Status page incidents</sub></td>
<td width="50%"><img src="./docs/images/readme/admin-webhooks-received.webp" alt="Webhooks received from providers" /><br /><sub>Webhooks received from providers</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/admin-geography.webp" alt="Geography reference data" /><br /><sub>Geography reference data</sub></td>
<td width="50%"><img src="./docs/images/readme/admin-notifications.webp" alt="Notifications inbox" /><br /><sub>Notifications inbox</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/admin-notification-settings.webp" alt="Notification settings" /><br /><sub>Notification settings</sub></td>
<td width="50%"><img src="./docs/images/readme/admin-settings-access.webp" alt="Access control: roles and permissions" /><br /><sub>Access control: roles and permissions</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/admin-settings-feature-flags.webp" alt="Feature flags" /><br /><sub>Feature flags</sub></td>
<td width="50%"><img src="./docs/images/readme/admin-account-profile.webp" alt="Your profile" /><br /><sub>Your profile</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/admin-account-security.webp" alt="Account security: password and two-factor" /><br /><sub>Account security: password and two-factor</sub></td>
<td width="50%"><img src="./docs/images/readme/admin-components.webp" alt="The component gallery for the UI kit" /><br /><sub>The component gallery for the UI kit</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/admin-components-dark.webp" alt="The gallery in dark mode" /><br /><sub>The gallery in dark mode</sub></td>
<td width="50%"><img src="./docs/images/readme/admin-components-data-table.webp" alt="Data table" /><br /><sub>Data table</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/admin-components-data-grid.webp" alt="Data grid" /><br /><sub>Data grid</sub></td>
<td width="50%"><img src="./docs/images/readme/admin-components-chart.webp" alt="Charts" /><br /><sub>Charts</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/admin-components-calendar.webp" alt="Calendar" /><br /><sub>Calendar</sub></td>
<td width="50%"><img src="./docs/images/readme/admin-components-date-picker.webp" alt="Date picker" /><br /><sub>Date picker</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/admin-components-dialog.webp" alt="Dialog" /><br /><sub>Dialog</sub></td>
<td width="50%"><img src="./docs/images/readme/admin-kanban.webp" alt="A kanban board built from the kit" /><br /><sub>A kanban board built from the kit</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/admin-kanban-dark.webp" alt="Kanban in dark mode" /><br /><sub>Kanban in dark mode</sub></td>
<td width="50%"><img src="./docs/images/readme/admin-login.webp" alt="Admin sign-in" /><br /><sub>Admin sign-in</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/admin-login-dark.webp" alt="Admin sign-in, dark mode" /><br /><sub>Admin sign-in, dark mode</sub></td>
<td width="50%"><img src="./docs/images/readme/admin-forgot-password.webp" alt="Reset a password" /><br /><sub>Reset a password</sub></td>
</tr>
</table>

</details>

### Merchant: the portal for businesses (`:3003`)

Each business works inside its own tenant (`/t/<tenant>/…`): rewards, redemptions, stores, POS terminals, API keys and its team.

<p align="center"><img src="./docs/images/readme/merchant-dashboard.webp" alt="Tenant dashboard" width="100%" /></p>

<details>
<summary><strong>More Merchant screens (30)</strong></summary>
<br />

<table>
<tr>
<td width="50%"><img src="./docs/images/readme/merchant-dashboard-dark.webp" alt="Tenant dashboard in dark mode" /><br /><sub>Tenant dashboard in dark mode</sub></td>
<td width="50%"><img src="./docs/images/readme/merchant-dashboard-nord.webp" alt="Tenant dashboard in Nord" /><br /><sub>Tenant dashboard in Nord</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/merchant-analytics.webp" alt="Analytics for the tenant's stores" /><br /><sub>Analytics for the tenant's stores</sub></td>
<td width="50%"><img src="./docs/images/readme/merchant-analytics-dark.webp" alt="Analytics in dark mode" /><br /><sub>Analytics in dark mode</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/merchant-rewards.webp" alt="Rewards: live, in review, drafts and ended" /><br /><sub>Rewards: live, in review, drafts and ended</sub></td>
<td width="50%"><img src="./docs/images/readme/merchant-rewards-dark.webp" alt="Rewards in dark mode" /><br /><sub>Rewards in dark mode</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/merchant-reward.webp" alt="One reward's performance" /><br /><sub>One reward's performance</sub></td>
<td width="50%"><img src="./docs/images/readme/merchant-reward-new.webp" alt="Creating a reward, with a live customer preview" /><br /><sub>Creating a reward, with a live customer preview</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/merchant-redemptions.webp" alt="Redemptions at the counter" /><br /><sub>Redemptions at the counter</sub></td>
<td width="50%"><img src="./docs/images/readme/merchant-payments.webp" alt="Payments" /><br /><sub>Payments</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/merchant-payment.webp" alt="One payment and its checkout link" /><br /><sub>One payment and its checkout link</sub></td>
<td width="50%"><img src="./docs/images/readme/merchant-payment-new.webp" alt="Taking a new payment" /><br /><sub>Taking a new payment</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/merchant-broadcasts.webp" alt="Broadcasts to customers" /><br /><sub>Broadcasts to customers</sub></td>
<td width="50%"><img src="./docs/images/readme/merchant-broadcast-new.webp" alt="Writing a broadcast" /><br /><sub>Writing a broadcast</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/merchant-stores.webp" alt="Your stores" /><br /><sub>Your stores</sub></td>
<td width="50%"><img src="./docs/images/readme/merchant-locations.webp" alt="Store locations" /><br /><sub>Store locations</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/merchant-terminals.webp" alt="POS terminals and their pairing" /><br /><sub>POS terminals and their pairing</sub></td>
<td width="50%"><img src="./docs/images/readme/merchant-api-keys.webp" alt="POS API keys, scoped to stores" /><br /><sub>POS API keys, scoped to stores</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/merchant-webhooks.webp" alt="Outgoing webhooks" /><br /><sub>Outgoing webhooks</sub></td>
<td width="50%"><img src="./docs/images/readme/merchant-integrations.webp" alt="Integrations" /><br /><sub>Integrations</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/merchant-team.webp" alt="Team: members and what each role can do" /><br /><sub>Team: members and what each role can do</sub></td>
<td width="50%"><img src="./docs/images/readme/merchant-role.webp" alt="One role's permissions" /><br /><sub>One role's permissions</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/merchant-settings.webp" alt="Business profile and support access" /><br /><sub>Business profile and support access</sub></td>
<td width="50%"><img src="./docs/images/readme/merchant-branding.webp" alt="Store branding" /><br /><sub>Store branding</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/merchant-verification.webp" alt="Business verification" /><br /><sub>Business verification</sub></td>
<td width="50%"><img src="./docs/images/readme/merchant-banned-customers.webp" alt="Banned customers" /><br /><sub>Banned customers</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/merchant-account.webp" alt="Your account and security" /><br /><sub>Your account and security</sub></td>
<td width="50%"><img src="./docs/images/readme/merchant-login.webp" alt="Merchant sign-in" /><br /><sub>Merchant sign-in</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/merchant-login-dark.webp" alt="Merchant sign-in, dark mode" /><br /><sub>Merchant sign-in, dark mode</sub></td>
<td width="50%"><img src="./docs/images/readme/merchant-forgot-password.webp" alt="Reset a password" /><br /><sub>Reset a password</sub></td>
</tr>
</table>

</details>

### Docs: the documentation site (`:3002`)

The TanStack Start docs site renders `docs/` and `docs/blog/`, every page pre-rendered: guides, the user guide, the generated API reference and every ADR, with search and an endpoint explorer.

<p align="center"><img src="./docs/images/readme/docs-home.webp" alt="Learning Center home" width="100%" /></p>

<details>
<summary><strong>More Docs screens (20)</strong></summary>
<br />

<table>
<tr>
<td width="50%"><img src="./docs/images/readme/docs-home-dark.webp" alt="Home in dark mode" /><br /><sub>Home in dark mode</sub></td>
<td width="50%"><img src="./docs/images/readme/docs-docs-index.webp" alt="Every guide, by topic" /><br /><sub>Every guide, by topic</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/docs-getting-started.webp" alt="Getting started" /><br /><sub>Getting started</sub></td>
<td width="50%"><img src="./docs/images/readme/docs-getting-started-dark.webp" alt="Getting started in dark mode" /><br /><sub>Getting started in dark mode</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/docs-architecture.webp" alt="Architecture" /><br /><sub>Architecture</sub></td>
<td width="50%"><img src="./docs/images/readme/docs-architecture-dark.webp" alt="Architecture in dark mode" /><br /><sub>Architecture in dark mode</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/docs-context-map.webp" alt="The bounded-context map" /><br /><sub>The bounded-context map</sub></td>
<td width="50%"><img src="./docs/images/readme/docs-tenancy.webp" alt="Tenants, locations and row-level security" /><br /><sub>Tenants, locations and row-level security</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/docs-adr.webp" alt="An architecture decision record" /><br /><sub>An architecture decision record</sub></td>
<td width="50%"><img src="./docs/images/readme/docs-adr-dark.webp" alt="A decision record in dark mode" /><br /><sub>A decision record in dark mode</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/docs-api-reference.webp" alt="Generated API reference" /><br /><sub>Generated API reference</sub></td>
<td width="50%"><img src="./docs/images/readme/docs-endpoints.webp" alt="Every endpoint in one table" /><br /><sub>Every endpoint in one table</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/docs-endpoints-dark.webp" alt="Endpoints in dark mode" /><br /><sub>Endpoints in dark mode</sub></td>
<td width="50%"><img src="./docs/images/readme/docs-search.webp" alt="Search across the docs" /><br /><sub>Search across the docs</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/docs-user-guide-index.webp" alt="User guide for operators" /><br /><sub>User guide for operators</sub></td>
<td width="50%"><img src="./docs/images/readme/docs-user-guide.webp" alt="A user guide chapter" /><br /><sub>A user guide chapter</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/docs-mobile.webp" alt="The mobile app guide" /><br /><sub>The mobile app guide</sub></td>
<td width="50%"><img src="./docs/images/readme/docs-security.webp" alt="The threat model" /><br /><sub>The threat model</sub></td>
</tr>
<tr>
<td width="50%"><img src="./docs/images/readme/docs-blog.webp" alt="Engineering blog" /><br /><sub>Engineering blog</sub></td>
<td width="50%"><img src="./docs/images/readme/docs-blog-dark.webp" alt="The blog in dark mode" /><br /><sub>The blog in dark mode</sub></td>
</tr>
</table>

</details>

### Mobile: the Expo app (iOS and Android)

The same API and the same Zod contract, on the phone: a home with highlights, a drawer built from JSON and gated by capability, search across every screen, analytics, the inbox, GitHub, the servers, the till's QR scanner, the live UI kit and seven themes. Captured from a development build on an Android phone by a Maestro flow (`pnpm --filter @workspace/mobile screenshots:device`).

<table>
<tr>
<td width="25%"><img src="./docs/images/readme/mobile-home.webp" alt="Home" /><br /><sub>Home</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-drawer.webp" alt="The side menu" /><br /><sub>The side menu</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-command-palette.webp" alt="Search: jump to any screen" /><br /><sub>Search: jump to any screen</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-analytics.webp" alt="Analytics" /><br /><sub>Analytics</sub></td>
</tr>
</table>

The side menu comes in five looks, chosen in **Settings → Appearance** and saved on the device:

<p align="center"><img src="./docs/images/readme/mobile-drawer-styles.webp" alt="The mobile side menu's five looks, each in light and dark" width="100%" /></p>

<table>
<tr>
<td width="20%"><img src="./docs/images/readme/mobile-drawer-centred-dark.webp" alt="Centred dark (default)" /><br /><sub>Centred dark (default)</sub></td>
<td width="20%"><img src="./docs/images/readme/mobile-drawer-dark-cards.webp" alt="Dark with cards" /><br /><sub>Dark with cards</sub></td>
<td width="20%"><img src="./docs/images/readme/mobile-drawer-soft-sheet.webp" alt="Soft with sheet" /><br /><sub>Soft with sheet</sub></td>
<td width="20%"><img src="./docs/images/readme/mobile-drawer-centred-soft.webp" alt="Centred soft" /><br /><sub>Centred soft</sub></td>
<td width="20%"><img src="./docs/images/readme/mobile-drawer-soft-cards.webp" alt="Soft with cards" /><br /><sub>Soft with cards</sub></td>
</tr>
</table>

Beyond Light, Dark and Nord, the phone has three dark themes of its own, also in **Settings → Appearance**: Current Dark (pure greys), Harbour (a deep blue slate with a cornflower accent) and Mocha (warm coffee greys).

<table>
<tr>
<td width="25%"><img src="./docs/images/readme/mobile-theme-current-dark-home.webp" alt="Current Dark: Home" /><br /><sub>Current Dark: Home</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-theme-current-dark-drawer.webp" alt="Current Dark: side menu" /><br /><sub>Current Dark: side menu</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-theme-current-dark-analytics.webp" alt="Current Dark: Analytics" /><br /><sub>Current Dark: Analytics</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-theme-current-dark-settings.webp" alt="Current Dark: Settings" /><br /><sub>Current Dark: Settings</sub></td>
</tr>
<tr>
<td width="25%"><img src="./docs/images/readme/mobile-theme-harbour-home.webp" alt="Harbour: Home" /><br /><sub>Harbour: Home</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-theme-harbour-drawer.webp" alt="Harbour: side menu" /><br /><sub>Harbour: side menu</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-theme-harbour-analytics.webp" alt="Harbour: Analytics" /><br /><sub>Harbour: Analytics</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-theme-harbour-settings.webp" alt="Harbour: Settings" /><br /><sub>Harbour: Settings</sub></td>
</tr>
<tr>
<td width="25%"><img src="./docs/images/readme/mobile-theme-mocha-home.webp" alt="Mocha: Home" /><br /><sub>Mocha: Home</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-theme-mocha-drawer.webp" alt="Mocha: side menu" /><br /><sub>Mocha: side menu</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-theme-mocha-analytics.webp" alt="Mocha: Analytics" /><br /><sub>Mocha: Analytics</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-theme-mocha-settings.webp" alt="Mocha: Settings" /><br /><sub>Mocha: Settings</sub></td>
</tr>
</table>

<details>
<summary><strong>More mobile screens (56)</strong></summary>
<br />

<table>
<tr>
<td width="25%"><img src="./docs/images/readme/mobile-sign-in.webp" alt="Sign in, with demo accounts in development" /><br /><sub>Sign in, with demo accounts in development</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-sign-up.webp" alt="Create an account" /><br /><sub>Create an account</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-forgot-password.webp" alt="Reset a password" /><br /><sub>Reset a password</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-onboarding.webp" alt="First-run walkthrough" /><br /><sub>First-run walkthrough</sub></td>
</tr>
<tr>
<td width="25%"><img src="./docs/images/readme/mobile-onboarding-2.webp" alt="Walkthrough, second step" /><br /><sub>Walkthrough, second step</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-onboarding-3.webp" alt="Walkthrough, last step" /><br /><sub>Walkthrough, last step</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-drawer-more.webp" alt="The rest of the menu, with the build" /><br /><sub>The rest of the menu, with the build</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-analytics-more.webp" alt="Analytics: highlights" /><br /><sub>Analytics: highlights</sub></td>
</tr>
<tr>
<td width="25%"><img src="./docs/images/readme/mobile-profile.webp" alt="Profile" /><br /><sub>Profile</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-github-contributions.webp" alt="GitHub contributions" /><br /><sub>GitHub contributions</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-notifications.webp" alt="The inbox" /><br /><sub>The inbox</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-notification-settings.webp" alt="What reaches you, and where" /><br /><sub>What reaches you, and where</sub></td>
</tr>
<tr>
<td width="25%"><img src="./docs/images/readme/mobile-notification-photo.webp" alt="A notice with a 4K photo" /><br /><sub>A notice with a 4K photo</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-notification-opened.webp" alt="The opened message" /><br /><sub>The opened message</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-notification-full-photo.webp" alt="The 4K original" /><br /><sub>The 4K original</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-push-photo.webp" alt="The push, with the photo under the text" /><br /><sub>The push, with the photo under the text</sub></td>
</tr>
<tr>
<td width="25%"><img src="./docs/images/readme/mobile-search.webp" alt="Search" /><br /><sub>Search</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-home-more.webp" alt="More of Home" /><br /><sub>More of Home</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-github-account.webp" alt="GitHub account" /><br /><sub>GitHub account</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-pull-requests.webp" alt="Pull requests" /><br /><sub>Pull requests</sub></td>
</tr>
<tr>
<td width="25%"><img src="./docs/images/readme/mobile-settings.webp" alt="Settings" /><br /><sub>Settings</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-about.webp" alt="About: build, version and when it was built" /><br /><sub>About: build, version and when it was built</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-appearance.webp" alt="Appearance: theme and side menu" /><br /><sub>Appearance: theme and side menu</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-language.webp" alt="Language: four shipped" /><br /><sub>Language: four shipped</sub></td>
</tr>
<tr>
<td width="25%"><img src="./docs/images/readme/mobile-security.webp" alt="Security" /><br /><sub>Security</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-devices.webp" alt="Signed-in devices" /><br /><sub>Signed-in devices</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-app-lock.webp" alt="App lock" /><br /><sub>App lock</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-till.webp" alt="Till: pair this phone as a POS" /><br /><sub>Till: pair this phone as a POS</sub></td>
</tr>
<tr>
<td width="25%"><img src="./docs/images/readme/mobile-servers.webp" alt="Operations: the servers" /><br /><sub>Operations: the servers</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-server.webp" alt="One server's history" /><br /><sub>One server's history</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-pdf-open.webp" alt="Open a PDF" /><br /><sub>Open a PDF</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-pdf.webp" alt="The in-app PDF viewer" /><br /><sub>The in-app PDF viewer</sub></td>
</tr>
<tr>
<td width="25%"><img src="./docs/images/readme/mobile-components.webp" alt="The UI kit, live" /><br /><sub>The UI kit, live</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-components-selection.webp" alt="UI kit: selection" /><br /><sub>UI kit: selection</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-components-overlays.webp" alt="UI kit: overlays" /><br /><sub>UI kit: overlays</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-components-feedback.webp" alt="UI kit: feedback" /><br /><sub>UI kit: feedback</sub></td>
</tr>
<tr>
<td width="25%"><img src="./docs/images/readme/mobile-components-data.webp" alt="UI kit: data" /><br /><sub>UI kit: data</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-components-dates.webp" alt="UI kit: dates" /><br /><sub>UI kit: dates</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-components-media.webp" alt="UI kit: media" /><br /><sub>UI kit: media</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-sign-out.webp" alt="Confirming a sign-out" /><br /><sub>Confirming a sign-out</sub></td>
</tr>
<tr>
<td width="25%"><img src="./docs/images/readme/mobile-drawer-dark.webp" alt="The side menu, dark" /><br /><sub>The side menu, dark</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-home-dark.webp" alt="Home, dark" /><br /><sub>Home, dark</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-analytics-dark.webp" alt="Analytics, dark" /><br /><sub>Analytics, dark</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-profile-dark.webp" alt="Profile, dark" /><br /><sub>Profile, dark</sub></td>
</tr>
<tr>
<td width="25%"><img src="./docs/images/readme/mobile-notifications-dark.webp" alt="The inbox, dark" /><br /><sub>The inbox, dark</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-settings-dark.webp" alt="Settings, dark" /><br /><sub>Settings, dark</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-security-dark.webp" alt="Security, dark" /><br /><sub>Security, dark</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-servers-dark.webp" alt="Servers, dark" /><br /><sub>Servers, dark</sub></td>
</tr>
<tr>
<td width="25%"><img src="./docs/images/readme/mobile-till-dark.webp" alt="Till, dark" /><br /><sub>Till, dark</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-drawer-nord.webp" alt="The side menu, Nord" /><br /><sub>The side menu, Nord</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-home-nord.webp" alt="Home, Nord" /><br /><sub>Home, Nord</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-analytics-nord.webp" alt="Analytics, Nord" /><br /><sub>Analytics, Nord</sub></td>
</tr>
<tr>
<td width="25%"><img src="./docs/images/readme/mobile-profile-nord.webp" alt="Profile, Nord" /><br /><sub>Profile, Nord</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-notifications-nord.webp" alt="The inbox, Nord" /><br /><sub>The inbox, Nord</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-settings-nord.webp" alt="Settings, Nord" /><br /><sub>Settings, Nord</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-security-nord.webp" alt="Security, Nord" /><br /><sub>Security, Nord</sub></td>
</tr>
<tr>
<td width="25%"><img src="./docs/images/readme/mobile-servers-nord.webp" alt="Servers, Nord" /><br /><sub>Servers, Nord</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-till-nord.webp" alt="Till, Nord" /><br /><sub>Till, Nord</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-theme-current-dark-notifications.webp" alt="Current Dark: the inbox" /><br /><sub>Current Dark: the inbox</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-theme-current-dark-security.webp" alt="Current Dark: Security" /><br /><sub>Current Dark: Security</sub></td>
</tr>
<tr>
<td width="25%"><img src="./docs/images/readme/mobile-theme-harbour-notifications.webp" alt="Harbour: the inbox" /><br /><sub>Harbour: the inbox</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-theme-harbour-security.webp" alt="Harbour: Security" /><br /><sub>Harbour: Security</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-theme-mocha-notifications.webp" alt="Mocha: the inbox" /><br /><sub>Mocha: the inbox</sub></td>
<td width="25%"><img src="./docs/images/readme/mobile-theme-mocha-security.webp" alt="Mocha: Security" /><br /><sub>Mocha: Security</sub></td>
</tr>
</table>

</details>

### Notifications with attachments

Any notification can carry an optional photo or PDF, in the inbox, the push and the email. In the email it is a real attachment, and a photo also shows in the body. Run `pnpm --filter @workspace/api notifications:demo` after a seed to send yourself three 4K photos and a PDF.

<p align="center"><img src="./docs/images/readme/email-attachment.webp" alt="An email with its photo in the body and as an attachment, in Mailpit" /></p>

## What's inside

| Surface | Package | Port | What it is |
| --- | --- | --- | --- |
| **API** | `@workspace/api` | `8080` | NestJS 12 on Fastify: every endpoint, authentication, authorization, Prisma, queues, the outbox. Swagger at `/v1/docs`. |
| **Web** | `@workspace/web` | `3000` | The customer app: public landing, sign-up, wallet, rewards, referrals and activity. |
| **Admin** | `@workspace/admin` | `3001` | The platform panel: users, merchants, catalogue, rewards review, audit log, emails, operations console, settings. |
| **Docs** | `@workspace/docs` | `3002` | The documentation site for `docs/` and the blog (TanStack Start, pre-rendered). |
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
| **Docs** | [TanStack Start](https://tanstack.com/start) + Router, Query, Table and Pacer; the Markdown pipeline in `packages/docs-renderer` |
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

<p align="center">
  <img src="./docs/images/architecture.webp" alt="Architecture: the web (3000), admin (3001) and merchant (3003) apps call the NestJS API on 8080 with httpOnly cookies, the mobile app with Bearer tokens and POS tills with an X-API-Key; the API uses PostgreSQL 18 with row-level security through Prisma, Redis 8 for BullMQ queues, the cache and rate limits, Kafka through the transactional outbox, object storage through signed URLs, and the email, push and SMS providers; the analytics consumer projects Kafka events into PostgreSQL; the web apps upload files straight to object storage with presigned URLs." width="100%">
</p>

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

Follow these steps in order on a fresh clone. It takes about 10 minutes, and **you need no cloud
account**: email goes to a local inbox, uploads stay on your disk, and push notifications land in that
same inbox. Run every command from the repository root.

### 1. Install the tools

| Tool | Version | How to get it | Check |
| --- | --- | --- | --- |
| Node.js | 24.22.1 | Install [nvm](https://github.com/nvm-sh/nvm); step 2 installs the right Node | `nvm -v` |
| pnpm | 12 | Comes with Node through `corepack enable` in step 2 | Step 2 |
| Docker | Any recent | Docker Desktop, OrbStack or Colima. Keep it running | `docker compose version` |
| PostgreSQL | 18 | macOS: `brew install postgresql@18`, add its `bin` folder to your `PATH` (Homebrew prints how), then `brew services start postgresql@18` | `pg_isready -h 127.0.0.1 -p 5432` |
| Expo Go (optional) | SDK 58 | App Store or Google Play, for the phone app | Opens on your phone |

### 2. Get the code and install dependencies

```bash
git clone <your-repository-url>
cd nestjs-nextjs-turborepo-starter-kit
nvm install         # reads .nvmrc and switches to Node 24.22.1
corepack enable     # turns on the pinned pnpm
pnpm setup          # installs every package and builds the shared contract
```

### 3. Create the database

The default settings sign in to PostgreSQL as user `postgres` with password `postgres`. Check that works:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:5432/postgres" -c "select 1"
```

| If it says | Do this once |
| --- | --- |
| `role "postgres" does not exist` (usual with Homebrew) | `createuser -s postgres` |
| `password authentication failed` (usual on Linux) | `sudo -u postgres psql -c "ALTER ROLE postgres PASSWORD 'postgres'"` |
| `Connection refused` | Start PostgreSQL: `brew services start postgresql@18` |

Then create the database:

```bash
createdb -h 127.0.0.1 -U postgres nestjs-nextjs-turborepo-starter-kit
```

Prefer PostgreSQL in Docker? Follow [step 2 of Getting started](./docs/technical/getting-started.md#2-postgresql-use-yours-or-start-one-in-docker)
instead; it creates this user and database for you.

### 4. Create the `.env` files

Each app reads its own `.env`. The examples already hold working local values, so you only copy them and
generate the secrets (on Windows, use `Copy-Item` instead of `cp`):

```bash
cp apps/api/.env.example      apps/api/.env
cp apps/web/.env.example      apps/web/.env
cp apps/admin/.env.example    apps/admin/.env
cp apps/merchant/.env.example apps/merchant/.env
cp apps/mobile/.env.example   apps/mobile/.env

pnpm tools secrets:generate apps/api/.env    # fills in every secret in apps/api/.env
```

> [!WARNING]
> Run `secrets:generate` only once. Running it again changes the signing secrets, which signs everyone
> out. If you did not use the default PostgreSQL user, change `DATABASE_URL` in `apps/api/.env` now.

[Environment variables](#environment-variables) explains what each file holds.

### 5. Start the local services

```bash
pnpm docker:up      # Redis, Kafka, RabbitMQ, Bull Board and the Mailpit inbox
docker compose ps   # wait until they show as healthy
```

### 6. Fill the database

```bash
pnpm setup:db       # generates the Prisma client, runs migrations, applies RLS and seeds demo data
```

This takes 2 to 3 minutes and ends by printing the demo accounts. Run it only for a first-time setup.

### 7. Run the app

| Command | What it starts | Use it when |
| --- | --- | --- |
| `pnpm dev` | Everything: API, web, admin, merchant, docs, Metro, server agent and analytics consumer | You want it all |
| `pnpm dev:stack` | API, web and admin | Everyday work (lighter) |
| `pnpm dev:api` | The API only | Working on one app |
| `pnpm dev:web` / `dev:admin` / `dev:merchant` | One browser app. Needs the API running too | Working on one app |
| `pnpm dev:mobile` | Metro, for the phone app. Needs the API running too | Working on the phone app |
| `pnpm kill:all` | Nothing: it stops whatever is using the dev ports | A port is stuck |
| `pnpm docker:down` | Nothing: it stops the Docker services and keeps their data | You are finished for the day |

Then open:

| What | Address |
| --- | --- |
| Web (customers) | `http://localhost:3000` |
| Admin | `http://localhost:3001` |
| Merchant | `http://localhost:3003` |
| Docs | `http://localhost:3002` |
| API health check | `http://localhost:8080/health` |
| API docs (Swagger) | `http://localhost:8080/v1/docs` |
| Email inbox (Mailpit) | `http://localhost:8025` |
| Job queues (Bull Board) | `http://localhost:3030` |

> [!NOTE]
> With `pnpm dev` you will see `Invalid environment configuration for apps/analytics-consumer`. That is
> expected: this optional app stops until it has its own `.env`, and the other apps keep running. To turn
> it on, see [Optional: the analytics consumer](#optional-the-analytics-consumer).

### 8. Sign in

Pick a [demo account](#demo-accounts) on any login page. Every password sign-in then asks for a six-digit
code, because the example sets `LOGIN_VERIFICATION_MODE=always`. Find the code in Mailpit, or print it:

```bash
pnpm mail:latest --to superadmin@example.com --code
```

### 9. Optional: run the app on your phone

1. Put your phone on the same Wi-Fi as this computer.
2. In `apps/api/.env`, add `HOST=0.0.0.0`, so the API accepts connections from the phone. Use a network
   you trust, because other devices on it can reach the API too.
3. Leave `EXPO_PUBLIC_API_URL` unset. Expo Go works out this computer's address by itself.
4. Start the API with `pnpm dev:api`, and in a second terminal run `pnpm dev:mobile`.
5. Scan the QR code: with the Camera app on iPhone, or with Expo Go on Android.

### Optional: the analytics consumer

This app copies events from Kafka into the analytics tables. Set it up when you need those events:

```bash
cp apps/analytics-consumer/.env.example apps/analytics-consumer/.env
# In ANALYTICS_CONSUMER_DATABASE_URL, replace the placeholder password with your own (16+ characters)
pnpm --filter @workspace/analytics-consumer db:provision-login
pnpm --filter @workspace/analytics-consumer kafka:provision-topics
pnpm tools dev:analytics-consumer
```

Kafka topics are never created automatically, so the API's events also need `kafka:provision-topics`.

### If something goes wrong

| What you see | What to do |
| --- | --- |
| The API stops and lists variables | Set each named variable. A missing secret means step 4 was skipped |
| `database "…" does not exist` | Run the `createdb` command in step 3 |
| `ECONNREFUSED 127.0.0.1:5432` | PostgreSQL is not running: `brew services start postgresql@18` |
| `EADDRINUSE :8080` | `pnpm kill:all` |
| A sign-in code never arrives | Mailpit is not running: `pnpm docker:up` |
| The phone cannot reach the server | Check `HOST=0.0.0.0`, restart the API, and use the same Wi-Fi on both |
| `expo prebuild` stops with `ENOENT … google-services.json` | Add the file ([Firebase](#firebase)), or comment out `GOOGLE_SERVICES_JSON` in `apps/mobile/.env` |

More fixes, and each step in greater depth: [Getting started](./docs/technical/getting-started.md).

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

## Environment variables

Never commit a real `.env`; they are all git-ignored. The API checks its `.env` when it starts, and if
anything is wrong it stops and names every bad variable. Change a value, then restart that app.

| File | Needed? | What you do |
| --- | --- | --- |
| `apps/api/.env` | Yes | Copy the example and generate the secrets |
| `apps/web/.env` | Yes | Copy the example. No edits for local work |
| `apps/admin/.env` | Yes | Copy the example. No edits for local work |
| `apps/merchant/.env` | Yes | Copy the example. No edits for local work |
| `apps/mobile/.env` | For the phone app | Copy the example. No edits for Expo Go |
| `apps/analytics-consumer/.env` | Optional | See [the analytics consumer](#optional-the-analytics-consumer) |

### `apps/api/.env`

Keep everything from the example. These are the values the API cannot start without:

```bash
NODE_ENV=development
APP_NAME=Starter

# Where the apps live
APP_URL=http://localhost:3000
ADMIN_APP_URL=http://localhost:3001
MERCHANT_APP_URL=http://localhost:3003
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3003

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nestjs-nextjs-turborepo-starter-kit?schema=public

# Email: the local Mailpit inbox
EMAIL_PROVIDER=mailpit
EMAIL_FROM_ADDRESS=noreply@example.com

# Choices with no default
MALWARE_SCANNER=none
TENANCY_ENABLED=true

# Secrets: filled in by `pnpm tools secrets:generate apps/api/.env`. Never type these by hand.
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
EMAIL_VERIFICATION_SECRET=
TWO_FACTOR_PENDING_SECRET=
MFA_ENCRYPTION_KEYS=
REWARD_CODE_HASH_KEYS=
TENANT_ENCRYPTION_MASTER_KEY=
```

The example also connects the Docker services, which keeps queues and events working locally:

```bash
REDIS_URL=redis://localhost:6379
KAFKA_BROKERS=127.0.0.1:9092
RABBITMQ_URL=amqp://rabbit:rabbit@localhost:5672
```

### `apps/web/.env`, `apps/admin/.env` and `apps/merchant/.env`

Everything here reaches the browser, so never put a secret in these files.

| Variable | App | Local value |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | All three | `http://localhost:8080` |
| `NEXT_PUBLIC_APP_URL` | Web | `http://localhost:3000` |
| `NEXT_PUBLIC_ADMIN_URL` | Admin | `http://localhost:3001` |
| `NEXT_PUBLIC_WEB_URL` | Admin | `http://localhost:3000` |
| `NEXT_PUBLIC_MERCHANT_URL` | Admin, merchant | `http://localhost:3003` |

### `apps/mobile/.env`

Nothing is required for Expo Go. Anything starting with `EXPO_PUBLIC_` ends up inside the app, where anyone
can read it, so never put a secret there.

| Variable | When you need it |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | Every release build (an `https://` address), or to reach an API on another machine |
| `MOBILE_APP_NAME`, `MOBILE_BUNDLE_ID` | When you rename the app for your product |
| `GOOGLE_SERVICES_JSON`, `GOOGLE_SERVICES_PLIST` | Real push and crash reporting ([Firebase](#firebase)) |
| `EAS_PROJECT_ID` | [Over-the-air updates](./docs/technical/mobile/over-the-air-updates.md) |

Every other variable, with its default: [API configuration](./docs/technical/configuration/api.md) and
[frontend configuration](./docs/technical/configuration/frontend.md).

## Getting keys for outside services

**You need none of these to run the app locally.** Add one only when you want the real service.

| Feature | Without a key | With a key | Where the key comes from |
| --- | --- | --- | --- |
| Push to real phones | Pushes land in Mailpit | Phones buzz | [Firebase](#firebase) (Android), [Apple](#other-services) (iOS) |
| Crash reports (phone app) | Nothing is reported | Reports in Firebase | [Firebase](#firebase) |
| File uploads | Saved on your disk | Saved in the cloud | [AWS S3](#aws-s3) or [Firebase](#firebase) |
| Real email | Emails land in Mailpit | Emails reach real inboxes | [Resend](#other-services) |
| SMS | Messages land in Mailpit | Real text messages | [Twilio](#other-services) |
| Payments | No gateway is on | Real checkouts | [Billplz or CHIP](#other-services) |
| GitHub features | Off or empty | Repositories and pull requests show | [GitHub](#other-services) |

### Firebase

Firebase does three separate jobs here. Use one Firebase project for all of them, and pick only the jobs
you need.

| Job | What you get from Firebase | Where it goes | Secret? |
| --- | --- | --- | --- |
| The API sends push | A service account key | `FCM_SERVICE_ACCOUNT_JSON` in `apps/api/.env` | Yes |
| The Android app receives push | `google-services.json` | The `apps/mobile/` folder | No, but git-ignored |
| The iOS app reports crashes | `GoogleService-Info.plist` | The `apps/mobile/` folder | No, but git-ignored |
| The API stores files | A service account key file and the bucket name | `apps/api/.env` | Yes |

**First, create the project (once).** In the [Firebase console](https://console.firebase.google.com/),
choose **Add project**. Google Analytics is not needed. The project ID is under
**Project settings → General**.

**Push: the API's key**

1. Go to **Project settings → Service accounts → Generate new private key**. A JSON file downloads.
2. Turn it into one line: `jq -c . ~/Downloads/<the-file>.json`
3. Add these lines to `apps/api/.env`, keeping the single quotes:

   ```bash
   PUSH_PROVIDER=native
   FCM_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"…"}'
   NOTIFICATIONS_ENCRYPTION_KEYS='{"1":"<output of: openssl rand -base64 32>"}'
   ```

4. Delete the downloaded file, or keep it in a password manager. Anyone holding it can push to your app.

**Push and crash reports: the Android app's file**

1. In the Firebase console, go to **Project overview → Add app → Android**.
2. For the package name, enter `MOBILE_BUNDLE_ID` from `apps/mobile/.env` (`com.example.starter` if it is
   unset). It cannot be changed later.
3. Download `google-services.json`, save it in `apps/mobile/`, and skip the "Add Firebase SDK" steps.
4. Add `GOOGLE_SERVICES_JSON=./google-services.json` to `apps/mobile/.env`.
5. Rebuild the app once: `pnpm --filter @workspace/mobile exec expo run:android --device`. Expo Go cannot
   use this file, because it is native configuration.

**Crash reports: the iOS app's file**

1. Go to **Project overview → Add app → iOS**, and enter the same bundle ID.
2. Download `GoogleService-Info.plist` and save it in `apps/mobile/`.
3. Add `GOOGLE_SERVICES_PLIST=./GoogleService-Info.plist` to `apps/mobile/.env`. Keep
   `GOOGLE_SERVICES_JSON` set too: the Firebase plugins only turn on with it.

**File storage**

1. In the Firebase console, open **Storage** and choose **Get started**. Storage needs the pay-as-you-go
   **Blaze** plan, so the console asks you to upgrade first
   ([Firebase's billing FAQ](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024)).
2. Note the bucket name, usually `<project-id>.firebasestorage.app`.
3. In the [Google Cloud console](https://console.cloud.google.com/iam-admin/serviceaccounts), create a
   service account, and give it the **Storage Object Admin** role on that bucket.
4. Open the service account, go to **Keys → Add key → Create new key → JSON**, and save the file outside
   this repository.
5. Add these lines to `apps/api/.env`:

   ```bash
   STORAGE_PROVIDER=firebase
   FIREBASE_PROJECT_ID=<project-id>
   FIREBASE_STORAGE_BUCKET=<project-id>.firebasestorage.app
   GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/key.json
   ```

6. Allow browser uploads by setting CORS on the bucket, as shown in the
   [Firebase storage guide](./docs/technical/storage/firebase.md).

Full guides: [push notifications](./docs/technical/notifications/push-setup.md) and
[Firebase storage](./docs/technical/storage/firebase.md).

### AWS S3

S3 needs more than one bucket: a private bucket, a public bucket, and a CloudFront address for public
images. The repository can create all of them, so you do not make them by hand.

**1. Sign in to AWS.** Install the [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html),
then sign in with single sign-on, which keeps long-lived keys off your computer:

```bash
aws configure sso --profile platform-dev    # asks for your SSO start URL, region, account and role
aws sso login --profile platform-dev
export AWS_PROFILE=platform-dev
aws sts get-caller-identity                 # prints your account: you are signed in
```

**2. Create the buckets and CloudFront.**

```bash
export AWS_REGION=ap-southeast-1
export CDK_DEFAULT_REGION=$AWS_REGION
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)

cd infra/aws
npx cdk bootstrap aws://$CDK_DEFAULT_ACCOUNT/$AWS_REGION    # once per account and region
pnpm run deploy -- -c environment=development \
  -c browserOrigins=http://localhost:3000,http://localhost:3001,http://localhost:3003
```

**3. Read the values it created.**

```bash
aws cloudformation describe-stacks --stack-name StoragePlatform-development \
  --region $AWS_REGION --query "Stacks[0].Outputs" --output table
```

**4. Add them to `apps/api/.env`.** Every line is required:

| Variable | Value |
| --- | --- |
| `STORAGE_PROVIDER` | `s3` |
| `STORAGE_PRIVATE_CONTAINER` | The output `PrivateBucketName` |
| `STORAGE_PUBLIC_CONTAINER` | The output `PublicOriginBucketName` |
| `STORAGE_CLOUDFRONT_PUBLIC_DOMAIN` | The output `CloudFrontDomain`, with no `https://` |
| `STORAGE_CLOUDFRONT_DISTRIBUTION_ID` | The output `CloudFrontDistributionId` |
| `AWS_REGION` | The region from step 2 |
| `AWS_PROFILE` | Your profile, such as `platform-dev` |

**Where is the access key?** You usually do not need one. On a laptop your SSO sign-in provides access, and
on a server the API uses an IAM role. The API refuses `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` on a
deployed production server.

If you cannot use SSO, you can use static keys for local development only:

1. In the [AWS IAM console](https://console.aws.amazon.com/iam/), create a user just for yourself, and
   give it the permissions policy from [Option B, step 4](./docs/technical/storage/aws-s3.md#option-b--use-existing-buckets).
2. Open the user, go to **Security credentials → Create access key**, and copy both values. AWS shows the
   secret only once.
3. Set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in `apps/api/.env` instead of `AWS_PROFILE`.

Full guide, including server roles and testing an upload: [AWS S3](./docs/technical/storage/aws-s3.md).

### Other services

All of these go in `apps/api/.env`.

| Service | Variables | Where to get them |
| --- | --- | --- |
| [Resend](https://resend.com) (email) | `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS` | Resend → **API Keys**. Verify your domain first. [Guide](./docs/technical/email/resend-setup.md) |
| Apple (iOS push) | `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID`, `APNS_PRIVATE_KEY` | [Apple Developer → Keys](https://developer.apple.com/account/resources/authkeys/list). [Guide](./docs/technical/notifications/push-setup.md#ios-apns) |
| [Twilio](https://www.twilio.com) (SMS) | `SMS_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID` | Twilio Console: the account page for the first two, **Messaging → Services** for the last |
| [Billplz](https://www.billplz.com) (payments) | `BILLPLZ_API_KEY`, `BILLPLZ_COLLECTION_ID`, `BILLPLZ_X_SIGNATURE_KEY` | Billplz → **Settings → Keys** |
| [CHIP](https://www.chip-in.asia) (payments) | `CHIP_SECRET_KEY`, `CHIP_BRAND_ID`, `CHIP_PUBLIC_KEY` | Your CHIP account. The public key comes from `GET /public_key/` |
| GitHub (repositories) | `GITHUB_TOKEN` | [Fine-grained token](https://github.com/settings/personal-access-tokens) with **Contents** and **Metadata** read-only. Admins link their own token for pull requests in the admin panel |

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
| `pnpm dev` | Start every dev server (Turbo): the API, the browser apps, Metro, the server agent and the analytics consumer |
| `pnpm dev:stack` | Start just the API (`:8080`), web (`:3000`) and admin (`:3001`): the usual working set, lighter than everything |
| `pnpm dev:web` / `dev:admin` / `dev:merchant` / `dev:api` / `dev:mobile` | Start one app |
| `pnpm build` | Build every workspace |
| `pnpm format` / `lint` / `typecheck` / `test` | Format and the quality checks across the monorepo |
| `pnpm test:e2e` | The API and analytics-consumer end-to-end suites |
| `pnpm ci:local` | Run what CI runs, locally, including the browser suites |
| `pnpm scaffold:context <name>` | Start a new bounded context in the API: a compiling query slice with its module, port and passing tests, then the remaining steps (model, RLS, reader, contract, controller, registration) |
| `pnpm certify:check` | Check the new-developer certification exercise in every layer, then run the full gate (`docs/technical/certification-exercise.md`) |
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

Git hooks run on your machine, and show their progress in the terminal so a commit or push never looks frozen:

| You run | What happens first | How long |
| --- | --- | --- |
| `git commit` | Formats and lints the staged files | Seconds |
| `git push` | Runs lint, typecheck and every unit test, the same as CI, and shows each test file as it finishes | Several minutes |

If a check fails, the commit or push stops and the failing log is printed. Fix it and run the command again.

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
├── docs/                 Documentation site (TanStack Start)
├── mobile/               Expo app (Expo Router, Uniwind, local native modules)
├── analytics-consumer/   Kafka consumer → analytics
├── load-runner/          Load-test runner used by the operations console
└── server-agent/         Host agent reporting server metrics

infra/
├── aws/                  CDK stack for object storage (@workspace/aws-infrastructure)
├── docker/, nginx/, pm2/ Container images, proxy and process config
└── droplet/              Droplet setup

packages/
├── shared/               Zod schemas, routes, permissions: the contract
├── client/               Typed API client, auth, can()
├── api-client/           Framework-free HTTP client
├── ui/                   Web UI kit (presentational only)
├── ui-native/            Mobile UI kit
├── tokens/               Design tokens and the brand mark
├── docs-renderer/        The docs' Markdown pipeline and API reference generator
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

To ship a JavaScript fix to installed phones without a store release (over-the-air updates with EAS), follow
[Over-the-air updates with EAS](./docs/technical/mobile/over-the-air-updates.md): first-time setup, every
command, and a step-by-step first test.

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

The README banner is `docs/images/readme-banner.png`. The social preview image shown when the repository
link is shared is `docs/images/og-image.png` (1280×640 PNG, under 1 MB); GitHub reads it from
**Settings → General → Social preview**, so upload it there once.

---

<p align="center">
  <sub>NestJS · Next.js · Expo · PostgreSQL. Typed from the database to the browser and the phone.</sub>
</p>
