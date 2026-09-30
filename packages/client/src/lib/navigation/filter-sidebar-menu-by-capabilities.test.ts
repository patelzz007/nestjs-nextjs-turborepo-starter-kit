import { describe, expect, it } from "vitest";

import type { CompiledSidebarMenuData, SidebarMenuData } from "../sidebar/sidebar-menu-schema";
import { PERMISSION } from "@workspace/shared";

import { SidebarMenuDataSchema } from "../sidebar/sidebar-menu-schema";
import { evaluateSidebarAuthorization, filterCompiledSidebarMenu, filterSidebarMenuData } from "./filter-sidebar-menu-by-capabilities";

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
		sections: [{ title: "Main", items: [{ title: "Home", url: "/" }] }],
		bottomItems: [],
		...overrides,
	};
}

function compiledMenu(overrides?: Partial<CompiledSidebarMenuData>): CompiledSidebarMenuData {
	return {
		header: { title: "Test", subtitle: "Suite" },
		sections: [{ title: "Main", items: [{ id: "main-home", title: "Home", url: "/" }] }],
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
					items: [
						{ title: "Home", url: "/" },
						{ title: "Secret", url: "/secret", authorization: { permissions: [A] } },
					],
				},
			],
		});

		const result = filterSidebarMenuData(menu, NONE);

		expect(result.sections[0]?.items.map((item) => item.title)).toEqual(["Home"]);
	});

	it("removes unauthorized leaves", () => {
		const menu = rawMenu({
			sections: [{ title: "Main", items: [{ title: "Secret", url: "/secret", authorization: { permissions: [A] } }] }],
		});

		const result = filterSidebarMenuData(menu, NONE);

		expect(result.sections).toHaveLength(0);
	});

	it("keeps structural parents when at least one child survives (spec 115)", () => {
		const menu = rawMenu({
			sections: [
				{
					title: "Users",
					items: [
						{
							title: "Users",
							url: "/users",
							children: [
								{ title: "All Users", url: "/users/all", authorization: { permissions: [A] } },
								{ title: "Roles", url: "/users/roles", authorization: { permissions: [B] } },
							],
						},
					],
				},
			],
		});

		const result = filterSidebarMenuData(menu, ONLY_A);
		const parent = result.sections[0]?.items[0];

		expect(parent?.title).toBe("Users");
		expect(parent?.children?.map((child) => child.title)).toEqual(["All Users"]);
	});

	it("removes parents with no surviving children — never renders an empty parent (spec 22)", () => {
		const menu = rawMenu({
			sections: [
				{
					title: "Users",
					items: [
						{
							title: "Users",
							url: "/users",
							children: [
								{ title: "All Users", url: "/users/all", authorization: { permissions: [A] } },
								{ title: "Roles", url: "/users/roles", authorization: { permissions: [B] } },
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
					items: [
						{ title: "Sensitive", url: "/sensitive", authorization: { permissions: [A, B], mode: "all" } },
						{ title: "Either", url: "/either", authorization: { permissions: [A, B], mode: "any" } },
					],
				},
			],
		});

		const withBoth = filterSidebarMenuData(menu, A_AND_B);
		expect(withBoth.sections[0]?.items.map((item) => item.title)).toEqual(["Sensitive", "Either"]);

		const withOne = filterSidebarMenuData(menu, ONLY_A);
		expect(withOne.sections[0]?.items.map((item) => item.title)).toEqual(["Either"]);
	});

	it("supports mode any — at least one permission (spec 18)", () => {
		const menu = rawMenu({
			sections: [
				{
					title: "Main",
					items: [{ title: "Access Control", url: "/access", authorization: { permissions: [A, B], mode: "any" } }],
				},
			],
		});

		expect(filterSidebarMenuData(menu, ONLY_B).sections[0]?.items).toHaveLength(1);
		expect(filterSidebarMenuData(menu, NONE).sections).toHaveLength(0);
	});

	it("cascade true applies the parent requirement to the whole subtree (spec 116)", () => {
		const menu = rawMenu({
			sections: [
				{
					title: "Reward Hub",
					items: [
						{
							title: "Reward Hub",
							url: "/rewardhub",
							authorization: { permissions: [A], cascade: true },
							children: [{ title: "Deep", url: "/rewardhub/deep", children: [{ title: "Deeper", url: "/rewardhub/deep/x" }] }],
						},
					],
				},
			],
		});

		const granted = filterSidebarMenuData(menu, ONLY_A);
		expect(granted.sections[0]?.items[0]?.children?.[0]?.children?.[0]?.title).toBe("Deeper");

		const denied = filterSidebarMenuData(menu, NONE);
		expect(denied.sections).toHaveLength(0);
	});

	it("cascade applies to descendants lacking their own authorization but not when they declare one", () => {
		const menu = rawMenu({
			sections: [
				{
					title: "Hub",
					items: [
						{
							title: "Hub",
							url: "/hub",
							authorization: { permissions: [A], cascade: true },
							children: [{ title: "Override", url: "/hub/override", authorization: { permissions: [B] } }],
						},
					],
				},
			],
		});

		// Has A but not B: the cascade gate passes for the parent, the override
		// denies the child — the authorized parent survives as an accessible leaf (spec 79).
		const onlyA = filterSidebarMenuData(menu, ONLY_A);
		const hub = onlyA.sections[0]?.items[0];
		expect(hub?.title).toBe("Hub");
		expect(hub?.children).toHaveLength(0);

		// Has both: parent gate and override gate both pass.
		const both = filterSidebarMenuData(menu, A_AND_B);
		expect(both.sections[0]?.items[0]?.children?.[0]?.title).toBe("Override");
	});

	it("keeps disabled items that are authorized — disabled is a UX state, not authorization (spec 25)", () => {
		const menu = rawMenu({
			sections: [{ title: "Main", items: [{ title: "Audit Log", url: "/audit", disabled: true }] }],
		});

		const result = filterSidebarMenuData(menu, NONE);

		expect(result.sections[0]?.items[0]?.disabled).toBe(true);
	});

	it("filters six nested levels with one recursive pass (spec 103)", () => {
		const menu = rawMenu({
			sections: [
				{
					title: "Analytics",
					items: [
						{
							title: "Analytics",
							url: "/analytics",
							children: [
								{
									title: "Reports",
									url: "/analytics/reports",
									children: [
										{
											title: "Marketing",
											url: "/analytics/reports/marketing",
											authorization: { permissions: [A] },
											children: [
												{
													title: "Segments",
													url: "/analytics/reports/marketing/segments",
													children: [
														{
															title: "Personas",
															url: "/analytics/reports/marketing/segments/personas",
															authorization: { permissions: [B] },
															children: [{ title: "Buyer Persona", url: "/analytics/reports/marketing/segments/personas/buyer", authorization: { permissions: [C] } }],
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
			let node = result.sections[0]?.items[0];
			while (node !== undefined) {
				titles.push(node.title);
				node = node.children?.[0];
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
				{ title: "Visible", items: [{ title: "Home", url: "/" }] },
				{ title: "Hidden", items: [{ title: "Secret", url: "/secret", authorization: { permissions: [A] } }] },
			],
		});

		const result = filterSidebarMenuData(menu, NONE);

		expect(result.sections.map((section) => section.title)).toEqual(["Visible"]);
	});

	it("filters bottomItems with the same rules", () => {
		const menu = rawMenu({
			bottomItems: [{ title: "Settings", url: "/settings", authorization: { permissions: [A] } }],
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
					items: [
						{ id: "main-home", title: "Home", url: "/" },
						{ id: "main-secret", title: "Secret", url: "/secret", authorization: { permissions: [A] } },
					],
				},
			],
		});

		const result = filterCompiledSidebarMenu(menu, ONLY_A);

		expect(result.sections[0]?.items.map((item) => item.id)).toEqual(["main-home", "main-secret"]);

		const denied = filterCompiledSidebarMenu(menu, NONE);
		expect(denied.sections[0]?.items.map((item) => item.id)).toEqual(["main-home"]);
	});

	it("supports authorization all/any modes on compiled items", () => {
		const menu = compiledMenu({
			sections: [
				{
					title: "Main",
					items: [{ id: "main-sensitive", title: "Sensitive", url: "/sensitive", authorization: { permissions: [A, B], mode: "all" } }],
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
					items: [
						{ title: "Home", url: "/" },
						{
							title: "Reports",
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
			sections: [{ title: "Main", items: [{ title: "Locked", url: "/locked", disabled: true, authorization: { permissions: [A] } }] }],
		});

		expect(filterSidebarMenuData(menu, NONE).sections).toHaveLength(0);
	});

	it("removes a flagged parent's whole subtree when the flag is off", () => {
		const menu = rawMenu({
			sections: [
				{
					title: "Main",
					items: [{ title: "Beta", url: "/beta", featureFlag: "beta", children: [{ title: "Beta child", url: "/beta/child" }] }],
				},
			],
		});

		expect(filterSidebarMenuData(menu, FULL).sections).toHaveLength(0);
		expect(filterSidebarMenuData(menu, FULL, { enabledFeatureFlags: ["beta"] }).sections[0]?.items[0]?.children).toHaveLength(1);
	});

	it("denies the whole subtree when a cascading requirement fails, even if a child is authorized on its own", () => {
		const menu = rawMenu({
			sections: [
				{
					title: "Main",
					items: [
						{
							title: "Admin",
							url: "/admin",
							authorization: { permissions: [A], cascade: true },
							children: [{ title: "Child", url: "/admin/child", authorization: { permissions: [B] } }],
						},
					],
				},
			],
		});

		expect(filterSidebarMenuData(menu, ONLY_B).sections).toHaveLength(0);
	});

	it("treats MANAGE on a resource as satisfying other actions on it", () => {
		const menu = rawMenu({
			sections: [{ title: "Main", items: [{ title: "Orders", url: "/orders", authorization: { permissions: [PERMISSION.ORDER.READ] } }] }],
		});

		expect(filterSidebarMenuData(menu, [PERMISSION.ORDER.MANAGE]).sections).toHaveLength(1);
		expect(filterSidebarMenuData(menu, [PERMISSION.PRODUCT.MANAGE]).sections).toHaveLength(0);
	});

	it("filters compiled menus with the same feature-flag rules", () => {
		const menu = compiledMenu({
			sections: [
				{
					title: "Main",
					items: [{ id: "main-flagged", title: "Flagged", url: "/flagged", featureFlag: "beta" }],
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
		return { header: { title: "T", subtitle: "S" }, sections: [{ title: "Main", items: [item] }], bottomItems: [] };
	}

	it("accepts known platform permission slugs and feature flags", () => {
		const result = SidebarMenuDataSchema.safeParse(
			menuWith({ title: "Reports", url: "/reports", featureFlag: "beta-reports", authorization: { permissions: [PERMISSION.PRODUCT.LIST] } }),
		);

		expect(result.success).toBe(true);
	});

	it("rejects a misspelled platform permission slug at load", () => {
		const result = SidebarMenuDataSchema.safeParse(menuWith({ title: "Reports", url: "/reports", authorization: { permissions: ["platform:product.lsit"] } }));

		expect(result.success).toBe(false);
	});

	it("rejects the removed legacy requiredCapabilities key instead of silently stripping it", () => {
		const result = SidebarMenuDataSchema.safeParse(menuWith({ title: "Reports", url: "/reports", requiredCapabilities: "platform:product.list" }));

		expect(result.success).toBe(false);
	});
});
