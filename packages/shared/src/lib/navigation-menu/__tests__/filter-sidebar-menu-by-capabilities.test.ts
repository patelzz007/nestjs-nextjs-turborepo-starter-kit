import { describe, expect, it } from "vitest";

import type { CompiledSidebarMenuData, SidebarMenuData, SidebarMenuItem } from "../sidebar-menu-schema";
import { PERMISSION } from "../../../authorization/permission";
import { LIST_SLOT_INDEX } from "../../named-list-index";

import { SidebarMenuDataSchema } from "../sidebar-menu-schema";
import { evaluateSidebarAuthorization, filterCompiledSidebarMenu, filterSidebarMenuData } from "../filter-sidebar-menu-by-capabilities";

const A = "platform:a.read";
const B = "platform:b.read";
const C = "platform:c.read";

const FULL: readonly string[] = [A, B, C];
const NONE: readonly string[] = [];
const ONLY_A: readonly string[] = [A];
const ONLY_B: readonly string[] = [B];
const A_AND_B: readonly string[] = [A, B];

function rawMenu(overrides?: Partial<SidebarMenuData>): SidebarMenuData {
	return {
		header: { title: "Test", subtitle: "Suite" },
		sections: [{ title: "Main", labelKey: "main", items: [{ title: "Home", labelKey: "home", url: "/" }] }],
		bottomItems: [],
		...overrides,
	};
}

function compiledMenu(overrides?: Partial<CompiledSidebarMenuData>): CompiledSidebarMenuData {
	return {
		header: { title: "Test", subtitle: "Suite" },
		sections: [{ title: "Main", key: "Main", labelKey: "main", items: [{ id: "main-home", title: "Home", labelKey: "home", url: "/" }] }],
		bottomItems: [],
		...overrides,
	};
}

