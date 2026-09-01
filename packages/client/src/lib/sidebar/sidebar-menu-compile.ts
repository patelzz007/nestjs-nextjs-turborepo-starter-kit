import type { CompiledSidebarMenuData, CompiledSidebarMenuItem, SidebarMenuData, SidebarMenuItem } from "./sidebar-menu-schema";

function slugify(value: string): string {
	return value.toLowerCase().replace(/\s+/g, "-");
}

function compileItems(items: readonly SidebarMenuItem[], parentId: string, used: Set<string>): readonly CompiledSidebarMenuItem[] {
	return items.map((item) => {
		const base = parentId.length > 0 ? `${parentId}-${slugify(item.title)}` : slugify(item.title);
		let id = base;
		let suffix = 2;
		while (used.has(id)) {
			id = `${base}-${String(suffix)}`;
			suffix += 1;
		}
		used.add(id);
		return {
			...item,
			id,
			children: item.children !== undefined ? compileItems(item.children, id, used) : undefined,
		};
	});
}

/** Attaches globally-unique ids to the raw sidebar menu JSON. */
export function compileMenu(data: SidebarMenuData): CompiledSidebarMenuData {
	const used = new Set<string>();
	return {
		header: data.header,
		sections: data.sections.map((section) => ({
			title: section.title,
			color: section.color,
			items: compileItems(section.items, slugify(section.title), used),
		})),
		bottomItems: compileItems(data.bottomItems, "", used),
	};
}
