"use client";

import { SECTION_COLORS } from "@/lib/docs-tree";
import { DEFAULT_DOCS_PAGE_ICON } from "@/lib/docs-nav-icons";
import { cn } from "@workspace/ui/lib/core/utils";
import { panelSidebarNavIconVariants, panelSidebarNavItemVariants } from "@workspace/ui/lib/sidebar/panel-nav-variants";
import type { PanelSectionColor } from "@workspace/ui/lib/sidebar/menu-view";
import { isRouteActive } from "@workspace/ui/lib/sidebar/menu-view";
import Link from "fumadocs-core/link";
import { usePathname } from "fumadocs-core/framework";
import type * as PageTree from "fumadocs-core/page-tree";
import { cloneElement, createElement, isValidElement, type ReactNode } from "react";

const SECTION_COLOR_CLASSES: Readonly<Record<PanelSectionColor, string>> = {
	blue: "bg-blue-500",
	green: "bg-emerald-500",
	amber: "bg-amber-500",
	rose: "bg-rose-500",
	purple: "bg-purple-500",
	teal: "bg-teal-500",
};

const DOCS_NAV_ITEM_ACTIVE_CLASSES =
	"bg-slate-800 font-medium text-white hover:bg-slate-800! hover:text-white! dark:bg-white dark:text-slate-800 dark:hover:bg-white! dark:hover:text-slate-800!";

function treeNodeLabel(name: ReactNode): string {
	return typeof name === "string" ? name.trim() : "";
}

function renderNavIcon(icon: ReactNode, isActive: boolean): ReactNode {
	const iconElement = isValidElement<{ className?: string }>(icon) ? icon : createElement(DEFAULT_DOCS_PAGE_ICON, { className: "size-4" });

	return cloneElement(iconElement, {
		className: cn(iconElement.props.className, isActive ? "mr-3 h-4 w-4 shrink-0 text-white dark:text-slate-800" : panelSidebarNavIconVariants({ state: "default" })),
	});
}

function DocsSidebarItem({ item }: { readonly item: PageTree.Item }): React.JSX.Element {
	const pathname = usePathname();
	const isActive = isRouteActive(item.url, pathname);

	return (
		<Link
			href={item.url}
			external={item.external}
			data-active={isActive ? true : undefined}
			className={cn(panelSidebarNavItemVariants({ state: "default" }), isActive && DOCS_NAV_ITEM_ACTIVE_CLASSES, "group mb-0.5 w-full no-underline")}>
			<span className="flex min-w-0 flex-1 items-center">
				{renderNavIcon(item.icon, isActive)}
				<span className="truncate">{item.name}</span>
			</span>
		</Link>
	);
}

function DocsSidebarSeparator({ item }: { readonly item: PageTree.Separator }): React.JSX.Element {
	const title = treeNodeLabel(item.name);
	const color = SECTION_COLORS[title];

	return (
		<div className="mt-6 mb-2 flex items-center gap-2 px-2 first:mt-2" data-sidebar-section-header="true">
			{color !== undefined ? <span className={cn("inline-block size-1.5 shrink-0 rounded-full", SECTION_COLOR_CLASSES[color])} aria-hidden="true" /> : null}
			<span className="truncate text-(length:--text-sidebar-section) font-semibold text-sidebar-foreground">{title}</span>
		</div>
	);
}

/** Panel-style sidebar nav — matches admin / web / merchant sidebars. */
export const docsSidebarComponents = {
	Item: DocsSidebarItem,
	Separator: DocsSidebarSeparator,
};
