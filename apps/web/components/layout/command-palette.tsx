"use client";

import { renderWebPaletteIcon, WEB_PALETTE_ITEMS } from "@/lib/palette/nav-items";
import { useWebCommandPaletteStore } from "@/stores/command-palette-store";
import { AppCommandPalette, type AppCommandPaletteQuickAction } from "@workspace/ui/components/navigation/app-command-palette";
import { Gift, SunMoon } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import * as React from "react";

export interface CommandPaletteProps {
	readonly open?: boolean;
	readonly setOpen?: (open: boolean) => void;
}

export function CommandPalette({ open: externalOpen, setOpen: externalSetOpen }: CommandPaletteProps): React.JSX.Element {
	const router = useRouter();
	const { setTheme, resolvedTheme } = useTheme();

	const recentSearches = useWebCommandPaletteStore((state) => state.recentSearches);
	const pinnedUrls = useWebCommandPaletteStore((state) => state.pinnedUrls);
	const addRecent = useWebCommandPaletteStore((state) => state.addRecentSearch);
	const togglePinned = useWebCommandPaletteStore((state) => state.togglePinnedUrl);

	const closePalette = React.useCallback((): void => {
		externalSetOpen?.(false);
	}, [externalSetOpen]);

	const quickActions = React.useMemo(
		(): readonly AppCommandPaletteQuickAction[] => [
			{
				id: "toggle-theme",
				title: "Toggle theme",
				description: "Switch between light and dark mode",
				icon: SunMoon,
				color: "text-amber-600 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/40",
				keywords: ["dark", "light", "mode", "theme"],
				run: (): void => {
					closePalette();
					setTheme(resolvedTheme === "dark" ? "light" : "dark");
				},
			},
			{
				id: "browse-rewards",
				title: "Browse rewards",
				description: "Open the Reward Hub marketplace",
				icon: Gift,
				color: "text-teal-600 bg-teal-100 dark:text-teal-300 dark:bg-teal-900/40",
				keywords: ["home", "discover", "deals", "marketplace"],
				run: (): void => {
					router.push("/");
					closePalette();
				},
			},
		],
		[closePalette, resolvedTheme, router, setTheme],
	);

	const handleNavigate = React.useCallback(
		(url: string): void => {
			router.push(url);
		},
		[router],
	);

	return (
		<AppCommandPalette
			open={externalOpen}
			setOpen={externalSetOpen}
			title="Search Reward Hub"
			description="Navigate pages, pin shortcuts, and run quick actions"
			placeholder="Search rewards hub pages and actions…"
			searchableItems={WEB_PALETTE_ITEMS}
			quickActions={quickActions}
			recentSearches={recentSearches}
			pinnedUrls={pinnedUrls}
			onAddRecent={addRecent}
			onTogglePinned={togglePinned}
			onNavigate={handleNavigate}
			renderIcon={renderWebPaletteIcon}
		/>
	);
}