describe("filterSidebarMenuData (raw)", () => {
	it("keeps items with no requirement regardless of capabilities", () => {
		const menu = rawMenu({
			sections: [
				{
					title: "Main",
					labelKey: "main",
					items: [
						{ title: "Home", labelKey: "home", url: "/" },
						{ title: "Secret", labelKey: "secret", url: "/secret", authorization: { permissions: [A] } },
					],
				},
			],
		});

		const result = filterSidebarMenuData(menu, NONE);

		expect(result.sections[LIST_SLOT_INDEX.first]?.items.map((item) => item.title)).toEqual(["Home"]);
	});

	it("removes unauthorized leaves", () => {
		const menu = rawMenu({
			sections: [{ title: "Main", labelKey: "main", items: [{ title: "Secret", labelKey: "secret", url: "/secret", authorization: { permissions: [A] } }] }],
		});

		const result = filterSidebarMenuData(menu, NONE);

		expect(result.sections).toHaveLength(0);
	});

	it("keeps structural parents when at least one child survives (spec 115)", () => {
		const menu = rawMenu({
			sections: [
				{
					title: "Users",
					labelKey: "users",
					items: [
						{
							title: "Users",
							labelKey: "users",
							url: "/users",
							children: [
								{ title: "All Users", labelKey: "all-users", url: "/users/all", authorization: { permissions: [A] } },
								{ title: "Roles", labelKey: "roles", url: "/users/roles", authorization: { permissions: [B] } },
							],
						},
					],
				},
			],
		});

		const result = filterSidebarMenuData(menu, ONLY_A);
		const parent = result.sections[LIST_SLOT_INDEX.first]?.items[LIST_SLOT_INDEX.first];

		expect(parent?.title).toBe("Users");
		expect(parent?.children?.map((child) => child.title)).toEqual(["All Users"]);
	});

	it("removes parents with no surviving children — never renders an empty parent (spec 22)", () => {
		const menu = rawMenu({
			sections: [
				{
					title: "Users",
					labelKey: "users",
					items: [
						{
							title: "Users",
							labelKey: "users",
							url: "/users",
							children: [
								{ title: "All Users", labelKey: "all-users", url: "/users/all", authorization: { permissions: [A] } },
								{ title: "Roles", labelKey: "roles", url: "/users/roles", authorization: { permissions: [B] } },
							],
						},
					],
				},
			],
		});

		const result = filterSidebarMenuData(menu, NONE);

		expect(result.sections).toHaveLength(0);
	});

	it("supports mode all — every permission required (spec 19)", () => {
		const menu = rawMenu({
			sections: [
				{
					title: "Main",
					labelKey: "main",
					items: [
						{ title: "Sensitive", labelKey: "sensitive", url: "/sensitive", authorization: { permissions: [A, B], mode: "all" } },
						{ title: "Either", labelKey: "either", url: "/either", authorization: { permissions: [A, B], mode: "any" } },
					],
				},
			],
		});

		const withBoth = filterSidebarMenuData(menu, A_AND_B);
		expect(withBoth.sections[LIST_SLOT_INDEX.first]?.items.map((item) => item.title)).toEqual(["Sensitive", "Either"]);

		const withOne = filterSidebarMenuData(menu, ONLY_A);
		expect(withOne.sections[LIST_SLOT_INDEX.first]?.items.map((item) => item.title)).toEqual(["Either"]);
	});

	it("supports mode any — at least one permission (spec 18)", () => {
		const menu = rawMenu({
			sections: [
				{
					title: "Main",
					labelKey: "main",
					items: [{ title: "Access Control", labelKey: "access-control", url: "/access", authorization: { permissions: [A, B], mode: "any" } }],
				},
			],
		});

		expect(filterSidebarMenuData(menu, ONLY_B).sections[LIST_SLOT_INDEX.first]?.items).toHaveLength(1);
		expect(filterSidebarMenuData(menu, NONE).sections).toHaveLength(0);
	});

	it("cascade true applies the parent requirement to the whole subtree (spec 116)", () => {
		const menu = rawMenu({
			sections: [
				{
					title: "Dashboard",
					labelKey: "dashboard",
					items: [
						{
							title: "Dashboard",
							labelKey: "dashboard",
							url: "/dashboard",
							authorization: { permissions: [A], cascade: true },
							children: [{ title: "Deep", labelKey: "deep", url: "/dashboard/deep", children: [{ title: "Deeper", labelKey: "deeper", url: "/dashboard/deep/x" }] }],
						},
					],
				},
			],
		});

		const granted = filterSidebarMenuData(menu, ONLY_A);
		expect(granted.sections[LIST_SLOT_INDEX.first]?.items[LIST_SLOT_INDEX.first]?.children?.[LIST_SLOT_INDEX.first]?.children?.[LIST_SLOT_INDEX.first]?.title).toBe("Deeper");

		const denied = filterSidebarMenuData(menu, NONE);
		expect(denied.sections).toHaveLength(0);
	});

	it("cascade applies to descendants lacking their own authorization but not when they declare one", () => {
		const menu = rawMenu({
			sections: [
				{
					title: "Hub",
					labelKey: "hub",
					items: [
						{
							title: "Hub",
							labelKey: "hub",
							url: "/hub",
							authorization: { permissions: [A], cascade: true },
							children: [{ title: "Override", labelKey: "override", url: "/hub/override", authorization: { permissions: [B] } }],
						},
					],
				},
			],
		});

		// Has A but not B: the cascade gate passes for the parent, the override
		// denies the child — the authorized parent survives as an accessible leaf (spec 79).
		const onlyA = filterSidebarMenuData(menu, ONLY_A);
		const hub = onlyA.sections[LIST_SLOT_INDEX.first]?.items[LIST_SLOT_INDEX.first];
		expect(hub?.title).toBe("Hub");
		expect(hub?.children).toHaveLength(0);

		// Has both: parent gate and override gate both pass.
		const both = filterSidebarMenuData(menu, A_AND_B);
		expect(both.sections[LIST_SLOT_INDEX.first]?.items[LIST_SLOT_INDEX.first]?.children?.[LIST_SLOT_INDEX.first]?.title).toBe("Override");
	});

	it("keeps disabled items that are authorized — disabled is a UX state, not authorization (spec 25)", () => {
		const menu = rawMenu({
			sections: [{ title: "Main", labelKey: "main", items: [{ title: "Audit Log", labelKey: "audit-log", url: "/audit", disabled: true }] }],
		});

		const result = filterSidebarMenuData(menu, NONE);

		expect(result.sections[LIST_SLOT_INDEX.first]?.items[LIST_SLOT_INDEX.first]?.disabled).toBe(true);
	});

	it("filters six nested levels with one recursive pass (spec 103)", () => {
		const menu = rawMenu({
			sections: [
				{
					title: "Analytics",
					labelKey: "analytics",
					items: [
						{
							title: "Analytics",
							labelKey: "analytics",
							url: "/analytics",
							children: [
								{
									title: "Reports",
									labelKey: "reports",
									url: "/analytics/reports",
									children: [
										{
											title: "Marketing",
											labelKey: "marketing",
											url: "/analytics/reports/marketing",
											authorization: { permissions: [A] },
											children: [
												{
													title: "Segments",
													labelKey: "segments",
													url: "/analytics/reports/marketing/segments",
													children: [
														{
															title: "Personas",
															labelKey: "personas",
															url: "/analytics/reports/marketing/segments/personas",
															authorization: { permissions: [B] },
															children: [
																{
																	title: "Buyer Persona",
																	labelKey: "buyer-persona",
																	url: "/analytics/reports/marketing/segments/personas/buyer",
																	authorization: { permissions: [C] },
																},
															],
														},
													],
												},
											],
										},
									],
								},
							],
						},
					],
				},
			],
		});

		const path = (result: ReturnType<typeof filterSidebarMenuData>): string[] => {
			const titles: string[] = [];
			let node: SidebarMenuItem | undefined = result.sections[LIST_SLOT_INDEX.first]?.items[LIST_SLOT_INDEX.first];
			while (node !== undefined) {
				titles.push(node.title);
				node = node.children?.[LIST_SLOT_INDEX.first];
			}
			return titles;
		};

		// Full grants: all six levels survive.
		expect(path(filterSidebarMenuData(menu, FULL))).toEqual(["Analytics", "Reports", "Marketing", "Segments", "Personas", "Buyer Persona"]);

		// Missing C: Personas (authorized via B) survives as an accessible leaf (spec 79);
		// its unauthorized child is hidden.
		expect(path(filterSidebarMenuData(menu, A_AND_B))).toEqual(["Analytics", "Reports", "Marketing", "Segments", "Personas"]);

		// Missing B: Personas denied with no visible children → removed; structural
		// Segments has no surviving children → removed too (spec 22).
		expect(path(filterSidebarMenuData(menu, ONLY_A))).toEqual(["Analytics", "Reports", "Marketing"]);
	});

	it("drops sections whose items are all filtered out", () => {
		const menu = rawMenu({
			sections: [
				{ title: "Visible", labelKey: "visible", items: [{ title: "Home", labelKey: "home", url: "/" }] },
				{ title: "Hidden", labelKey: "hidden", items: [{ title: "Secret", labelKey: "secret", url: "/secret", authorization: { permissions: [A] } }] },
			],
		});

		const result = filterSidebarMenuData(menu, NONE);

		expect(result.sections.map((section) => section.title)).toEqual(["Visible"]);
	});

	it("filters bottomItems with the same rules", () => {
		const menu = rawMenu({
			bottomItems: [{ title: "Settings", labelKey: "settings", url: "/settings", authorization: { permissions: [A] } }],
		});

		expect(filterSidebarMenuData(menu, ONLY_A).bottomItems).toHaveLength(1);
		expect(filterSidebarMenuData(menu, NONE).bottomItems).toHaveLength(0);
	});
});

