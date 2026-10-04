---
title: "Testing Authorization"
tags: ["authorization", "testing", "vitest", "e2e", "rls"]
description: "Where the authorization tests live, how to run unit and database e2e suites, the house patterns for cast-free mocks, and what every new gated feature must test."
order: 26
author: "Platform Team"
lastUpdated: 1790899200000
coverImage: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1600&q=80"
---

# Testing Authorization

> [!NOTE]
> Authorization bugs are silent: a missing check still "works". That is why **negative
> tests** — "this must be denied" — matter more here than anywhere else (spec §100–§105).

---

## 1. Running the tests

```bash
pnpm run test                              # every workspace (includes the API unit suite)
pnpm --filter @workspace/api test          # API unit tests only
pnpm --filter @workspace/admin test        # one frontend app
```

### Database e2e tests (API)

They boot the real Nest app against a **real Postgres with RLS applied**. Use a throwaway
database, never your dev one:

```bash
cd apps/api
createdb authz_e2e                         # or CREATE DATABASE via psql
export DATABASE_URL="postgresql://USER:PASS@localhost:5432/authz_e2e?schema=public"
pnpm build:shared
pnpm exec prisma migrate deploy
pnpm exec tsx scripts/apply-rls.ts
pnpm exec tsx prisma/seed.ts
pnpm test:e2e
dropdb authz_e2e
```

> If `login` starts returning `429`, the Redis-backed auth throttler still remembers earlier
> runs — wait a couple of minutes and rerun.

---

## 2. Where the tests are

### API unit tests (`apps/api`, run by `pnpm test`)

| File | Covers |
|---|---|
| `src/modules/authorization/kernel/__tests__/authorization-kernel.service.spec.ts` | precedence, DENY overrides, ACL, MANAGE, scopes (ORG / STORE / LOCATION / OWN / RESOURCE), cross-tenant CRUD, forged tenants, membership-grants-nothing, policies, conditions, `filter()` shapes, `resourceCapabilities`, `hasRoles`, audit on `authorize()` |
| `kernel/__tests__/tenant-membership.service.spec.ts` | organization / store / location verification, forged ids, scope rows |
| `kernel/__tests__/policy-engine.service.spec.ts` | every operator, DENY-only abstain, conditional ALLOW, malformed rules fail closed, strict schema |
| `kernel/__tests__/acl.service.spec.ts` | query shape (user + role subjects, MANAGE, type-wide, tenant), conditions |
| `guards/__tests__/authorization.guard.spec.ts` | 401 / 403, `@Authorize` with params and `self()`, fail-closed resource ids, tenant attributes, any / all, roles, SuperAdmin audit, `hasAdminAccess` |
| `services/authorization-context.resolver.spec.ts` | header vs params / body, forged org / store / location headers → 403 |
| `services/privilege-escalation.service.spec.ts` | self-escalation, subset rule, inherited roles, SuperAdmin exemption |
| `repositories/role-assignment.repository.spec.ts` | sync revives soft-deleted rows (regression) |
| `src/infrastructure/outbox/platform-outbox.service.spec.ts` | outbox writes under `outbox.enqueue` (regression) |
| `src/modules/files/services/file-authorization.service.spec.ts` | per-category upload / complete / read / delete rules, Cedar consulted |
| `src/modules/rewards/services/merchant-context.service.spec.ts` | merchant role table (cashier read-only, policy admin), owner-only KYB, POS keys never manage team / locations / verification |
| `src/modules/organization/services/organization-reward-auth.service.spec.ts` | `requireMembershipCapability`: every role × team / locations / verification allowed exactly as before the capability migration, role table and default Cedar policy agree, Cedar narrowing, fail closed on capabilities without an API action |
| `prisma/seed/merchant-capability-catalog.spec.ts` | one seeded `capability_definitions` row per merchant capability |
| `src/common/interceptors/rls.interceptor.spec.ts` | RLS scope per caller type; verified organization only |
| `src/common/middleware/rls-pre-handler.middleware.spec.ts` | a real Fastify app proves guards run inside `request.pre_handler` |
| `src/prisma/rls-context.spec.ts` | fail-closed unscoped context, allowlist |

### API e2e tests (`apps/api/test`, need a database)

