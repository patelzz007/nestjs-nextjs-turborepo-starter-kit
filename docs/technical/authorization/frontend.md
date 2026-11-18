---
title: "Frontend Authorization"
tags: ["authorization", "frontend", "react", "nextjs", "can", "sidebar", "admin", "merchant", "web"]
description: "How the admin, merchant and web apps decide what to show: the session's CASL ability, useAbility() and the <Can> component, providers, route guards, sidebar filtering, UX rules, and per-app helpers."
order: 23
author: "Platform Team"
category: "Authorization"
date: 1790726400000
lastUpdated: 1790899200000
editedAt: 1793976836000
coverImage: "/images/covers/technical/authorization/frontend.webp"
---

# Frontend Authorization

> [!CAUTION]
> **Everything on this page is UX, not security.** A user can open DevTools, change
> JavaScript, or call the API with curl. The backend re-checks every request
> ([backend guide](./backend.md)). The frontend's job is only to avoid showing people
> things they cannot use (spec §2, §61, §111).

---

## 1. The one API every app uses

Every app shows and hides UI with a [CASL](https://casl.js.org) **ability**: an object that answers
"may this session do *this action* on *this kind of thing*?". The words it uses are the permission
catalogue's own (ADR 067): the action is a catalogue verb, the subject a catalogue noun, both upper-case.

```ts
ability.can("DELETE", "PRODUCT")   // same question as "does the session hold platform:product.delete?"
```

| Piece | Where | What it does |
|---|---|---|
| `AppAbility`, `defineSessionAbility(capabilities, namespace)` | `@workspace/shared` (`packages/shared/src/authorization/ability.ts`) | builds the ability from the session's capability slugs; `namespace` is `"platform"` (admin, web, mobile) or `"merchant"` (merchant app) |
| `permissionOfCapability(slug)` | same file | the catalogue permission (`{ action, resource }`) behind a slug, or `null` for an unknown slug |
| `abilityAllowsCapability(ability, slug)` | same file | the same check for a slug you hold in a variable (a gate prop, a nav rule, a lookup table) |
| `SessionAbilityProvider`, `<Can>`, `useAbility()` | `@workspace/client/lib/contexts/authorization` (`packages/client/src/lib/contexts/authorization/index.tsx`) | provides the ability and reads it, typed wrappers over `@casl/react` |
| Mobile: `SessionCapabilitiesProvider`, `<Can>`, `useAbility()`, `useCapabilities()` | `apps/mobile/src/features/authorization` (import from `facade.ts`) | the same API on the phone, fed by `GET /auth/permissions` ([ADR 038](../../adr/038-mobile-app-drawer.md)) |

The ability is a **copy of what the API already decided**, not a second set of rules. Each held slug
becomes one plain "can": no conditions, no ownership, no store scope. The API and PostgreSQL row-level
security still check every request.

Why CASL, and why the catalogue's words: see the decision record
[ADR 091 — CASL frontend ability](../../adr/091-casl-frontend-ability.md).

### 1.1 The provider: `SessionAbilityProvider`

```tsx
import { SessionAbilityProvider } from "@workspace/client/lib/contexts/authorization";

<SessionAbilityProvider capabilities={capabilities} namespace="platform">
	{children}
</SessionAbilityProvider>
```

| Prop | Meaning |
|---|---|
| `capabilities` | the granted slugs (`GET /auth/permissions`, or the merchant membership's). **Empty → nothing is allowed** (signed out, loading, failed) |
| `namespace` | `"platform"` or `"merchant"`: only slugs with that prefix go into the ability |

- A new capability list (sign-in, tenant switch, role change, sign-out) builds a new ability, so every
  check re-renders.
- Every app mounts one at its root (§2). Outside a provider, `useAbility()` and `<Can>` **deny everything**
  (ADR 092): a check rendered where no provider is mounted hides what it guards instead of crashing the page. In a
  test, wrap the component in a `SessionAbilityProvider` to allow something (see [testing](./recipes.md#frontend-tests)).
- When the API refuses a request because of the session's capabilities (`PERMISSION_DENIED`,
  `TENANT_ROLE_CAPABILITY_REQUIRED`), each app re-reads them (`useRefreshOnCapabilityRefusal`, and the merchant tenant
  context), so the actions the member just lost disappear.
- The ability object is built here (`defineSessionAbility`, from `@workspace/shared`'s `abilityRules`), not in
  `@workspace/shared`, so the shared package never loads CASL at runtime.

### 1.2 The hook: `useAbility()`

```tsx
import { useAbility } from "@workspace/client/lib/contexts/authorization";

function RoleActions(): React.JSX.Element {
	const ability = useAbility();

	if (ability.can("UPDATE", "ROLE")) {
		return <AssignRoleButton />;
	} else {
		return <AccessRestrictedNotice>You can view roles but not change them.</AccessRestrictedNotice>;
	}
}
```

| Call | Meaning |
|---|---|
| `ability.can(action, subject)` | true when allowed |
| `ability.cannot(action, subject)` | `!can(...)` — reads better for `disabled={ability.cannot(...)}` |
| several checks | plain JavaScript: `a && b` (all), `a \|\| b` (any) |

- A check needs **that exact** permission: there is no catch-all action (ADR 067 retired `MANAGE`), so
  holding `UPDATE` on `USER` never makes `ability.can("DELETE", "USER")` true.
- When the slug is in a variable (a gate's `capability` prop, a lookup table, a menu rule), use
  `abilityAllowsCapability(ability, slug)` instead of splitting the slug yourself:

```tsx
import { abilityAllowsCapability } from "@workspace/shared";

const ability = useAbility();
const allowed = abilityAllowsCapability(ability, ACTION_PERMISSION[action]);
```

### 1.3 The component: `<Can>`

```tsx
import { Can } from "@workspace/client/lib/contexts/authorization";

<Can I="DELETE" a="USER">
	<DeleteUserButton />
</Can>

<Can not I="UPDATE" a="ROLE">
	<AccessRestrictedNotice>You can view roles but not change them.</AccessRestrictedNotice>
</Can>

<Can I="APPROVE" a="MERCHANT_ORG" passThrough>
	{({ isAllowed }): React.ReactNode => (isAllowed ? <ReviewForm /> : <AccessRestrictedNotice />)}
</Can>
```

| Prop | Meaning |
|---|---|
| `I` + `a` | the action and the subject (both type-checked) |
| `not` | render the children when **denied** instead |
| `passThrough` + a function child | always call the function with `{ isAllowed }` — use it for a fallback |

### 1.4 Decisions about one record

`ability.can()` answers from the session's capabilities: "may this person delete users at all?". Whether
they may act on **one** record (their own store, a reward in review) depends on rules the browser
must not re-implement. Show the action when the capability is held, and let the API decide on the
record: it answers `403` when the rule says no. For several checks at once, ask
`POST /api/v1/authorization/decisions` ([backend §14](./backend.md#14-the-decisions-endpoint-for-uis)).

### 1.5 Vocabulary — never type slugs by hand

The ability's actions and subjects are typed from the catalogue, so a typo does not compile:

❌ `ability.can("DELTE", "USER")` — does not compile.
✅ `ability.can("DELETE", "USER")`.

When you hold a slug (gate props, menus, tests), take it from the constants:

```ts
import { PERMISSION, MERCHANT_CAPABILITY } from "@workspace/shared";

PERMISSION.USER.DELETE             // "platform:user.delete"        → ("DELETE", "USER")
PERMISSION.ADMIN_DASHBOARD.READ    // "platform:admin_dashboard.read" → ("READ", "ADMIN_DASHBOARD")
MERCHANT_CAPABILITY.manageRewards  // "merchant:manage_rewards"     → ("UPDATE", "REWARD")
```

Merchant capabilities map to catalogue permissions through `MERCHANT_CAPABILITY_PERMISSION`
(`packages/shared/src/authorization/permission.ts`), so in the merchant app
`<Can I="UPDATE" a="REWARD">` means "holds `manageRewards`".

❌ `abilityAllowsCapability(ability, "platform:user.delte")` compiles and silently denies forever.
✅ `abilityAllowsCapability(ability, PERMISSION.USER.DELTE)` does not compile — the typo is caught.

---

## 2. Where capabilities come from

| App | Source | Freshness |
|---|---|---|
| Admin | `GET /auth/permissions`, preloaded on the server in `app/(panel)/layout.tsx`, then `useSessionPermissionsQuery()` (`lib/session/capabilities.ts`) | refetch on window focus + every 60 s; **live data wins even when empty** (a user whose permissions were all revoked immediately sees nothing) |
| Web | same endpoint, in `WebAuthorizationProvider` (`contexts/identity/components/web-authorization-provider.tsx`) mounted in `app/layout.tsx` | same rules; **guests never call the endpoint** and get an empty set |
| Merchant | the active tenant membership (`api.tenants.membershipsBootstrap`) → its `capabilities` (the API's answer: role plus live grants, ADR 067), in `MerchantAuthorizationProvider`; the server page guard reads the same memberships per request | refetched with the memberships query |
| Mobile | `GET /auth/permissions`, in `SessionCapabilitiesProvider` (`src/features/authorization/authorization.tsx`) mounted in `src/features/app-shell/app-shell.tsx` | nothing is allowed until the list has loaded, or when it fails |

Each app turns that list into the session's ability with one `SessionAbilityProvider` at its root:

| App | Root provider | Namespace |
|---|---|---|
| Admin | `SessionAbilityProvider` in `components/layout/dashboard-layout.tsx` | `platform` |
| Web | `WebAuthorizationProvider` → `SessionAbilityProvider` | `platform` |
| Merchant | `MerchantAuthorizationProvider` → `SessionAbilityProvider` | `merchant` |
| Mobile | `SessionCapabilitiesProvider` → the mobile `SessionAbilityProvider` | `platform` (fixed) |

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
| Provider | `components/layout/dashboard-layout.tsx` | mounts `SessionAbilityProvider` (namespace `platform`) with live capabilities |
| Page requirements | `lib/navigation/menu-authorization.ts` | `ADMIN_MENU_AUTHORIZATION`: sidebar URL → `PERMISSION.*` requirement, one line per page with a comment naming the API route it mirrors |
| Route rules | `lib/navigation/route-authorization.ts` | built from the menu + explicit per-page rules (`ROUTE_PATTERNS` in `lib/routes.ts`: detail pages need READ, edit pages UPDATE); the most specific pattern wins (a literal segment beats `[id]`); disabled menu items create no rules; `superAdminOnly` rules for `@SuperAdminOnly` pages |
| Route guard | `components/access/route-authorization-guard.tsx` | renders `AdminAccessDenied` when the current page's rule is not met — also during the server render (permissions are loaded server-side), so a denied page never flashes; while the permissions (or the super-admin flag) are still resolving it renders the content-area skeleton (`PanelContentSkeleton`, "Checking your access…") — never the page, never a denial |
| Visible ⇔ allowed | `filterMenuByRouteAccess` + `canAccessRoute` (`AuthorizedNavigationProvider` in `dashboard-layout.tsx`) | the sidebar, ⌘K palette (items + quick actions), pinned items, topbar and profile links all use the guard's own rules — an item is shown exactly when its page would render |
| Coverage test | `lib/navigation/page-authorization.test.ts` | every `app/**/page.tsx` has a reviewed rule (both directions), and "visible ⇔ allowed" holds for every capability set |
| Super admin | `lib/session/super-admin.ts` | `useSuperAdminStatus()`, `useCanStartImpersonation()` |
| Disabled action | `components/common/disabled-action-button.tsx` | disabled button + tooltip + screen-reader reason |
| Inline notice | `components/common/access-restricted-notice.tsx` | "you can view but not change" message |
| Access denied page | `components/access/admin-access-denied.tsx` | full-page fallback |

Pages never repeat their own route rule in-page (no `<Can>` wrapper, `canView` early return, or
`enabled: ability.can(...)` query flag for the permission the route already requires) — the route guard
is the single page-level check; in-page checks are only for finer-grained actions that need a
*different* permission (e.g. the Edit link on a detail page needs `*.UPDATE`).

What is gated (each maps to the permission of the API route it calls):

| Area | Requirement | When not allowed |
|---|---|---|
| Access control page | any of `ROLE.LIST`, `PERMISSION.LIST`, `PERMISSION.READ`; each tab its own | tab hidden; page denied when none |
| User access panel | assign / remove roles `ROLE.UPDATE`; direct grants `PERMISSION.UPDATE`; permission checker `PERMISSION.READ` | read-only notice, checker hidden |
| Users pages, MFA recovery review | SuperAdmin | hidden / denied |
| Impersonate | SuperAdmin and not already impersonating | hidden |
| Merchants / KYB / locations | `MERCHANT_ORG.LIST`; KYB and store-request decisions `MERCHANT_ORG.APPROVE`; suspend / reinstate / reject an appeal `MERCHANT_ORG.SUSPEND` / `REACTIVATE` / `REJECT` | read-only notice |
| Pending rewards review, approve / reject | `REWARD.APPROVE` (the page's own rule); the Reject button also needs `REWARD.REJECT` | page denied |
| Invites | `MERCHANT_ORG.CREATE` | page denied |
| Emails / email log / send test email | `EMAIL.READ` / `EMAIL.LIST` / `EMAIL.CREATE` | page denied / disabled button with reason |
| Geo | `GEO.READ` | page denied |
| Sales analytics page (`GET /admin/analytics/sales`) | `ANALYTICS.READ` | page denied |
| Overview "Platform sales" cards (same endpoint; the overview itself is open) | `ANALYTICS.READ` | section hidden, never queried |
| Products, sample categories | list `*.LIST`; create `*.CREATE`; view `*.READ`; edit `*.UPDATE`; delete `*.DELETE` | create disabled with reason; row actions hidden; detail / edit pages denied |

---

## 5. Merchant app (`apps/merchant`)

Every merchant gate checks a **`merchant:*` capability** (`MERCHANT_CAPABILITY.*`) — never a
membership role name. Capabilities come from the active membership's `capabilities` — what the API
decided the member holds (their tenant role plus live grants); `resolveMerchantCapabilities` falls back
to the role's template only when a membership carries none (see the
[backend role table](./backend.md#12-merchant-capabilities)).

| Building block | File |
|---|---|
| Provider | `contexts/tenancy/components/access/merchant-authorization-provider.tsx` — `MerchantAuthorizationProvider` (feeds `SessionAbilityProvider` with namespace `merchant`), `useMerchantAuthorizationStatus()` (`isLoading`, `capabilities`) |
| Capability gate | `contexts/tenancy/components/access/merchant-capability-gate.tsx` — `MerchantCapabilityGate` (while the membership resolves it renders its `loading` prop — each page view passes its own page skeleton, the same one its `loading.tsx` draws — or a generic page skeleton announcing "Checking access…"; then `abilityAllowsCapability(ability, capability)`, denied → its `fallback`, default `MerchantAccessDenied`), `MerchantAccessDenied`, `MerchantReadOnlyNotice` |
| Capability hook | `lib/org/capabilities.ts` — `useMerchantCapabilities()` (membership → capabilities) |
| **Org route map** | `lib/navigation/org-route-authorization.ts` — `ORG_PAGE_RULES`: every page under `app/tenants/[orgSlug]/` → its capability requirement, or explicitly `open` with a reason |
| **Server page guard** | `lib/org/org-page-guard.tsx` — `guardOrgPage(orgSlug, route)`; decision in `lib/org/org-page-access.ts` |

### 5.1 Page guard (brute-force navigation)

Every org page calls the guard **first**, on the server, before it fetches anything:

```tsx
export default async function TenantTeamPage({ params }: Props): Promise<React.JSX.Element> {
	const { orgSlug } = await params;
	const denied = await guardOrgPage(orgSlug, "/settings/team");
	if (denied !== null) {
		return denied; // MerchantAccessDenied, rendered on the server
	}
	return <TenantTeamPageView orgSlug={tenantSlug} />;
}
```

- The guard reads the membership for **the tenant in the URL** (never another
  membership's role) and evaluates the route's rule in `ORG_PAGE_RULES`. No membership in that
  tenant → denied.
- It runs per page, not in the org layout: layouts do not re-render on client-side navigation,
  so a layout check would be skipped when moving between org pages.
- `lib/navigation/org-route-authorization.test.ts` fails when a page has no rule, a rule has no
  page, or a page does not call `guardOrgPage` with its own route before loading data.
- The same map drives the command palette and pinned items (`filterMerchantNavItems` →
  `canOpenOrgPath`); the sidebar JSON carries identical `authorization` blocks (enforced by the
  same test), so an item is **hidden exactly when its page would be denied**.

| Route (org-relative) | Requirement | Denied → |
|---|---|---|
| `/` | open (redirects to the dashboard) | — |
| `/dashboard` | `viewDashboard` | denied page |
| `/rewards`, `/rewards/[rewardId]` | `viewRewards`; the edit and submit-for-review actions need `manageRewards` | denied page; actions / create hidden |
| `/rewards/new`, `/rewards/[rewardId]/edit` | `manageRewards` | denied page |
| `/redemptions` | `viewRedemptions` | denied page (no query is sent) |
| `/analytics` | `viewAnalytics` | denied page (no query is sent) |
| `/terminals` | `manageApiKeys` (a paired till receives an API key) | denied page (no query is sent) |
| `/api-keys` | `manageApiKeys` | denied page |
| `/settings` | any of `manageTeam`, `viewLocations`, `manageVerification` | denied page; each card shows only with its page's capability |
| `/settings/team` | `manageTeam` (Owner, Manager) | "Team access required" |
| `/settings/locations` | `viewLocations` (every member); add / resubmit store needs `manageLocations` | denied page; action hidden + read-only notice |
| `/settings/branding` | `viewLocations` (every member); uploading or removing the logo needs `manageLocations` (the API's `STORE_LOGO` rule) | denied page; controls disabled + read-only notice |
| `/settings/verification` | `manageVerification` (`OWNER` only — the API enforces the same) | "Owner access required" |
| `/account` | open (personal account; enrollment sessions must reach it) | — |

```tsx
// manageRewards is ("UPDATE", "REWARD") in the catalogue
<Can I="UPDATE" a="REWARD" passThrough>
	{({ isAllowed }): React.ReactNode =>
		isAllowed ? <CreateRewardButton /> : <MerchantReadOnlyNotice>Only managers can create rewards.</MerchantReadOnlyNotice>
	}
</Can>

<MerchantCapabilityGate capability={MERCHANT_CAPABILITY.manageVerification}>
	<KybForm />
</MerchantCapabilityGate>
```

---

## 6. Web app (`apps/web`)

| Building block | File |
|---|---|
| Provider | `contexts/identity/components/web-authorization-provider.tsx` — one provider for the whole app (wraps `SessionAbilityProvider`, namespace `platform`); `useWebSession()` |
| Section gate | `contexts/identity/components/access-gate.tsx` — `AccessGate` (checks its `permission` / `permissions` slugs with `abilityAllowsCapability`): guest → sign-in prompt; signed in without permission → "not available for your account"; allowed → children; loading → nothing |
| Fallback UI | `components/auth/access-fallback.tsx` |
| Route table | `lib/navigation/route-access.ts` — `WEB_ROUTE_ACCESS`: every page's audience (public / guest-only / signed-in), optional capability, breadcrumb label; tested against `proxy.ts` and the pages on disk |
| Route guard | `components/auth/route-access-guard.tsx` — `WebRouteAccessGuard` in the dashboard shell: sign-in prompt or "not available" for a page whose capability is missing |
| Visible ⇔ allowed | sidebar (`applyWebRouteAuthorization`), ⌘K palette, quick actions and pinned items all filter through `useCanAccessWebPath` |

| Area | API rule | Gate |
|---|---|---|
| Impersonation panel | `@SuperAdminOnly` + `USER.LIST` / `USER.CREATE` | super admin with both, not already impersonating |
| Impersonation banner | signed in | only while impersonating |
| Claim flow, my claims, QR, activity, account settings | signed in | sign-in prompt for guests |
| Browse, reward details, landing | public | none |

A customer screen for a record the customer owns gates on an `OWN`-scoped permission
(`PERMISSION.PROFILE.UPDATE`, …) and lets the API enforce ownership. A new owned resource
first needs its owner lookup in `ResourceOwnershipResolver` (see [backend](./backend.md#53-ownership)).

---

## 7. Sidebar filtering (all apps)

Menus are **application-owned config** (spec §14): admin `lib/navigation/sidebar-menu.json` +
`menu-authorization.ts`; merchant `lib/navigation/merchant-sidebar-menu.json` (each item's `authorization`
must equal its page's rule in `ORG_PAGE_RULES`). The schema is in
`packages/shared/src/lib/navigation-menu/sidebar-menu-schema.ts` (re-exported from `packages/client`; the mobile drawer's `mobile-drawer-items.json` uses it too, see ADR 038):

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
(`packages/shared/src/lib/navigation-menu/filter-sidebar-menu-by-capabilities.ts`) applies:

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
6. Add a test with and without the capability (see [testing](./recipes.md#frontend-tests)).
7. Remember: the API must still enforce it. If it does not, fix the API first.
