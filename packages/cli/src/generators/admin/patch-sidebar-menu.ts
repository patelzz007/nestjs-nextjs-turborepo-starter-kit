import { readFile, writeFile } from "node:fs/promises";

import type { ResourceIR } from "../../ir/types";
import { resolveUiResourceBasePath } from "../../ir/ui-context";

interface SidebarMenuItemNode {
	readonly title: string;
	readonly url: string;
	readonly icon?: string;
	readonly disabled?: boolean;
	readonly children?: SidebarMenuItemNode[];
}

interface SidebarMenuSectionNode {
	readonly title: string;
	readonly color?: string;
	items: SidebarMenuItemNode[];
}

interface SidebarMenuDataNode {
	readonly header: { readonly title: string; readonly subtitle: string };
	sections: SidebarMenuSectionNode[];
	readonly bottomItems: SidebarMenuItemNode[];
}

function resolveSectionTitle(group: string): string {
	if (group === "Generated") {
		return "Developer";
	}
	return group;
}

function resolveSectionColor(group: string): string {
	switch (group) {
		case "Platform":
			return "purple";
		case "Developer":
		case "Generated":
			return "green";
		case "Documents":
			return "amber";
		default:
			return "teal";
	}
}

function buildMenuItem(ir: ResourceIR, routePrefix: string): SidebarMenuItemNode {
	const navigation = ir.admin?.navigation;
	if (navigation === undefined) {
		throw new Error("Cannot patch sidebar menu without ui.navigation");
	}
	const basePath = resolveUiResourceBasePath({ ...ir, activeUi: { moduleId: "", routePrefix } });
	return {
		title: navigation.label,
		url: basePath,
		icon: navigation.icon,
	};
}

function findItemIndex(items: SidebarMenuItemNode[], url: string): number {
	return items.findIndex((item) => item.url === url);
}

function upsertMenuItem(items: SidebarMenuItemNode[], item: SidebarMenuItemNode): SidebarMenuItemNode[] {
	const existingIndex = findItemIndex(items, item.url);
	if (existingIndex >= 0) {
		const next = [...items];
		next[existingIndex] = { ...next[existingIndex], ...item };
		return next;
	}
	return [...items, item];
}

function findOrCreateSection(menu: SidebarMenuDataNode, group: string): SidebarMenuSectionNode {
	const sectionTitle = resolveSectionTitle(group);
	const existing = menu.sections.find((section) => section.title === sectionTitle);
	if (existing !== undefined) {
		return existing;
	}
	const created: SidebarMenuSectionNode = {
		title: sectionTitle,
		color: resolveSectionColor(group),
		items: [],
	};
	menu.sections.push(created);
	return created;
}

export async function patchSidebarMenu(menuPath: string, ir: ResourceIR, routePrefix: string): Promise<void> {
	const navigation = ir.admin?.navigation;
	if (navigation === undefined) {
		return;
	}

	const current = await readFile(menuPath, "utf8");
	const menu = JSON.parse(current) as SidebarMenuDataNode;
	const item = buildMenuItem(ir, routePrefix);
	const section = findOrCreateSection(menu, navigation.group);
	const existingIndex = findItemIndex(section.items, item.url);
	if (existingIndex >= 0) {
		section.items[existingIndex] = { ...section.items[existingIndex], ...item };
	} else {
		section.items = upsertMenuItem(section.items, item);
	}

	await writeFile(menuPath, `${JSON.stringify(menu, null, "\t")}\n`, "utf8");
}

/** Removes a resource menu item from the sidebar during rollback. */
export async function unpatchSidebarMenu(menuPath: string, ir: ResourceIR, routePrefix: string): Promise<void> {
	const navigation = ir.admin?.navigation;
	if (navigation === undefined) {
		return;
	}
	const current = await readFile(menuPath, "utf8");
	const menu = JSON.parse(current) as SidebarMenuDataNode;
	const basePath = resolveUiResourceBasePath({ ...ir, activeUi: { moduleId: "", routePrefix } });
	for (const section of menu.sections) {
		section.items = section.items.filter((item) => item.url !== basePath);
	}
	await writeFile(menuPath, `${JSON.stringify(menu, null, "\t")}\n`, "utf8");
}