| File | Covers |
|---|---|
| `authorization-hardening.e2e-spec.ts` | forged `x-organization-id` / `x-store-id` → 403, store-scoped decisions, decisions endpoint, explain restricted to admins, `@Authorize(self())` routes, self-escalation and subset rule, refresh / logout under user-scoped RLS |
| `authorization-kernel.e2e-spec.ts` | kernel against seeded data: admin dashboard, default deny, self grants, DENY override, ACL DENY, forged org, membership ≠ permission, filters |
| `access-hardening.e2e-spec.ts`, `rls-hardening.e2e-spec.ts`, `organization-isolation.e2e-spec.ts` | cross-org reads / writes over HTTP, RLS at the database level |
| `merchant-capabilities.e2e-spec.ts` | seeded owner vs cashier on team, KYB and store-location endpoints (`ORGANIZATION_ROLE_CAPABILITY_REQUIRED`), cashier still reads locations |

### Shared and frontend

| Package / app | Covers |
|---|---|
| `packages/shared/src/authorization/permission.test.ts` | slugs, `MANAGE`, implicit self grants, merchant role table, strict policy schema |
| `packages/client` (`can.test.tsx`, sidebar filter tests) | `can` / `cannot` / resource-aware checks, `<Can>`, six-level sidebar, any / all / cascade / disabled / feature flags |
| `apps/admin`, `apps/merchant`, `apps/web` | each gated area with and without the capability, loading states, route guard |
| `apps/merchant/lib/navigation/org-route-authorization.test.ts`, `lib/org/org-page-*.test.ts*` | every org page has a rule and calls `guardOrgPage` before loading data; sidebar and route map agree; sidebar per role hides exactly the denied pages; server denial rendering |

---

## 3. House patterns for API unit tests (no casts)

The strict rules forbid `as` casts, so mocks replace **modules** instead of casting objects:

```ts
const mocks = vi.hoisted(() => ({ verify: vi.fn() }));

vi.mock("../tenant-membership.service", () => ({
	TenantMembershipService: class {
		public readonly verify = mocks.verify;
	},
}));

// the real type, constructed normally — no cast needed
const service = new AuthorizationContextResolver(new TenantMembershipService());
```

- For HTTP contexts use `apps/api/test/support/http-execution-context.ts`
  (`createHttpContext`, `testRequest`, `accessToken`). It builds a real Nest
  `ExecutionContext` whose handler carries real decorator metadata.
- The unit-test transformer does not compile decorator syntax in spec files — apply
  decorators as calls (`Controller("probe")(ProbeController)`).
- Build **complete** Prisma fixtures (every field) instead of partial objects.
- A new spec outside the existing globs must be added to `apps/api/vitest.config.unit.ts`.

---

## 4. Frontend tests

The pattern (component names and copy are illustrative — follow the real component's props):

```tsx
import { CapabilitiesProvider } from "@workspace/client/lib/auth/can";
import { PERMISSION } from "@workspace/shared";

it("hides Assign role without ROLE.UPDATE", () => {
	render(
		<CapabilitiesProvider capabilities={[PERMISSION.ROLE.READ]}>
			<UserAccessPanel userId="u-1" />
		</CapabilitiesProvider>,
	);
	expect(screen.queryByRole("button", { name: /assign role/i })).toBeNull();
	expect(screen.getByText(/can view roles but not/i)).toBeDefined();
});
```

Merchant tests use the helpers in `apps/merchant/test/authorization.tsx`; web tests use
`WebSessionTestProvider`.

---

## 5. What every new gated feature must test

- [ ] **Allowed** — the user with the permission can do it (API) and sees it (UI).
- [ ] **Denied** — the user without it gets `403` (API) and does not see it (UI).
- [ ] **Cross-tenant** — Org A user against an Org B record: denied for read, create, update, delete, list (spec §101).
- [ ] **Forged ids** — tenant header / body ids for someone else's tenant are rejected (spec §104).
- [ ] **Direct API call** — the endpoint is denied even though the button is hidden.
- [ ] **Precedence** (if you add ACLs / overrides / policies) — DENY beats ALLOW (spec §100).
- [ ] **Loading** — no denial flash while permissions load (frontend).