describe("filterCompiledSidebarMenu (compiled)", () => {
	it("preserves ids while filtering", () => {
		const menu = compiledMenu({
			sections: [
				{
					title: "Main",
					key: "Main",
					labelKey: "main",
					items: [
						{ id: "main-home", title: "Home", labelKey: "home", url: "/" },
						{ id: "main-secret", title: "Secret", labelKey: "secret", url: "/secret", authorization: { permissions: [A] } },
					],
				},
			],
		});

		const result = filterCompiledSidebarMenu(menu, ONLY_A);

		expect(result.sections[LIST_SLOT_INDEX.first]?.items.map((item) => item.id)).toEqual(["main-home", "main-secret"]);

		const denied = filterCompiledSidebarMenu(menu, NONE);
		expect(denied.sections[LIST_SLOT_INDEX.first]?.items.map((item) => item.id)).toEqual(["main-home"]);
	});

	it("supports authorization all/any modes on compiled items", () => {
		const menu = compiledMenu({
			sections: [
				{
					title: "Main",
					key: "Main",
					labelKey: "main",
					items: [{ id: "main-sensitive", title: "Sensitive", labelKey: "sensitive", url: "/sensitive", authorization: { permissions: [A, B], mode: "all" } }],
				},
			],
		});

		expect(filterCompiledSidebarMenu(menu, A_AND_B).sections).toHaveLength(1);
		expect(filterCompiledSidebarMenu(menu, ONLY_A).sections).toHaveLength(0);
	});
});

