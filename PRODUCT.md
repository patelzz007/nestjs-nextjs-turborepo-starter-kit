# Product

<!-- impeccable:product-schema 1 -->

Shared record for every app in this monorepo. Each app adds only what differs in its own
`apps/<app>/PRODUCT.md` (admin, merchant, web, mobile, docs); `packages/ui` and
`packages/ui-native` inherit this file.

## Platform

web

The Next.js apps (web, admin, merchant) and the Astro docs site are web. The Expo app
(`apps/mobile`, iOS + Android) uses **one shared design language** on both operating systems,
matching the web apps' brand, not per-OS conventions (confirmed 2026-10-27).

## Users

Two audiences, in this order (confirmed: "both, kit first"):

1. **Teams building products on the starter kit.** Engineers from principal level to juniors
   with about six months of experience, working with AI coding agents (Claude Code, Cursor,
   Codex, Copilot) on most changes. Their job: start a new product from a production-grade
   base and copy its patterns correctly. Whatever the kit ships becomes "the pattern" in
   every product built from it.
2. **The people using RewardHub, the reference product the kit ships with.** RewardHub is a
   rewards platform: merchants create rewards, customers claim them and redeem them at the
   till.
   - **Platform staff** (SuperAdmin, Admin, Manager) in the admin panel.
   - **Merchant owners, admins and cashiers** (plus policy admins and members) in the merchant
     portal.
   - **Customers** in the web dashboard and the mobile app.
   - **The merchant's POS**, which is not a UI: it calls the API with an API key.

## Product Purpose

A production-grade NestJS + Next.js + Expo Turborepo starter kit. A team can start a real
product from it without rebuilding:

- auth, MFA and new-device verification;
- multi-tenancy with row-level security;
- authorization (RBAC/ReBAC);
- audit logging;
- file uploads;
- messaging;
- analytics;
- the CI quality gates.

RewardHub proves those foundations end to end on a real domain, from inviting a merchant to a
customer redeeming a reward. Success means a team builds on the kit without hitting a shortcut
or a placeholder that has to be torn out later.

## Positioning

**"No shortcut" is the product.** Every pattern is complete, tested and enforced: lint, tests
and CI gates that agents cannot suppress. That makes copying it safe, for humans and for AI
agents alike.

RewardHub is a working multi-tenant product, not a to-do demo. Its real journeys exercise
every foundation the kit offers:

- KYB review;
- store approval;
- reward review;
- QR claims;
- POS checkout;
- referrals;
- analytics.

## Operating Context

- **Data path:** a shared Zod contract from database to browser
  (`PostgreSQL → Prisma → Zod → NestJS → Next.js → UI`). The same schema validates on the
  client for user experience and again on the server, which is the authority.
- **Apps:**
  - web (customers, port 3000);
  - admin (platform staff, 3001);
  - docs (3002);
  - merchant (3003);
  - API (8080);
  - mobile (Expo).
- **RewardHub journey:**
  1. An admin invites a merchant.
  2. The owner onboards and uploads KYB documents.
  3. An admin reviews the KYB.
  4. The owner requests stores and invites the team.
  5. The merchant creates rewards and submits them for review.
  6. Customers claim a reward and show its QR code at the counter.
  7. The POS redeems it.

  The full journey is in `docs/user-guide/`.
- **Locale:** demo data and defaults are Malaysian (Kuala Lumpur merchants such as Brew &
  Bean, `Asia/Kuala_Lumpur` operator time zone).

## Capabilities and Constraints

- **Rules:** non-negotiable engineering rules live in `AGENTS.md` and `rules/`. Among them:
  - server-side authorization is authoritative;
  - every state change is audited;
  - soft delete everywhere;
  - payment-related operations are idempotent;
  - tests for everything.
- **UI architecture:** smart components own data and transformations. Low-level components
  are data-agnostic, stateless, controlled, accessible, themeable and ref-forwarding.
- **Separate view and edit pages:** a record has a read-only `/x/[id]` page and a separate
  `/x/[id]/edit` editor, never a disabled form as a view.
- **One audit-log page:** requests and database row changes appear in one timeline.
- **Open decisions:**
  - no internationalization library or supported-language list is chosen yet;
  - no pricing, licensing or hosting claim is decided.

## Brand Commitments

- **Names:** "RewardHub" for the reference product. The kit's public name is "NestJS + Next.js
  + PostgreSQL starter kit".
- **Binding constraints the owner has already given** (recorded here, not expanded; DESIGN.md
  holds the system once it is documented):
  - Each app has its own accent: web blue, merchant green, admin slate.
  - Light canvas `#F1F4F9`, never pure white surfaces.
  - Dark mode is pure grey, with card elevation (`#151515` / `#1d1d1d` / `#2b2b2b`).
  - The selected state is distinct from hover.

## Evidence on Hand

- **User guide:** `docs/user-guide/` (10 chapters: platform setup, merchant onboarding, stores
  and team, rewards, claims, POS checkout, referrals, analytics, platform administration,
  account and security).
- **Technical docs:** `docs/technical/`, ADRs in `docs/adr/`, the blog in `blog/`.
- **Seed scenarios:** `development` and `enterprise`, with demo merchants, stores, rewards and
  customers in `apps/api/prisma/seed/`.
- **Absent, and not to be fabricated:** real customers, testimonials, usage numbers, pricing
  and case studies.

## Product Principles

1. **No shortcuts.** Whatever ships is copied as the pattern, so it must be the complete,
   correct version.
2. **The server decides.** The UI validates for convenience, the server for truth, with one
   shared contract.
3. **Every journey is real.** RewardHub flows run end to end against the real API, never
   against mocks or placeholder screens presented as finished.
4. **Readable by juniors and agents.** Explicit names, documented decisions, and one obvious
   way to do each thing.

## Accessibility & Inclusion

Components must be keyboard-operable, labelled and themeable (`rules/07`). No conformance
level (such as WCAG 2.2 AA) has been formally adopted yet: an open decision.
