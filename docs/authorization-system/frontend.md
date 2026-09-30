---
title: "Frontend Authorization"
tags: ["authorization", "frontend", "react", "nextjs", "can", "sidebar", "admin", "merchant", "web"]
description: "How the admin, merchant and web apps decide what to show: the shared can() API, the <Can> component, providers, route guards, sidebar filtering, UX rules, and per-app helpers."
order: 23
author: "Platform Team"
lastUpdated: 1790812800000
coverImage: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1600&q=80"
---

# Frontend Authorization

> [!CAUTION]
> **Everything on this page is UX, not security.** A user can open DevTools, change
> JavaScript, or call the API with curl. The backend re-checks every request
> ([backend guide](./backend.md)). The frontend's job is only to avoid showing people
> things they cannot use (spec §2, §61, §111).

---

## 1. The one API every app uses

Everything comes from `@workspace/client/lib/auth/can` (`packages/client/src/lib/auth/can.tsx`).

### 1.1 The hook: `useAuthorization()`

```tsx
import { useAuthorization } from "@workspace/client/lib/auth/can";
import { PERMISSION } from "@workspace/shared";

function RoleActions(): React.JSX.Element {
	const { can, cannot, canAll, canAny } = useAuthorization();

	if (can(PERMISSION.ROLE.UPDATE)) {
		return <AssignRoleButton />;
	} else {
		return <AccessRestrictedNotice>You can view roles but not change them.</AccessRestrictedNotice>;
	}
}
```

| Function | Meaning |
|---|---|
| `can(permission, resource?)` | true when allowed |
| `cannot(permission, resource?)` | `!can(...)` — reads better for `disabled={cannot(...)}` |
| `canAll(permissions, resource?)` | every permission is allowed (AND) |
| `canAny(permissions, resource?)` | at least one is allowed (OR) |

- `MANAGE` implies every action on the **same** resource:
  holding `PERMISSION.ORDER.MANAGE` makes `can(PERMISSION.ORDER.DELETE)` true.
- `useCan()` is an alias kept for older code. Prefer `useAuthorization()`.
- **Without a provider every check returns `false`** (deny by default).

### 1.2 The component: `<Can>`

```tsx
import { Can } from "@workspace/client/lib/auth/can";

<Can permission={PERMISSION.USER.DELETE}>
	<DeleteUserButton />
</Can>

<Can permissions={[PERMISSION.ROLE.READ, PERMISSION.PERMISSION.READ]} mode="any" fallback={<AdminAccessDenied />}>
	<AccessControlPanel />
</Can>
```

| Prop | Meaning |
|---|---|
| `permission` | one required capability |
| `permissions` + `mode` | several; `"any"` (default) or `"all"` |
| `resource` | a record carrying server-evaluated capabilities (see §1.3) |
| `fallback` | what to render when denied (default: nothing) |

### 1.3 Resource-aware checks (per record)

Some decisions depend on the **record** (ownership, store, ACL, status). The browser must not
re-implement those rules (spec §9, §12). Instead the API can attach server-evaluated
capabilities to a record:

```json
{ "id": "order-123", "status": "PENDING", "authorization": { "can": { "read": true, "update": true, "delete": false } } }
```

Then:

```tsx
{can(PERMISSION.ORDER.DELETE, order) && <DeleteButton />}
<Can permission={PERMISSION.ORDER.UPDATE} resource={order}><EditButton /></Can>
```

| Record has `authorization`? | `can(permission, record)` uses |
|---|---|
| **yes** | the server's answer for that action (a missing entry = `false`). It already includes scope, ownership, ACL and policy — and may even be `true` without the global permission (e.g. an ACL grant). |
| **no** | the global capability, same as `can(permission)` |

On the backend, produce the map with `kernel.resourceCapabilities(...)`, or ask for several
checks at once with `POST /api/v1/authorization/decisions`.

### 1.4 Vocabulary — never type slugs by hand

```ts
import { PERMISSION, MERCHANT_CAPABILITY } from "@workspace/shared";

PERMISSION.USER.DELETE             // "platform:user.delete"
PERMISSION.ADMIN_DASHBOARD.READ    // "platform:admin_dashboard.read"
MERCHANT_CAPABILITY.manageRewards  // "merchant:manage_rewards"
```

❌ `can("platform:user.delte")` compiles and silently denies forever.
✅ `can(PERMISSION.USER.DELTE)` does not compile — the typo is caught.

---

## 2. Where capabilities come from