describe("authorization + feature flags", () => {
	const BETA_FLAG = "beta-reports";

	function betaMenu(): SidebarMenuData {
		return rawMenu({
			sections: [
				{
					title: "Insights",
					labelKey: "insights",
					items: [
						{ title: "Home", labelKey: "home", url: "/" },
						{
							title: "Reports",
							labelKey: "reports",
							url: "/beta/reports",
							authorization: { permissions: [PERMISSION.PRODUCT.LIST] },
							featureFlag: BETA_FLAG,
						},
					],
				},
			],
		});
	}

	function titles(menu: SidebarMenuData): readonly string[] {
		return menu.sections.flatMap((section) => section.items.map((item) => item.title));
	}

	it("hides an unauthorized item even when its feature is enabled", () => {
		const result = filterSidebarMenuData(betaMenu(), NONE, { enabledFeatureFlags: [BETA_FLAG] });

		expect(titles(result)).toEqual(["Home"]);
	});

	it("hides an authorized item whose feature flag is disabled", () => {
		expect(titles(filterSidebarMenuData(betaMenu(), [PERMISSION.PRODUCT.LIST], { enabledFeatureFlags: [] }))).toEqual(["Home"]);
		expect(titles(filterSidebarMenuData(betaMenu(), [PERMISSION.PRODUCT.LIST]))).toEqual(["Home"]);
	});

	it("shows the item only when permission is allowed AND the feature is enabled", () => {
		const result = filterSidebarMenuData(betaMenu(), [PERMISSION.PRODUCT.LIST], { enabledFeatureFlags: [BETA_FLAG] });

		expect(titles(result)).toEqual(["Home", "Reports"]);
	});

	it("drops an unauthorized + disabled item (disabled never grants visibility)", () => {
		const menu = rawMenu({
			sections: [{ title: "Main", labelKey: "main", items: [{ title: "Locked", labelKey: "locked", url: "/locked", disabled: true, authorization: { permissions: [A] } }] }],
		});

		expect(filterSidebarMenuData(menu, NONE).sections).toHaveLength(0);
	});

	it("removes a flagged parent's whole subtree when the flag is off", () => {
		const menu = rawMenu({
			sections: [
				{
					title: "Main",
					labelKey: "main",
					items: [{ title: "Beta", labelKey: "beta", url: "/beta", featureFlag: "beta", children: [{ title: "Beta child", labelKey: "beta-child", url: "/beta/child" }] }],
				},
			],
		});

		expect(filterSidebarMenuData(menu, FULL).sections).toHaveLength(0);
		expect(filterSidebarMenuData(menu, FULL, { enabledFeatureFlags: ["beta"] }).sections[LIST_SLOT_INDEX.first]?.items[LIST_SLOT_INDEX.first]?.children).toHaveLength(1);
	});

	it("denies the whole subtree when a cascading requirement fails, even if a child is authorized on its own", () => {
		const menu = rawMenu({
			sections: [
				{
					title: "Main",
					labelKey: "main",
					items: [
						{
							title: "Admin",
							labelKey: "admin",
							url: "/admin",
							authorization: { permissions: [A], cascade: true },
							children: [{ title: "Child", labelKey: "child", url: "/admin/child", authorization: { permissions: [B] } }],
						},
					],
				},
			],
		});

		expect(filterSidebarMenuData(menu, ONLY_B).sections).toHaveLength(0);
	});

	it("needs the exact action: another action on the same resource does not satisfy it", () => {
		const menu = rawMenu({
			sections: [
				{ title: "Main", labelKey: "main", items: [{ title: "Orders", labelKey: "orders", url: "/orders", authorization: { permissions: [PERMISSION.ORDER.READ] } }] },
			],
		});

		expect(filterSidebarMenuData(menu, [PERMISSION.ORDER.READ]).sections).toHaveLength(1);
		expect(filterSidebarMenuData(menu, [PERMISSION.ORDER.UPDATE]).sections).toHaveLength(0);
		expect(filterSidebarMenuData(menu, [PERMISSION.PRODUCT.READ]).sections).toHaveLength(0);
	});

	it("filters compiled menus with the same feature-flag rules", () => {
		const menu = compiledMenu({
			sections: [
				{
					title: "Main",
					key: "Main",
					labelKey: "main",
					items: [{ id: "main-flagged", title: "Flagged", labelKey: "flagged", url: "/flagged", featureFlag: "beta" }],
				},
			],
		});

		expect(filterCompiledSidebarMenu(menu, FULL).sections).toHaveLength(0);
		expect(filterCompiledSidebarMenu(menu, FULL, { enabledFeatureFlags: ["beta"] }).sections).toHaveLength(1);
	});
});

