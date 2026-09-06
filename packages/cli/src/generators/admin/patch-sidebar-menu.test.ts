import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ResourceIR } from "../../ir/types.js";
import { patchSidebarMenu } from "./patch-sidebar-menu.js";

const BASE_MENU = {
	header: { title: "Acme Inc.", subtitle: "Admin Panel" },
	sections: [
		{ title: "Main", color: "blue", items: [{ title: "Overview", url: "/", icon: "LayoutDashboard" }] },
		{ title: "Developer", color: "green", items: [] },
	],
	bottomItems: [],
};

function buildIr(overrides: Partial<ResourceIR> & { slug: string; label: string; group?: string }): ResourceIR {
	return {
		version: 1,
		resource: {
			name: "Product",
			singular: "Product",
			plural: "Products",
			slug: overrides.slug,
			contractKey: overrides.slug.replace(/-/g, ""),
			modelName: "Product",
			permissionResource: "PRODUCT",
		},
		fields: [],
		relations: [],
		workflow: undefined,
		softDelete: true,
		concurrency: false,
		idempotency: false,
		rls: "admin-only",
		permissions: [],
		admin: {
			navigation: {
				label: overrides.label,
				icon: "Package",
				group: overrides.group ?? "Platform",
				order: 100,
				hiddenInProduction: false,
			},
			list: { searchable: [], filters: [], sortable: [], columns: [] },
			form: { layout: "single-column", fields: [] },
		},
		events: { created: false, updated: false, deleted: false },
		audit: false,
	};
}

describe("patchSidebarMenu", () => {
	let tempDir = "";

	beforeEach(async () => {
		tempDir = await mkdtemp(path.join(os.tmpdir(), "sidebar-menu-patch-"));
		await writeFile(path.join(tempDir, "sidebar-menu.json"), `${JSON.stringify(BASE_MENU, null, "\t")}\n`, "utf8");
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	it("adds a new item under a new Platform section", async () => {
		const menuPath = path.join(tempDir, "sidebar-menu.json");
		await patchSidebarMenu(menuPath, buildIr({ slug: "product", label: "Products", group: "Platform" }));
		const parsed = JSON.parse(await readFile(menuPath, "utf8")) as { sections: { title: string; items: { url: string; title: string }[] }[] };
		const platform = parsed.sections.find((section) => section.title === "Platform");
		expect(platform?.items).toEqual([{ title: "Products", url: "/product", icon: "Package" }]);
	});

	it("updates an existing item in the Developer section for Generated group", async () => {
		const menuPath = path.join(tempDir, "sidebar-menu.json");
		await patchSidebarMenu(menuPath, buildIr({ slug: "sample-category", label: "Sample Categories", group: "Generated" }));
		await patchSidebarMenu(menuPath, buildIr({ slug: "sample-category", label: "Sample Categories Renamed", group: "Generated" }));
		const parsed = JSON.parse(await readFile(menuPath, "utf8")) as { sections: { title: string; items: { url: string; title: string }[] }[] };
		const developer = parsed.sections.find((section) => section.title === "Developer");
		expect(developer?.items).toEqual([{ title: "Sample Categories Renamed", url: "/sample-category", icon: "Package" }]);
	});
});
