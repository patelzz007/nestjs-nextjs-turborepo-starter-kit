import { PERMISSION } from "@workspace/shared";

import type { SidebarAuthorization, SidebarMenuData, SidebarMenuItem } from "@workspace/client/lib/sidebar/sidebar-menu-schema";

import { ROUTES } from "@/lib/routes";

/**
 * Sidebar item URL → the capability its page needs, mirroring the API route
 * the page loads (`@RequirePermission` on the Nest controller). Kept in
 * TypeScript so every slug is a compile-checked `PERMISSION.*` value; the
 * same requirement drives the sidebar, the command palette, and the route
 * guard (via `buildRouteAuthorizationRules`). `@SuperAdminOnly` pages have no
 * slug — they are listed in the route rules as `superAdminOnly` instead.
 */
export const ADMIN_MENU_AUTHORIZATION: ReadonlyMap<string, SidebarAuthorization> = new Map<string, SidebarAuthorization>([
	// GET /admin/analytics/dashboard + /admin/analytics/export (READ ANALYTICS)
	[ROUTES.analytics.index, { permissions: [PERMISSION.ANALYTICS.READ] }],
	// GET /admin/roles (LIST ROLE) · GET /admin/permissions (LIST PERMISSION) · POST /admin/permissions/check (READ PERMISSION)
	[ROUTES.settings.access, { permissions: [PERMISSION.ROLE.LIST, PERMISSION.PERMISSION.LIST, PERMISSION.PERMISSION.READ], mode: "any" }],
	// GET /notifications/email-preview (READ EMAIL)
	[ROUTES.emails.templates, { permissions: [PERMISSION.EMAIL.READ] }],
	// GET /notifications/email-log (LIST EMAIL)
	[ROUTES.emails.log, { permissions: [PERMISSION.EMAIL.LIST] }],
	// GET /geo/stats, /geo/countries… (READ GEO)
	[ROUTES.geography.index, { permissions: [PERMISSION.GEO.READ] }],
	// GET /admin/merchants (LIST MERCHANT_ORG). The "Merchants" section shares
	// this URL with its "All merchants" index child, so both carry it.
	[ROUTES.merchants.list, { permissions: [PERMISSION.MERCHANT_ORG.LIST] }],
	// GET /admin/rewards/pending (MANAGE REWARD)
	[ROUTES.rewards.review, { permissions: [PERMISSION.REWARD.MANAGE] }],
	// POST /admin/invites, /admin/invites/preview-email (MANAGE MERCHANT_ORG)
	[ROUTES.merchants.invites, { permissions: [PERMISSION.MERCHANT_ORG.MANAGE] }],
	// GET /admin/merchants/:id (LIST MERCHANT_ORG)
	[ROUTES.merchants.verification, { permissions: [PERMISSION.MERCHANT_ORG.LIST] }],
	// GET /admin/location-requests (LIST MERCHANT_ORG)
	[ROUTES.merchants.storeRequests, { permissions: [PERMISSION.MERCHANT_ORG.LIST] }],
	// GET /sample-category (LIST SAMPLE_CATEGORY)
	[ROUTES.catalog.categories.list, { permissions: [PERMISSION.SAMPLE_CATEGORY.LIST] }],
	// GET /product (LIST PRODUCT)
	[ROUTES.catalog.products.list, { permissions: [PERMISSION.PRODUCT.LIST] }],
]);

function applyToItem(item: SidebarMenuItem, requirements: ReadonlyMap<string, SidebarAuthorization>): SidebarMenuItem {
	const authorization = requirements.get(item.url) ?? item.authorization;
	const children = item.children?.map((child) => applyToItem(child, requirements));
	return {
		...item,
		...(authorization !== undefined ? { authorization } : {}),
		...(children !== undefined ? { children } : {}),
	};
}

/** Returns `menu` with each item's `authorization` taken from `requirements` (by URL) when listed there. */
export function applyMenuAuthorization(menu: SidebarMenuData, requirements: ReadonlyMap<string, SidebarAuthorization>): SidebarMenuData {
	return {
		header: menu.header,
		sections: menu.sections.map((section) => ({ ...section, items: section.items.map((item) => applyToItem(item, requirements)) })),
		bottomItems: menu.bottomItems.map((item) => applyToItem(item, requirements)),
	};
}
