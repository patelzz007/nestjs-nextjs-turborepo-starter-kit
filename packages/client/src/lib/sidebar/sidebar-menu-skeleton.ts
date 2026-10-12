import type { CompiledSidebarMenuData } from "./sidebar-menu-schema";

/** The outline `PanelSidebarSkeleton` draws: rows per menu section, and the footer's rows. */
export interface SidebarMenuSkeletonShape {
	readonly sections: readonly number[];
	readonly footerRows: number;
}

/**
 * A menu's outline, read from the app's own compiled menu so the loading
 * sidebar has the same sections and rows as the real one (before the
 * member's capabilities hide any — those aren't known while it loads).
 */
export function sidebarMenuSkeletonShape(menu: CompiledSidebarMenuData): SidebarMenuSkeletonShape {
	return {
		sections: menu.sections.map((section): number => section.items.length),
		footerRows: menu.bottomItems.length,
	};
}