describe("evaluateSidebarAuthorization", () => {
	const onlyA = (permission: string): boolean => permission === A;

	it("is satisfied by an empty requirement", () => {
		expect(evaluateSidebarAuthorization({ permissions: [] }, onlyA)).toBe(true);
	});

	it("applies any/all modes", () => {
		expect(evaluateSidebarAuthorization({ permissions: [A, B] }, onlyA)).toBe(true);
		expect(evaluateSidebarAuthorization({ permissions: [A, B], mode: "all" }, onlyA)).toBe(false);
	});
});

describe("SidebarMenuDataSchema", () => {
	function menuWith(item: Record<string, string | boolean | Record<string, string[]>>): Record<string, object> {
		return { header: { title: "T", subtitle: "S" }, sections: [{ title: "Main", labelKey: "main", items: [item] }], bottomItems: [] };
	}

	it("accepts known platform permission slugs and feature flags", () => {
		const result = SidebarMenuDataSchema.safeParse(
			menuWith({ title: "Reports", labelKey: "reports", url: "/reports", featureFlag: "beta-reports", authorization: { permissions: [PERMISSION.PRODUCT.LIST] } }),
		);

		expect(result.success).toBe(true);
	});

	it("rejects a misspelled platform permission slug at load", () => {
		const result = SidebarMenuDataSchema.safeParse(
			menuWith({ title: "Reports", labelKey: "reports", url: "/reports", authorization: { permissions: ["platform:product.lsit"] } }),
		);

		expect(result.success).toBe(false);
	});

	it("rejects the removed legacy requiredCapabilities key instead of silently stripping it", () => {
		const result = SidebarMenuDataSchema.safeParse(menuWith({ title: "Reports", labelKey: "reports", url: "/reports", requiredCapabilities: "platform:product.list" }));

		expect(result.success).toBe(false);
	});
});
