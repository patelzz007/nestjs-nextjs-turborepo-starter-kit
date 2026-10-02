import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { createGrantedCapabilities, isCapabilityGranted } from "@workspace/client/lib/auth/permission-check";
import type { CompiledSidebarMenuData, CompiledSidebarMenuItem } from "@workspace/client/lib/sidebar/sidebar-menu-schema";
import { MERCHANT_CAPABILITY, MerchantCapabilitySchema, OrganizationMembershipRoleSchema, type CapabilitySlug, type OrganizationMembershipRole } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { filterCompiledSidebarMenu } from "@/lib/navigation/filter-menu-by-capabilities";
import { canOpenOrgPath, isOrgPageRuleSatisfied, ORG_PAGE_RULES, OrgPageRouteSchema, resolveOrgPageRoute, type OrgPageRoute } from "@/lib/navigation/org-route-authorization";
import { MERCHANT_SIDEBAR_MENU } from "@/lib/navigation/sidebar-menu";
import { resolveMerchantCapabilities } from "@/lib/session/server-capabilities";
import { membershipFixture } from "@/test/authorization";

const ORG_APP_DIR: string = fileURLToPath(new URL("../../app/orgs/[orgSlug]", import.meta.url));

interface OrgPageFile {
	/** Org-relative route pattern, e.g. `/rewards/[rewardId]/edit`. */
	readonly route: string;
	readonly source: string;
}

function collectOrgPages(directory: string): readonly OrgPageFile[] {
	const pages: OrgPageFile[] = [];
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const entryPath = join(directory, entry.name);
		if (entry.isDirectory()) {
			pages.push(...collectOrgPages(entryPath));
			continue;
		}
		if (entry.name !== "page.tsx") {
			continue;
		}
		const segments = relative(ORG_APP_DIR, directory)
			.split(sep)
			.filter((segment) => segment.length > 0);
		pages.push({ route: `/${segments.join("/")}`, source: readFileSync(entryPath, "utf8") });
	}
	return pages;
}

const ORG_PAGES: readonly OrgPageFile[] = collectOrgPages(ORG_APP_DIR);

/** Server data access a page must not start before its guard has run. */
const DATA_ACCESS_MARKERS: readonly string[] = ["loadMerchantServerContext(", ".query(", "readOrganizationLocationCookie("];

function predicateFor(role: OrganizationMembershipRole | undefined): (capability: CapabilitySlug) => boolean {
	const granted = createGrantedCapabilities(resolveMerchantCapabilities(role === undefined ? undefined : membershipFixture(role)));
	return (capability: CapabilitySlug): boolean => isCapabilityGranted(granted, capability);
}

interface FlatSidebarItem {
	readonly item: CompiledSidebarMenuItem;
	readonly isEnabled: boolean;
}

function flattenSidebar(menu: CompiledSidebarMenuData): readonly FlatSidebarItem[] {
	const rows: FlatSidebarItem[] = [];
	const walk = (item: CompiledSidebarMenuItem, parentEnabled: boolean): void => {
		const isEnabled = parentEnabled && item.disabled !== true;
		rows.push({ item, isEnabled });
		for (const child of item.children ?? []) {
			walk(child, isEnabled);
		}
	};
	for (const item of [...menu.sections.flatMap((section) => section.items), ...menu.bottomItems]) {
		walk(item, true);
	}
	return rows;
}

const SIDEBAR_ROWS: readonly FlatSidebarItem[] = flattenSidebar(MERCHANT_SIDEBAR_MENU);

function visibleSidebarUrls(role: OrganizationMembershipRole | undefined): readonly string[] {
	const membership = role === undefined ? undefined : membershipFixture(role);
	const filtered = filterCompiledSidebarMenu(MERCHANT_SIDEBAR_MENU, resolveMerchantCapabilities(membership));
	return [
		...new Set(
			flattenSidebar(filtered)
				.filter((row) => row.isEnabled)
				.map((row) => row.item.url),
		),
	];
}

function byName(left: string, right: string): number {
	return left.localeCompare(right);
}

const ROLES_AND_GUEST: readonly (OrganizationMembershipRole | undefined)[] = [...OrganizationMembershipRoleSchema.options, undefined];

