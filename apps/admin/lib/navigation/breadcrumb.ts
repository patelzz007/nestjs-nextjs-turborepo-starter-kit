import { FileText, Home, type LucideIcon } from "lucide-react";

import type { BreadcrumbItem } from "@workspace/ui/components/navigation/breadcrumb-context";
import { bestSharedSegmentPrefix, normalizePath, segmentsOfPath, updateLastTrailItem } from "@workspace/ui/lib/sidebar/navigation/breadcrumb-tree";
import {
	resolveSidebarMenuTrail,
	withTrailTailLabel,
	type SidebarMenuTrailData,
	type SidebarMenuTrailNode,
} from "@workspace/ui/lib/sidebar/navigation/resolve-sidebar-menu-trail";

import { ICON_MAP } from "@/lib/navigation/menu-icons";
import { isPathWithin } from "@/lib/routes";
import { SIDEBAR_MENU } from "@/lib/navigation/sidebar-menu";

function resolveIcon(iconName: string | undefined): LucideIcon {
	if (iconName !== undefined) {
		const resolved = ICON_MAP[iconName];
		if (resolved !== undefined) {
			return resolved;
		}
	}
	return FileText;
}

export { withTrailTailLabel };

function resolveMenuTrail(menu: SidebarMenuTrailData, pathname: string): readonly BreadcrumbItem[] {
	return resolveSidebarMenuTrail({
		menu,
		pathname,
		resolveIcon,
		rootCurrentLabel: "Overview",
		rootIcon: Home,
		unknownFallbackLabel: "Overview",
	});
}

function collectMenuUrls(items: readonly SidebarMenuTrailNode[], urls: string[]): void {
	for (const item of items) {
		urls.push(item.url);
		if (item.children !== undefined) {
			collectMenuUrls(item.children, urls);
		}
	}
}

function menuUrls(menu: SidebarMenuTrailData): readonly string[] {
	const urls: string[] = [];
	for (const section of menu.sections) {
		collectMenuUrls(section.items, urls);
	}
	collectMenuUrls(menu.bottomItems, urls);
	return urls;
}

function identityUrl(url: string): string {
	return url;
}

/**
 * The longest menu URL strictly above `pathname` (segment-aware), or `null`
 * when `pathname` is itself a menu URL or nothing in the menu covers it.
 */
function closestMenuAncestorUrl(urls: readonly string[], pathname: string): string | null {
	if (urls.includes(pathname)) {
		return null;
	}
	let best: string | null = null;
	for (const url of urls) {
		if (url.startsWith("/") && isPathWithin(url, pathname) && (best === null || url.length > best.length)) {
			best = url;
		}
	}
	return best;
}

/**
 * Builds the breadcrumb trail for a given admin path from the sidebar menu.
 *
 * Pages below a menu entry without being one (`/catalog/products/42/edit`)
 * anchor on the closest menu entry above them: its trail (with the entry
 * itself linked) followed by the remaining segments as the shared resolver
 * labels them. Without this, a nested leaf such as Catalog → Products would
 * drop out of the trail, since the shared resolver only descends into items
 * that have children.
 */
export function resolveAdminTrail(pathname: string): readonly BreadcrumbItem[] {
	const menu = SIDEBAR_MENU;
	const normalizedPath = normalizePath(pathname);
	const trail = resolveMenuTrail(menu, normalizedPath);
	const urls = menuUrls(menu);
	const anchorUrl = closestMenuAncestorUrl(urls, normalizedPath);
	if (anchorUrl === null) {
		return trail;
	}
	const anchorDepth = segmentsOfPath(anchorUrl).length;
	// The shared resolver labels every segment past the deepest menu URL that
	// shares leading segments with `pathname`. Only when that is the anchor are
	// the trailing crumbs exactly the segments below it.
	if (bestSharedSegmentPrefix(normalizedPath, urls, identityUrl) !== anchorDepth) {
		return trail;
	}
	const remainingCount = segmentsOfPath(normalizedPath).length - anchorDepth;
	const anchorTrail = updateLastTrailItem(resolveMenuTrail(menu, anchorUrl), (last) => ({ ...last, href: anchorUrl }));
	return [...anchorTrail, ...trail.slice(-remainingCount)];
}
