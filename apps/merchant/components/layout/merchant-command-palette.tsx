"use client";

import { renderMerchantPaletteIcon, MERCHANT_PALETTE_ITEMS } from "@/lib/palette/nav-items";
import { useMerchantCommandPaletteStore } from "@/stores/command-palette-store";
import { AppCommandPalette, type AppCommandPaletteQuickAction } from "@workspace/ui/components/navigation/app-command-palette";
import { SunMoon, Ticket } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import * as React from "react";

export interface MerchantCommandPaletteProps {
	readonly open?: boolean;
	readonly setOpen?: (open: boolean) => void;
}

export function MerchantCommandPalette({ open: externalOpen, setOpen: externalSetOpen }: MerchantCommandPaletteProps): React.JSX.Element {
	const router = useRouter();
	const { setTheme, resolvedTheme } = useTheme();

	const recentSearches = useMerchantCommandPaletteStore((state) => state.recentSearches);
	const pinnedUrls = useMerchantCommandPaletteStore((state) => state.pinnedUrls);
	const addRecent = useMerchantCommandPaletteStore((state) => state.addRecentSearch);
	const togglePinned = useMerchantCommandPaletteStore((state) => state.togglePinnedUrl);

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
				id: "open-rewards",
				title: "Open rewards",
				description: "Manage offers and inventory",
				icon: Ticket,
				color: "text-emerald-600 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/40",
				keywords: ["home", "offers", "inventory"],
				run: (): void => {
					router.push("/rewards");
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
			title="Search Merchant Portal"
			description="Navigate pages, pin shortcuts, and run quick actions"
			placeholder="Search merchant portal pages and actions…"
			searchableItems={MERCHANT_PALETTE_ITEMS}
			quickActions={quickActions}
			recentSearches={recentSearches}
			pinnedUrls={pinnedUrls}
			onAddRecent={addRecent}
			onTogglePinned={togglePinned}
			onNavigate={handleNavigate}
			renderIcon={renderMerchantPaletteIcon}
		/>
	);
}