describe("org route map ↔ app/orgs/[orgSlug] pages", () => {
	it("discovers the org pages it guards", () => {
		expect(ORG_PAGES.map((page) => page.route)).toContain("/settings/team");
		expect(ORG_PAGES.map((page) => page.route)).toContain("/rewards/[rewardId]/edit");
	});

	it("has an explicit rule for every org page and a page for every rule (no route silently unguarded)", () => {
		const pageRoutes = ORG_PAGES.map((page) => page.route).sort(byName);
		const ruleRoutes = [...OrgPageRouteSchema.options].sort(byName);

		expect(pageRoutes).toEqual(ruleRoutes);
	});

	it.each(ORG_PAGES.map((page): [string, string] => [page.route, page.source]))("page %s calls guardOrgPage with its own route before loading data", (route, source) => {
		const guardCall = `guardOrgPage(orgSlug, "${route}")`;
		const guardIndex = source.indexOf(guardCall);

		expect(guardIndex).toBeGreaterThan(-1);
		expect(source).toContain("if (denied !== null) {\n\t\treturn denied;\n\t}");
		const earlierDataAccess = DATA_ACCESS_MARKERS.filter((marker) => {
			const markerIndex = source.indexOf(marker);
			return markerIndex !== -1 && markerIndex < guardIndex;
		});
		expect(earlierDataAccess).toEqual([]);
	});

	it("documents why each open route carries no capability", () => {
		const openRoutes = OrgPageRouteSchema.options.filter((route) => ORG_PAGE_RULES[route].kind === "open");

		expect(openRoutes).toEqual(["/", "/account"]);
		for (const route of openRoutes) {
			const rule = ORG_PAGE_RULES[route];
			expect(rule.kind === "open" ? rule.reason.length : 0).toBeGreaterThan(0);
		}
	});

	it("only requires merchant capabilities that exist in the shared vocabulary", () => {
		const unknown = OrgPageRouteSchema.options.flatMap((route) => {
			const rule = ORG_PAGE_RULES[route];
			return rule.kind === "open" ? [] : rule.requirement.permissions.filter((capability) => !MerchantCapabilitySchema.safeParse(capability).success);
		});
		expect(unknown).toEqual([]);
	});
});

describe("resolveOrgPageRoute", () => {
	it.each([
		["/", "/"],
		["/settings", "/settings"],
		["/settings/team", "/settings/team"],
		["/settings/team?tab=invites", "/settings/team"],
		["/rewards/new", "/rewards/new"],
		["/rewards/3f1c2b8e/edit", "/rewards/[rewardId]/edit"],
	] satisfies [string, OrgPageRoute][])("maps %s to %s", (path, route) => {
		expect(resolveOrgPageRoute(path)).toBe(route);
	});

	it.each(["/settings/kyb", "/rewards/3f1c2b8e", "/support"])("returns undefined for %s (no page) so callers fail closed", (path) => {
		expect(resolveOrgPageRoute(path)).toBeUndefined();
		expect(canOpenOrgPath(path, () => true)).toBe(false);
	});
});

describe("org page rules per membership role", () => {
	const EXPECTED_SETTINGS_ACCESS: readonly [OrganizationMembershipRole | undefined, boolean, boolean, boolean, boolean][] = [
		// role,         settings index, team,  locations, verification
		["OWNER", true, true, true, true],
		["ADMIN", true, true, true, false],
		["CASHIER", true, false, true, false],
		["POLICY_ADMIN", true, false, true, false],
		["MEMBER", true, false, true, false],
		[undefined, false, false, false, false],
	];

	it.each(EXPECTED_SETTINGS_ACCESS)("%s → settings %s, team %s, locations %s, verification %s", (role, settings, team, locations, verification) => {
		const isGranted = predicateFor(role);

		expect(isOrgPageRuleSatisfied(ORG_PAGE_RULES["/settings"], isGranted)).toBe(settings);
		expect(isOrgPageRuleSatisfied(ORG_PAGE_RULES["/settings/team"], isGranted)).toBe(team);
		expect(isOrgPageRuleSatisfied(ORG_PAGE_RULES["/settings/locations"], isGranted)).toBe(locations);
		expect(isOrgPageRuleSatisfied(ORG_PAGE_RULES["/settings/verification"], isGranted)).toBe(verification);
	});

	it("gates POS terminals exactly like API keys (a paired till receives an API key)", () => {
		expect(ORG_PAGE_RULES["/terminals"]).toEqual(ORG_PAGE_RULES["/api-keys"]);
		for (const role of ROLES_AND_GUEST) {
			const isGranted = predicateFor(role);
			expect(isOrgPageRuleSatisfied(ORG_PAGE_RULES["/terminals"], isGranted)).toBe(isGranted(MERCHANT_CAPABILITY.manageApiKeys));
		}
	});

	it("keeps the personal account reachable for every session, even without a membership", () => {
		for (const role of ROLES_AND_GUEST) {
			expect(isOrgPageRuleSatisfied(ORG_PAGE_RULES["/account"], predicateFor(role))).toBe(true);
		}
	});
});