| App | Source | Freshness |
|---|---|---|
| Admin | `GET /auth/permissions`, preloaded on the server in `app/(panel)/layout.tsx`, then `useSessionPermissionsQuery()` (`lib/session/capabilities.ts`) | refetch on window focus + every 60 s; **live data wins even when empty** (a user whose permissions were all revoked immediately sees nothing) |
| Web | same endpoint, in `WebAuthorizationProvider` (`components/auth/web-authorization-provider.tsx`) mounted in `app/layout.tsx` | same rules; **guests never call the endpoint** and get an empty set |
| Merchant | the active organization membership (`api.organizations.membershipsBootstrap`) → role → `MERCHANT_ROLE_CAPABILITIES`, in `MerchantAuthorizationProvider` | refetched with the memberships query |

Platform SuperAdmins receive **every** platform capability from `/auth/permissions`, because
the backend lets them do everything.

> Capabilities are **not** stored in the JWT (spec §60). The JWT only identifies the user.

---

## 3. UX rules — what to do when something is not allowed

| Thing | Not allowed → | Example |
|---|---|---|
| Navigation (sidebar, command palette, pinned items) | **hide** | "Access Control" disappears |
| Row actions / menu items | **hide** | no "Delete" in the row menu |
| A primary action that would confuse if it vanished | **disabled + reason** | `DisabledActionButton` "Create product" with tooltip |
| A whole page or section | **fallback notice / access-denied** | `AdminAccessDenied`, `MerchantAccessDenied`, `AccessGate` |
| Still loading | **render nothing or a skeleton** — never flash "denied" | `isResolved` / `isLoading` checks |

`disabled` in the sidebar config means "feature exists but is switched off" — it is **not**
the same as unauthorized (spec §25). Unauthorized items are removed, not disabled.

---

## 4. Admin app (`apps/admin`)

| Building block | File | What it does |
|---|---|---|
| Provider | `components/layout/dashboard-layout.tsx` | mounts `CapabilitiesProvider` with live capabilities |
| Page requirements | `lib/navigation/menu-authorization.ts` | `ADMIN_MENU_AUTHORIZATION`: sidebar URL → `PERMISSION.*` requirement, one line per page with a comment naming the API route it mirrors |
| Route rules | `lib/navigation/route-authorization.ts` | built from the menu + explicit rules; longest URL prefix wins; `superAdminOnly` rules for `@SuperAdminOnly` pages |
| Route guard | `components/access/route-authorization-guard.tsx` | renders `AdminAccessDenied` when the current page's rule is not met |
| Super admin | `lib/session/super-admin.ts` | `useSuperAdminStatus()`, `useCanStartImpersonation()` |
| Disabled action | `components/common/disabled-action-button.tsx` | disabled button + tooltip + screen-reader reason |
| Inline notice | `components/common/access-restricted-notice.tsx` | "you can view but not change" message |
| Access denied page | `components/access/admin-access-denied.tsx` | full-page fallback |

What is gated (each maps to the permission of the API route it calls):

| Area | Requirement | When not allowed |
|---|---|---|
| Access control page | any of `ROLE.LIST`, `PERMISSION.LIST`, `PERMISSION.READ`; each tab its own | tab hidden; notice when none |
| User access panel | assign / remove roles `ROLE.UPDATE`; direct grants `PERMISSION.UPDATE`; permission checker `PERMISSION.READ` | read-only notice, checker hidden |
| Users pages, MFA recovery review | SuperAdmin | hidden / denied |
| Impersonate | SuperAdmin and not already impersonating | hidden |
| Reward Hub merchants / KYB / locations | `MERCHANT_ORG.LIST`; decisions and reviews `MERCHANT_ORG.MANAGE` | read-only notice |
| Pending rewards approve / reject | `REWARD.MANAGE` | hidden |
| Invites | `MERCHANT_ORG.MANAGE` | page denied |
| Emails / email log / send test email | `EMAIL.READ` / `EMAIL.LIST` / `EMAIL.CREATE` | page denied / disabled button with reason |
| Geo | `GEO.READ` | page denied |
| Products, sample categories | list `*.LIST`; create `*.CREATE`; view `*.READ`; edit `*.UPDATE`; delete `*.DELETE` | create disabled with reason; row actions hidden; detail / edit pages denied |

---

## 5. Merchant app (`apps/merchant`)

| Building block | File |
|---|---|
| Provider | `components/access/merchant-authorization-provider.tsx` — `MerchantAuthorizationProvider` (feeds `CapabilitiesProvider`), `useMerchantAuthorizationStatus()`, `useMerchantRoleAccess(action)` |
| Capability gate | `components/access/merchant-capability-gate.tsx` — `MerchantCapabilityGate` (skeleton while loading, then `<Can fallback={<MerchantAccessDenied/>}>`), `MerchantRoleGate`, `MerchantReadOnlyNotice` |
| Role rules | `lib/org/membership-roles.ts` — `manageTeam` / `manageLocations` (`OWNER`, `ADMIN`), `submitKyb` (`OWNER`), mirroring the API services |
| Capability hook | `lib/org/capabilities.ts` — `useMerchantCapabilities()` (membership → capabilities) |

