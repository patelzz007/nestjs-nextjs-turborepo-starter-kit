"use client";

import { useCanAccessWebPath } from "@/components/auth/route-access-guard";
import { accessiblePaletteItems, renderWebPaletteIcon } from "@/lib/palette/nav-items";
import { useCommandPaletteCommands, useCommandPalettePinnedUrls, useCommandPaletteRecentSearches } from "@workspace/client/lib/features/command-palette/facade";
import { AppCommandPalette, type AppCommandPaletteQuickAction } from "@workspace/ui/components/app-command-palette";
import { Gift, SunMoon } from "lucide-react";
import { useThemeToggle } from "@workspace/ui/hooks/use-theme-toggle";
import { useRouter } from "next/navigation";
import * as React from "react";
import { ROUTES } from "@/lib/routes";

export interface CommandPaletteProps {
	readonly open?: boolean;
	readonly setOpen?: (open: boolean) => void;
}

export function CommandPalette({ open: externalOpen, setOpen: externalSetOpen }: CommandPaletteProps): React.JSX.Element {
	const router = useRouter();
	const { toggleTheme } = useThemeToggle();
	const canAccessPath = useCanAccessWebPath();
	// Same route table as the guard and the sidebar: never offer a page the session cannot open.
	const searchableItems = React.useMemo(() => accessiblePaletteItems(canAccessPath), [canAccessPath]);

	const recentSearches = useCommandPaletteRecentSearches();
	const pinnedUrls = useCommandPalettePinnedUrls();
	const { recordRecentSearch, togglePin } = useCommandPaletteCommands();

	const closePalette = React.useCallback((): void => {
		externalSetOpen?.(false);
	}, [externalSetOpen]);

	const quickActions = React.useMemo((): readonly AppCommandPaletteQuickAction[] => {
		const toggleThemeAction: AppCommandPaletteQuickAction = {
			id: "toggle-theme",
			title: "Toggle theme",
			description: "Switch between light and dark mode",
			icon: SunMoon,
			color: "text-warning bg-warning-soft",
			keywords: ["dark", "light", "mode", "theme"],
			run: (): void => {
				closePalette();
				toggleTheme();
			},
		};
		if (!canAccessPath(ROUTES.rewardHub.browse)) {
			return [toggleThemeAction];
		}
		return [
			toggleThemeAction,
			{
				id: "browse-rewards",
				title: "Browse rewards",
				description: "Open the Reward Hub marketplace",
				icon: Gift,
				color: "text-success bg-success-soft",
				keywords: ["home", "discover", "deals", "marketplace"],
				run: (): void => {
					router.push(ROUTES.rewardHub.browse);
					closePalette();
				},
			},
		];
	}, [canAccessPath, closePalette, router, toggleTheme]);

	const handleNavigate = React.useCallback(
		(url: string): void => {
			router.push(url);
		},
		[router],
	);

	return (
		<AppCommandPalette
			{...(externalOpen !== undefined ? { open: externalOpen } : {})}
			{...(externalSetOpen !== undefined ? { setOpen: externalSetOpen } : {})}
			title="Search Reward Hub"
			description="Navigate pages, pin shortcuts, and run quick actions"
			placeholder="Search rewards hub pages and actions…"
			searchableItems={searchableItems}
			quickActions={quickActions}
			recentSearches={recentSearches}
			pinnedUrls={pinnedUrls}
			onAddRecent={recordRecentSearch}
			onTogglePinned={togglePin}
			onNavigate={handleNavigate}
			renderIcon={renderWebPaletteIcon}
		/>
	);
}
