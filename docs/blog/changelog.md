---
title: "Changelog"
description: "Every release of the starter kit: what was added, changed, fixed and removed, and what to do when you upgrade a product built on it."
author: "Platform Team"
date: 1793664000000
category: "Changelog"
---

# Changelog

What changed in each release of the starter kit, newest first. Products built on the starter read this
before pulling a new release: **Upgrade notes** say what you have to do (migrations, env changes, steps).

- Versions follow [semantic versioning](https://semver.org) for the template as a whole: a **major** release
  needs work in your product (a breaking API, schema or config change), a **minor** one adds features, a
  **patch** fixes bugs.
- The format follows [Keep a Changelog](https://keepachangelog.com): *Added*, *Changed*, *Fixed*,
  *Removed*, *Security*, and *Upgrade notes*.
- This page is the one source: the repository's `CHANGELOG.md` points here, and the docs site shows it in
  the blog. Releases 0.1.0–0.6.0 were labelled after the fact from the project's history.

**Cutting a release:** move *Unreleased* under a new `## [x.y.z] — YYYY-MM-DD` heading, set the root
`package.json` `version` to it (a test keeps them equal), commit, and tag `vx.y.z`.

## [Unreleased]

### Added

- **Deploys from GitHub Actions** to a DigitalOcean Droplet after CI passes on `main`, with automatic
  rollback on a failed health check, and a step-by-step guide from an empty account to a live platform
  (ADR 075, `docs/technical/operations/digitalocean-deployment.md`).
- **One project name**: `project.json` names the product (slug and display name); `pnpm project:sync`
  applies it everywhere and `pnpm lint` fails while a copy is stale.
- **Breached-password check**: new passwords that appear in a known data breach are refused
  (Have I Been Pwned, k-anonymity; `PASSWORD_BREACH_CHECK`).
- **Security headers on the web apps**: a nonce-based Content-Security-Policy, framing refused, strict
  referrer and permissions policies on web, admin and merchant.
- **`TreeNodeText`**: every row of a tree has a title and a subtitle.

### Changed

- Notification settings: two columns on wide screens (the tree beside quiet hours, offers and phones);
  every channel explains itself.
- Data-table filters wrap onto a second line instead of scrolling sideways.

### Security

- The API-docs gate and the restricted-session gate decide on the route Fastify dispatched to, closing two
  bypasses (percent-encoded paths, URL fragments) found by the October audit.
- The RLS helpers call each other schema-qualified, so no caller's `search_path` can change them.

### Upgrade notes

- Rename the Docker project: `docker compose -p hello-world down`, then `pnpm docker:up` (fresh Redis,
  Kafka, RabbitMQ and Mailpit volumes).
- Re-apply the security SQL: `pnpm --filter @workspace/api db:apply-security`.
- New optional env: `PASSWORD_BREACH_CHECK` (default `hibp`).

## [0.6.0] — 2026-11-02

### Added

- `DataChangeGroup`: a summary row per transaction, kept by a statement trigger, so the audit timeline
  pages through groups instead of counting every row change (about 6× faster on a seeded database).
- One generator for CI's API env, used by GitHub Actions and `pnpm ci:local` alike.
- The seed's geo dataset is pinned to one commit, verified by SHA-256, cached and retried.
- Merchant broadcasts end to end.

### Fixed

- Per-user rate-limit policies no longer also count against the per-IP login limit.
- `ci:local` no longer reads the developer's own `.env`, so it fails where GitHub's CI fails.

## [0.5.0] — 2026-10-31

### Added

- Multi-channel notifications (in app, email, phone, SMS) with per-kind preferences, quiet hours and
  digests (ADR 070); broadcasts and tenant customers (ADR 073); private rewards; free-item and
  buy-one-get-one rewards at the till (ADR 074).
- Rate-limit policies and a cache console for operators (ADR 071, 072).
- Push notifications on Android through Firebase; the phone app's inbox; scan a QR code from the gallery.

## [0.4.0] — 2026-10-29

### Added

- The platform operations console: servers, alerts and backups, fed by the server agent (ADR 068).
- A carousel on the home page; the page header stays put while content scrolls.

## [0.3.0] — 2026-10-27

### Added

- URL state with nuqs; the Nord theme in every app; richer audit records (session, claimed tenant).
- Kanban boards (UI and API).

## [0.2.0] — 2026-10-21

### Changed

- The API was reorganised into bounded contexts with domain-driven design and CQRS.

### Added

- Multi-tenancy with row-level security on every table (ADR 062).

## [0.1.0] — 2026-09-01

### Added

- The first release: NestJS API, Next.js web, admin and merchant apps, the Expo phone app, and the shared
  packages in one Turborepo.