| Area | Capability / rule | When not allowed |
|---|---|---|
| Sidebar, palette, pinned, topbar | the item's capability | hidden |
| Dashboard | `viewDashboard` | denied page |
| Rewards list / create / edit / submit | `viewRewards`; changing needs `manageRewards` | denied page; create hidden + read-only notice; read-only form |
| Redemptions | `viewRedemptions` | denied page (no query is sent) |
| Analytics | `viewAnalytics` | denied page (no query is sent) |
| API keys | `manageApiKeys` | "owner or admin access required" |
| Team and invites, add / resubmit store | `OWNER` or `ADMIN` role | denied / action hidden |
| **KYB page and settings card** | **`OWNER` role only** (the API enforces the same) | denied page; card hidden |

```tsx
const { can } = useAuthorization();
{can(MERCHANT_CAPABILITY.manageRewards) ? <CreateRewardButton /> : <MerchantReadOnlyNotice>Only managers can create rewards.</MerchantReadOnlyNotice>}

<MerchantRoleGate action="submitKyb">
	<KybForm />
</MerchantRoleGate>
```

---

## 6. Web app (`apps/web`)

| Building block | File |
|---|---|
| Provider | `components/auth/web-authorization-provider.tsx` — one provider for the whole app; `useWebSession()` |
| Section gate | `components/auth/access-gate.tsx` — `AccessGate`: guest → sign-in prompt; signed in without permission → "not available for your account"; allowed → children; loading → nothing |
| Fallback UI | `components/auth/access-fallback.tsx` |

| Area | API rule | Gate |
|---|---|---|
| Impersonation panel | `@SuperAdminOnly` + `USER.LIST` / `USER.CREATE` | super admin with both, not already impersonating |
| Impersonation banner | signed in | only while impersonating |
| Claim flow, my claims, QR, activity, account settings | signed in | sign-in prompt for guests |
| Browse, reward details, landing | public | none |

The web app has no URL / tag / API-key screens today. When you add one, gate it with the
`OWN`-scoped customer permissions (`PERMISSION.URL.CREATE`, …) and let the API enforce
ownership.

---

## 7. Sidebar filtering (all apps)

Menus are **application-owned config** (spec §14): admin `lib/navigation/sidebar-menu.json` +
`menu-authorization.ts`; merchant `data/merchant-sidebar-menu.json`. The schema is in
`packages/client/src/lib/sidebar/sidebar-menu-schema.ts`:

```ts
{
  title: "Access Control",
  url: "/settings/access",
  icon: "ShieldCheck",
  authorization: {
    permissions: [PERMISSION.ROLE.READ, PERMISSION.PERMISSION.READ], // at least 1
    mode: "any",       // "any" (default) | "all"
    cascade: false,    // default false
  },
  featureFlag: "analytics-v2", // optional, separate from authorization
  disabled: false,             // "switched off", NOT "unauthorized"
  children: [ /* … same shape, any depth … */ ],
}
```

Every slug is validated when the menu loads (a typo fails fast). The recursive filter
(`packages/client/src/lib/navigation/filter-sidebar-menu-by-capabilities.ts`) applies:

| Case | Result |
|---|---|
| Item authorized | kept, with its visible children |
| Item not authorized, some child visible | kept as a **structural parent** (spec §21, §115) |
| Item not authorized, no visible child | **removed** (never render an empty parent, spec §22) |
| `cascade: true` on a parent | the parent's requirement applies to descendants that have no requirement of their own; a denied cascading parent removes its subtree (spec §24, §116) |
| `featureFlag` not enabled | removed with its subtree (`allowed AND enabled`, spec §70) |
| `disabled: true` | kept and rendered disabled (only if authorized) |

The same filtered menu feeds the sidebar, the command palette and pinned items, so a hidden
page never shows up in search. Tests cover six levels of nesting.

---

## 8. Writing a gated component — checklist

1. Find the endpoint your component calls and read its decorator in `apps/api`.
2. Use **that** permission (`PERMISSION.*` / `MERCHANT_CAPABILITY.*`), not a guess.
3. Gate in the **container** component; keep presentational components data-agnostic (spec §82).
4. Choose the UX from §3 (hide / disabled with reason / fallback).
5. Handle loading so allowed users never see a denial flash.
6. Add a test with and without the capability (see [testing](./testing.md#4-frontend-tests)).
7. Remember: the API must still enforce it. If it does not, fix the API first.
