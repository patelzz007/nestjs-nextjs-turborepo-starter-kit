"use client";

import { Button } from "@workspace/ui/components/button";
import { Kbd, KbdGroup } from "@workspace/ui/components/kbd";
import { SidebarTrigger } from "@workspace/ui/components/sidebar";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { cn } from "@workspace/ui/lib/core/utils";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { Search } from "lucide-react";
import * as React from "react";

export interface AppShellHeaderProps {
	/** Where the current page sits — the app's breadcrumb trail. */
	readonly breadcrumb?: React.ReactNode;
	/** Opens the app's command palette (also ⌘K / Ctrl+K — register it with `useCommandPaletteShortcut`). */
	readonly onOpenSearch: () => void;
	/** The app's page-context actions, before search (a store switcher, notifications). */
	readonly actions?: React.ReactNode;
	/** Per-usage overrides of the `appShellTopbarSearch` family's copy. */
	readonly searchLabels?: UiKitLabelsOverride<"appShellTopbarSearch">;
	readonly className?: string;
}

/**
 * The page panel's header (app shell 3) — one implementation for admin, web
 * and merchant. 56pt across the top of the floating panel, on the panel's own
 * surface (`shell-panel`) with a soft hairline under it; the page scrolls
 * beneath it. It carries what belongs to the page: where it is (the
 * breadcrumb trail), the app's page-context actions, and search (⌘K). The
 * sidebar holds the rest of the chrome (brand, collapse, status, profile,
 * theme), so nothing is shown twice.
 *
 * The expand toggle shows only where the sidebar is out of sight: on phones
 * (the sidebar is a drawer) and on desktop once it is collapsed. On desktop
 * its slot opens and closes on the sidebar's spring (styles/components.css),
 * so the breadcrumb beside it glides instead of jumping — CSS only, so there
 * is no flash before hydration and a toggle re-renders nothing here.
 * The ref reaches the `<header>`.
 */
export const AppShellHeader = React.forwardRef<HTMLElement, AppShellHeaderProps>(function AppShellHeader(
	{ breadcrumb, onOpenSearch, actions, searchLabels, className },
	ref,
): React.JSX.Element {
	const labels = useUiKitLabels("appShellTopbarSearch", searchLabels);
	return (
		<header ref={ref} data-slot="app-shell-header" className={cn("flex h-14 shrink-0 items-center gap-2 border-b border-border bg-shell-panel px-4 sm:px-6", className)}>
			<span data-slot="app-shell-header-toggle" className="flex shrink-0 overflow-hidden">
				<SidebarTrigger className="shrink-0 text-muted-foreground hover:text-foreground" />
			</span>
			<div className="min-w-0 flex-1">{breadcrumb}</div>
			{actions !== undefined && actions !== null ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
			<Button type="button" variant="outline" size="sm" onClick={onOpenSearch} aria-label={labels.desktopAriaLabel} className="shrink-0 gap-2 text-muted-foreground">
				<Search aria-hidden="true" />
				<span className="hidden sm:inline">{labels.mobileAriaLabel}</span>
				<KbdGroup className="hidden md:inline-flex">
					<Kbd>⌘</Kbd>
					<Kbd>K</Kbd>
				</KbdGroup>
			</Button>
		</header>
	);
});
