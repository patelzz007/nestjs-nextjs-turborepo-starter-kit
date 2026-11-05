import { FileText, Home } from "lucide-react";

import type { BreadcrumbItem } from "@workspace/ui/components/breadcrumb-context";
import { menuIconResolver } from "@workspace/ui/lib/sidebar/navigation/menu-icon";
import { resolveSidebarMenuTrail, withTrailTailLabel } from "@workspace/ui/lib/sidebar/navigation/resolve-sidebar-menu-trail";

import { ICON_MAP } from "@/lib/navigation/menu-icons";
import { ADMIN_SETTINGS_SECTIONS } from "@/lib/navigation/settings-sections";
import { SIDEBAR_MENU, type CompiledSidebarMenuData } from "@/lib/navigation/sidebar-menu";
import type { UiKitLanguage } from "@workspace/ui/lib/labels/language-packs";
import { ADMIN_MESSAGES } from "@/lib/i18n/app-messages";

/** Crumb icons from the sidebar map; a page without one shows a document. */
const resolveIcon = menuIconResolver(ICON_MAP, FileText);

export { withTrailTailLabel };

/** Every settings section, by its page's URL: Settings is one sidebar link, its sections are not menu items. */
const SETTINGS_SECTION_LABELS: ReadonlyMap<string, string> = new Map(
	ADMIN_SETTINGS_SECTIONS.flatMap((group) => group.sections).map((section) => [section.href, section.label]),
);

/** The path without a trailing slash (the root stays "/"). */
function withoutTrailingSlash(pathname: string): string {
	return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

/**
 * Builds the breadcrumb trail for a given admin path from the sidebar menu.
 * Pages below a menu entry without being one (`/catalog/products/42/edit`)
 * anchor on the closest entry above them, leaf or branch (shared resolver).
 */
/** The admin trail for `pathname`, from `menu` (the sidebar in the language on screen; English by default). */
export function resolveAdminTrail(pathname: string, menu: CompiledSidebarMenuData = SIDEBAR_MENU, language: UiKitLanguage = "en"): readonly BreadcrumbItem[] {
	const trail = resolveSidebarMenuTrail({
		menu,
		pathname,
		resolveIcon,
		rootCurrentLabel: ADMIN_MESSAGES[language].navigation.breadcrumbRoot,
		rootIcon: Home,
		unknownFallbackLabel: ADMIN_MESSAGES[language].navigation.breadcrumbRoot,
	});
	// A settings section is named by its own title ("Access control"), not its URL segment.
	const sectionLabel = SETTINGS_SECTION_LABELS.get(withoutTrailingSlash(pathname));
	return sectionLabel === undefined ? trail : withTrailTailLabel(trail, sectionLabel);
}

/**
 * The trail with a link only on crumbs the session may open: a crumb whose
 * page the route guard would deny keeps its label (it is still where the page
 * sits) but is not a link — the breadcrumb never offers a page the sidebar
 * hides.
 */
export function withAccessibleLinks(trail: readonly BreadcrumbItem[], canAccess: (href: string) => boolean): readonly BreadcrumbItem[] {
	return trail.map((crumb): BreadcrumbItem => (crumb.href === undefined || canAccess(crumb.href) ? crumb : { ...crumb, href: undefined }));
}
