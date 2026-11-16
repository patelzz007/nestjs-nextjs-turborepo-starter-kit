// The web's breadcrumb trail resolver: the shared, framework-free resolver (@workspace/shared
// `resolveMenuTrail`, which the mobile app uses too) with lucide-react icons, a page with no menu entry
// showing a document.

import { resolveMenuTrail, withMenuTrailTailLabel, type ResolveMenuTrailConfig } from "@workspace/shared";
import { FileText, type LucideIcon } from "lucide-react";

import type { BreadcrumbItem } from "@workspace/ui/components/breadcrumb-context";

export type { SidebarMenuTrailData, SidebarMenuTrailNode, SidebarMenuTrailSection, SidebarTrailPage, SidebarTrailPageResolver } from "@workspace/shared";

/** The web's resolver settings: the shared ones with lucide icons; a page's own icon is always a document. */
export type ResolveSidebarMenuTrailConfig = Omit<ResolveMenuTrailConfig<LucideIcon>, "pageIcon">;

/** The breadcrumb trail of `pathname`, read from the sidebar menu. The final crumb has no `href`. */
export function resolveSidebarMenuTrail(config: ResolveSidebarMenuTrailConfig): readonly BreadcrumbItem[] {
	return resolveMenuTrail<LucideIcon>({ ...config, pageIcon: FileText });
}

/** Replaces the final crumb's label: for a data-driven page whose name is only known at runtime. */
export function withTrailTailLabel(trail: readonly BreadcrumbItem[], label: string): readonly BreadcrumbItem[] {
	return withMenuTrailTailLabel(trail, label, FileText);
}
