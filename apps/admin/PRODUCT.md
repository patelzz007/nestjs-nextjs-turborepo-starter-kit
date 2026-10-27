# Product — Admin panel

<!-- impeccable:product-schema 1 -->

Inherits the root `PRODUCT.md`; only what differs is recorded here.

## Platform

web

## Users

Platform staff: SuperAdmin, plus Admin and Manager roles limited by their permissions. They
work at a desk, often for long sessions, reviewing queues and investigating records.

## Product Purpose

Run the platform:

- invite merchants;
- review business verification (KYB), store requests and rewards;
- suspend, ban and handle appeals;
- manage users, roles and permissions, and publish access policies;
- impersonate and grant support access (SuperAdmin);
- recover MFA;
- read platform sales;
- read the audit log;
- preview emails and read the email log;
- manage geography and the catalog.

The developer component gallery (`/components`, including Kanban) is served in development
and test only.

## Operating Context

- **Review queues:** the decisions are approve, return or reject, each with a reason.
- **Audit log:** one timeline of requests and database row changes. Viewing it is itself
  audited. Secrets read `[REDACTED]` and personal data is masked.
- **Effect of permission changes:** they take effect on the affected users' next token
  refresh.

## Capabilities and Constraints

- **Authorization:** every action is authorized on the server. The UI hides what the role
  cannot do, but that is never the control.
- **Dense, scannable screens:** compact tables and grouped audit entries.

## Brand Commitments

The admin accent is slate. The app shell is the one the owner chose ("app shell 3").
