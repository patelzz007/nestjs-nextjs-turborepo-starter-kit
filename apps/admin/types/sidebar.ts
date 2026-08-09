import type { LucideIcon } from "lucide-react";

/**
 * A single sidebar navigation item.
 *
 * `children` is recursive — an item can nest up to any depth. The recursive
 * renderer in `sidebar.tsx` walks this tree at render time, so there is
 * nothing hardcoded per level here.
 */
export interface SidebarMenuItem {
	readonly title: string;
	readonly url: string;
	readonly icon?: string;
	readonly disabled?: boolean;
	readonly children?: readonly SidebarMenuItem[];
}

export interface SidebarMenuSection {
	readonly title: string;
	readonly items: readonly SidebarMenuItem[];
}

export interface SidebarMenuHeader {
	readonly title: string;
	readonly subtitle: string;
}

/**
 * The full shape of `apps/admin/config/sidebar-menu.json`.
 */
export interface SidebarMenuData {
	readonly header: SidebarMenuHeader;
	readonly sections: readonly SidebarMenuSection[];
	readonly bottomItems: readonly SidebarMenuItem[];
}

/**
 * A nav item with its **unique compiled id** attached (see
 * `config/sidebar-menu.ts` → `compileMenu`). Ids are full-title-path slugs
 * (`settings-security-sessions`), prefixed with the section at the root, and
 * suffixed with `-2`/`-3`… when two same-titled siblings would collide. Every
 * consumer (expansion maps, active-state maps, React keys) must use `id`, never
 * the title — see the sidebar audit, improvement 7.
 */
export interface CompiledSidebarMenuItem extends Omit<SidebarMenuItem, "children"> {
	readonly id: string;
	readonly children?: readonly CompiledSidebarMenuItem[];
}

export interface CompiledSidebarMenuSection {
	readonly title: string;
	readonly items: readonly CompiledSidebarMenuItem[];
}

/** The menu after `compileMenu` — the shape every component consumes. */
export interface CompiledSidebarMenuData {
	readonly header: SidebarMenuHeader;
	readonly sections: readonly CompiledSidebarMenuSection[];
	readonly bottomItems: readonly CompiledSidebarMenuItem[];
}

/** The signed-in user as shown in the sidebar / topbar / profile dropdown. */
export interface SidebarUser {
	readonly name: string;
	readonly email: string;
}

/** A custom action rendered in the sidebar footer (e.g. "Report an issue"). */
export interface FooterAction {
	readonly icon: LucideIcon;
	readonly label: string;
	readonly onClick: () => void;
}
