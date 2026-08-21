import sidebarMenuJson from "./sidebar-menu.json";

import { SidebarMenuDataSchema } from "./sidebar";
import type { CompiledSidebarMenuData, CompiledSidebarMenuItem, SidebarMenuData, SidebarMenuItem } from "./sidebar";

/**
 * The menu after `compileMenu`: the raw JSON with a unique `id` attached to
 * every node. Ids are full-title-path slugs, prefixed with the section at the
 * root level so two same-titled items in different sections never collide,
 * and suffixed with `-2`, `-3`, … when two same-titled siblings share a
 * parent (sidebar audit, improvement 7). Every consumer reads `item.id` —
 * never derives ids from titles at render time.
 */
/**
 * The raw menu JSON, **parsed** (not just typed) at module load — rule 13.
 * A key renamed/removed in `sidebar-menu.json` throws a loud zod error on
 * admin startup instead of silently rendering a broken or partial menu.
 */
const validatedMenuData: SidebarMenuData = SidebarMenuDataSchema.parse(sidebarMenuJson);

export const SIDEBAR_MENU: CompiledSidebarMenuData = compileMenu(validatedMenuData);

/** Lowercases and slugs a label for id paths ("All Users" → "all-users"). */
function slugify(value: string): string {
	return value.toLowerCase().replace(/\s+/g, "-");
}

/**
 * Walks one sibling list and assigns unique ids. `parentId` is the full path
 * of the parent (or the section slug for root items); `used` is the global
 * seen-ids set so a duplicate anywhere in the tree gets a `-2`/`-3`… suffix.
 */
function compileItems(items: readonly SidebarMenuItem[], parentId: string, used: Set<string>): readonly CompiledSidebarMenuItem[] {
	return items.map((item) => {
		const base = parentId.length > 0 ? `${parentId}-${slugify(item.title)}` : slugify(item.title);
		let id = base;
		let suffix = 2;
		// `used` is shared across the whole tree (created once in `compileMenu`),
		// so the -2/-3… suffixes kick in for same-titled siblings *and* any
		// duplicate anywhere in the tree — ids stay globally unique.
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

/**
 * Attaches unique, deterministic ids to the raw menu JSON. Deterministic means
 * the same JSON always yields the same ids — so expansion/active state that is
 * keyed by id survives reloads and matches across the desktop + mobile render
 * instances.
 */
export function compileMenu(data: SidebarMenuData): CompiledSidebarMenuData {
	const used = new Set<string>();
	return {
		header: data.header,
		sections: data.sections.map((section) => ({
			title: section.title,
			items: compileItems(section.items, slugify(section.title), used),
			color: section.color,
		})),
		bottomItems: compileItems(data.bottomItems, "", used),
	};
}
