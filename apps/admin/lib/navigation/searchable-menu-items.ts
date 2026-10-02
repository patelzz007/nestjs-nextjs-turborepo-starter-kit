import { z } from "zod";

import type { CompiledSidebarMenuItem } from "@/lib/navigation/sidebar";

/**
 * Admin-only companion to the shared sidebar view model
 * (`@workspace/ui/lib/sidebar/menu-view`): flattens the menu tree into the
 * searchable entries the command palette and the pinned items use.
 */
export const SearchableMenuItemSchema = z.object({
	id: z.string(),
	title: z.string(),
	url: z.string(),
	icon: z.string().optional(),
	section: z.string(),
	breadcrumb: z.array(z.string()).readonly(),
});

export type SearchableMenuItem = z.output<typeof SearchableMenuItemSchema>;

/** Appends every enabled item (depth-first) to `acc`, carrying its title trail. */
export function flattenMenuItems(items: readonly CompiledSidebarMenuItem[], section: string, breadcrumb: readonly string[], acc: SearchableMenuItem[]): void {
	for (const item of items) {
		if (item.disabled === true) {
			continue;
		}
		const currentBreadcrumb: readonly string[] = [...breadcrumb, item.title];
		// The schema-derived `SearchableMenuItem.breadcrumb` is `readonly string[]`
		// (`.readonly()`), so the spread is a defensive mutable copy that stays
		// assignable either way.
		acc.push({ id: item.id, title: item.title, url: item.url, icon: item.icon, section, breadcrumb: [...currentBreadcrumb] });
		const children = item.children;
		if (children !== undefined) {
			flattenMenuItems(children, section, currentBreadcrumb, acc);
		}
	}
}
