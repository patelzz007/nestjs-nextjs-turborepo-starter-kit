# Product — Merchant portal

<!-- impeccable:product-schema 1 -->

Inherits the root `PRODUCT.md`; only what differs is recorded here.

## Platform

web

## Users

People who work for a merchant business:

- **Owners** run the business and alone handle KYB.
- **Admins** can do everything except KYB.
- **Cashiers** view rewards, redemptions, analytics and stores.
- **Policy admins** administer the tenant's access policies.
- **Members** see the dashboard and the store list.

Staff may be limited to selected stores; everything they see is scoped to those stores.

## Product Purpose

Let a merchant:

- finish onboarding and verification;
- manage stores and the team;
- create rewards and submit them for review;
- pair POS terminals and issue API keys;
- see redemptions, referrals and analytics.

## Operating Context

- **Multi-tenant:** every request carries the tenant (`x-tenant-id`). A user can belong to
  more than one merchant.
- **Two settings:** the portal is used both in the back office and near the counter. Cashier
  tasks must work quickly on a small screen.
- **Isolated sign-in:** auth cookies are separate from the other apps.

## Capabilities and Constraints

- **Tenant isolation:** enforced by the server and by row-level security. The UI never decides
  what data belongs to which tenant.

## Brand Commitments

The merchant accent is green.