describe("merchant sidebar ↔ org route map", () => {
	it("uses only known merchant capability slugs", () => {
		const unknown = SIDEBAR_ROWS.flatMap((row) => row.item.authorization?.permissions ?? []).filter((slug) => !MerchantCapabilitySchema.safeParse(slug).success);
		expect(unknown).toEqual([]);
	});

	it("gives every item the same requirement as the page it opens", () => {
		const mismatches = SIDEBAR_ROWS.flatMap((row) => {
			const route = resolveOrgPageRoute(row.item.url);
			if (route === undefined) {
				// Placeholder entries without a page must stay switched off.
				return row.isEnabled ? [`${row.item.title} → ${row.item.url} has no page`] : [];
			}
			const rule = ORG_PAGE_RULES[route];
			const expected = rule.kind === "open" ? undefined : { permissions: [...rule.requirement.permissions].sort(byName), mode: rule.requirement.mode ?? "any" };
			const authorization = row.item.authorization;
			const actual = authorization === undefined ? undefined : { permissions: [...authorization.permissions].sort(byName), mode: authorization.mode ?? "any" };
			return JSON.stringify(actual) === JSON.stringify(expected) ? [] : [`${row.item.title} → ${row.item.url}`];
		});
		expect(mismatches).toEqual([]);
	});

	it.each(ROLES_AND_GUEST.map((role): [string, OrganizationMembershipRole | undefined] => [role ?? "no membership", role]))(
		"shows %s exactly the pages it may open (hidden when denied, never disabled-but-visible)",
		(_label, role) => {
			const visible = new Set(visibleSidebarUrls(role));
			const isGranted = predicateFor(role);
			const navigableUrls = [...new Set(SIDEBAR_ROWS.filter((row) => row.isEnabled && resolveOrgPageRoute(row.item.url) !== undefined).map((row) => row.item.url))];

			const wronglyShown = navigableUrls.filter((url) => visible.has(url) && !canOpenOrgPath(url, isGranted));
			const wronglyHidden = navigableUrls.filter((url) => !visible.has(url) && canOpenOrgPath(url, isGranted));
			expect(wronglyShown).toEqual([]);
			expect(wronglyHidden).toEqual([]);
		},
	);

	it("hides Team and Verification from cashiers but keeps Locations", () => {
		const visible = visibleSidebarUrls("CASHIER");

		expect(visible).toContain("/settings/locations");
		expect(visible).toContain("/settings");
		expect(visible).not.toContain("/settings/team");
		expect(visible).not.toContain("/settings/verification");
		expect(visible).not.toContain("/api-keys");
		expect(visible).not.toContain("/terminals");
		expect(visible).not.toContain("/rewards/new");
	});

	it("hides only Verification from admins", () => {
		const visible = visibleSidebarUrls("ADMIN");

		expect(visible).toContain("/settings/team");
		expect(visible).toContain("/settings/locations");
		expect(visible).not.toContain("/settings/verification");
	});

	it("shows owners every organization setting", () => {
		expect(visibleSidebarUrls("OWNER")).toEqual(expect.arrayContaining(["/settings", "/settings/team", "/settings/locations", "/settings/verification"]));
	});

	it("leaves only the personal account without a membership", () => {
		expect(visibleSidebarUrls(undefined)).toEqual(["/account"]);
	});

	it("gates the settings pages on the new organization capabilities", () => {
		expect(ORG_PAGE_RULES["/settings/team"]).toMatchObject({ requirement: { permissions: [MERCHANT_CAPABILITY.manageTeam] } });
		expect(ORG_PAGE_RULES["/settings/locations"]).toMatchObject({ requirement: { permissions: [MERCHANT_CAPABILITY.viewLocations] } });
		expect(ORG_PAGE_RULES["/settings/verification"]).toMatchObject({ requirement: { permissions: [MERCHANT_CAPABILITY.manageVerification] } });
	});
});
