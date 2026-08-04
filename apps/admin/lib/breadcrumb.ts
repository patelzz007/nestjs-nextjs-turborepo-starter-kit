import { FileText, Home, type LucideIcon } from "lucide-react";

import type { BreadcrumbItem } from "@workspace/ui/components/breadcrumb-context";

import { ICON_MAP } from "@/config/menu-icons";
import { SIDEBAR_MENU } from "@/config/sidebar-menu";
import type { SidebarMenuItem } from "@/types/sidebar";

/**
 * Resolves the icon for a sidebar menu item. Icons are **mandatory** on every
 * crumb, so a missing/unknown icon name falls back to `FileText` rather than
 * rendering a bare label.
 */
function itemIcon(item: SidebarMenuItem): LucideIcon {
	const name = item.icon;
	if (name !== undefined) {
		const resolved = ICON_MAP[name];
		if (resolved !== undefined) {
			return resolved;
		}
	}
	return FileText;
}

/** Splits a pathname into non-empty segments, e.g. `/users/123` → `["users", "123"]`. */
function segmentsOf(pathname: string): readonly string[] {
	return pathname.split("/").filter((segment) => segment.length > 0);
}

/** Normalizes a pathname: strips trailing slashes (`/x/` → `/x`). Case is preserved (route matching is case-sensitive). */
function normalizePathname(pathname: string): string {
	return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

/** Renders a human label for a URL segment, e.g. `getting-started` → `Getting Started`. */
function labelFromSegment(segment: string): string {
	const words = segment.replace(/[-_]+/g, " ").trim();
	return words.length > 0 ? words.replace(/\b\w/g, (char) => char.toUpperCase()) : segment;
}

/**
 * Walks the menu tree for an item whose URL matches the given pathname
 * (exact, or as an ancestor prefix — `/settings` matches `/settings/general`).
 * Appends the matching crumbs to `trail`; returns `true` on a match.
 *
 * When `asParent` is true (used by the dynamic-segment fallback), an exact
 * match is treated as an **ancestor** — it gets an `href` and recursion stops
 * at that item, because the caller appends the remaining URL segments as
 * current-page crumbs after it.
 */
function walkForPath(items: readonly SidebarMenuItem[], pathname: string, trail: BreadcrumbItem[], asParent = false): boolean {
	for (const item of items) {
		const icon = itemIcon(item);
		if (item.url === pathname) {
			// Exact match → current page (no href) unless we need it as a parent.
			trail.push(asParent ? { label: item.title, href: item.url, icon } : { label: item.title, icon });
			return true;
		}
		const children = item.children;
		if (children !== undefined && pathname.startsWith(`${item.url}/`)) {
			// Ancestor crumb → linked.
			trail.push({ label: item.title, href: item.url, icon });
			if (walkForPath(children, pathname, trail, asParent)) {
				return true;
			}
			trail.pop();
		}
	}
	return false;
}

/**
 * Builds the breadcrumb trail for a given admin path by walking the sidebar
 * menu tree (the same tree the sidebar renders). Returns crumbs with
 * **mandatory icons**; the final crumb (the current page) has no `href`.
 *
 * Resolver features:
 * - **Section-aware roots** — when a route matches inside a multi-item
 *   section, the section itself becomes a linked first crumb (e.g.
 *   `/settings/general` → `Settings › General`). Single-item sections (like
 *   `Documentation → Docs Home`) don't duplicate their own title.
 * - **Dynamic segments** — a route that nests deeper than the menu
 *   (`/users/123`) falls back to the closest matching menu parent and renders
 *   the remaining segments as current-page crumbs (`Users › 123`).
 * - **Docs fallback** — `/docs/<slug>` resolves under the menu's Docs Home
 *   with a humanized title when no menu item covers the exact guide.
 * - Unknown routes fall back to a single "Overview" crumb (the dashboard
 *   root), matching the previous layout behaviour.
 */
export function resolveAdminTrail(pathname: string): readonly BreadcrumbItem[] {
	const normalizedPath = normalizePathname(pathname);
	const trail: BreadcrumbItem[] = [];

	// Section-aware walk: for each section, find the item (exact or ancestor).
	for (const section of SIDEBAR_MENU.sections) {
		for (const item of section.items) {
			const icon = itemIcon(item);
			if (item.url === normalizedPath) {
				// Exact match on a top-level item. Multi-item content sections
				// (e.g. `Documents` → Project Alpha) get their title as a context
				// root and the item itself stays linked; the `Main` catch-all and
				// single-item sections don't prepend anything.
				if (section.items.length > 1 && item.title !== section.title && section.title !== "Main") {
					return [
						{ label: section.title, icon },
						{ label: item.title, href: item.url, icon },
					];
				}
				return [{ label: item.title, icon }];
			}
			const children = item.children;
			if (children !== undefined && normalizedPath.startsWith(`${item.url}/`)) {
				const sectionTrail: BreadcrumbItem[] = [{ label: item.title, href: item.url, icon }];
				if (walkForPath(children, normalizedPath, sectionTrail)) {
					// Multi-item content sections (e.g. `Documents` → Project Alpha)
					// get their title as a context root; the `Main` catch-all and
					// single-item sections (`Documentation` → Docs Home) don't —
					// they'd just duplicate the first crumb.
					if (section.items.length > 1 && item.title !== section.title && section.title !== "Main") {
						return [{ label: section.title, icon: itemIcon(item) }, ...sectionTrail];
					}
					return sectionTrail;
				}
			}
		}
	}

	if (walkForPath(SIDEBAR_MENU.bottomItems, normalizedPath, trail)) {
		return trail;
	}

	// ── Dynamic-segment fallback: walk the pathname, keeping the longest
	//    menu prefix and rendering every deeper segment as a current-page crumb.
	const segments = segmentsOf(normalizedPath);
	for (let keep = segments.length - 1; keep >= 1; keep--) {
		const prefix = `/${segments.slice(0, keep).join("/")}`;
		const prefixTrail: BreadcrumbItem[] = [];
		if (walkForPath([...SIDEBAR_MENU.sections.flatMap((section) => section.items), ...SIDEBAR_MENU.bottomItems], prefix, prefixTrail, true)) {
			// Extend the matched prefix with the remaining segments.
			const remaining = segments.slice(keep);
			for (const segment of remaining) {
				prefixTrail.push({ label: labelFromSegment(segment), icon: FileText });
			}
			return prefixTrail;
		}
	}

	// No menu match at all: on the dashboard root the crumb IS the current
	// page; anywhere else it's a link back to the dashboard.
	if (normalizedPath === "/") {
		return [{ label: "Overview", icon: Home }];
	}
	return [{ label: "Overview", href: "/", icon: Home }];
}
