"use client";

import { ICON_MAP } from "@/lib/navigation/menu-icons";
import { SEARCH_ALIAS_MAP, SEARCHABLE_ITEMS } from "@/lib/palette/search";
import { useCommandPaletteStore } from "@/stores/command-palette-store";
import { AppCommandPalette, type AppCommandPaletteQuickAction } from "@workspace/ui/components/navigation/app-command-palette";
import { CreditCard, LayoutDashboard, Settings, SunMoon } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import * as React from "react";

export interface CommandPaletteProps {
	readonly open?: boolean;
	readonly setOpen?: (open: boolean) => void;
}

function renderMenuIcon(iconName: string | undefined, className: string): React.ReactNode {
	if (iconName === undefined) {
		return null;
	}
	const Icon = ICON_MAP[iconName] ?? null;
	if (Icon === null) {
		return null;
	}
	return <Icon className={className} />;
}

export function CommandPalette({ open: externalOpen, setOpen: externalSetOpen }: CommandPaletteProps): React.JSX.Element {
	const router = useRouter();
	const { setTheme, resolvedTheme } = useTheme();

	const recentSearches = useCommandPaletteStore((s) => s.recentSearches);
	const pinnedUrls = useCommandPaletteStore((s) => s.pinnedUrls);
	const addRecent = useCommandPaletteStore((s) => s.addRecentSearch);
	const togglePinned = useCommandPaletteStore((s) => s.togglePinnedUrl);

	const closePalette = React.useCallback((): void => {
		externalSetOpen?.(false);
	}, [externalSetOpen]);

	const quickActions = React.useMemo(
		(): readonly AppCommandPaletteQuickAction[] => [
			{
				id: "toggle-theme",
				title: "Toggle Theme",
				description: "Switch between light and dark mode",
				icon: SunMoon,
				color: "text-amber-600 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/40",
				shortcut: "⌘T",
				keywords: ["dark", "light", "mode", "theme"],
				run: (): void => {
					closePalette();
					setTheme(resolvedTheme === "dark" ? "light" : "dark");
				},
			},
			{
				id: "open-settings",
				title: "Open Settings",
				description: "Manage your account and preferences",
				icon: Settings,
				color: "text-indigo-600 bg-indigo-100 dark:text-indigo-300 dark:bg-indigo-900/40",
				shortcut: "⌘,",
				keywords: ["preferences", "account", "config"],
				run: (): void => {
					router.push("/settings/general");
					closePalette();
				},
			},
			{
				id: "go-dashboard",
				title: "Go to Dashboard",
				description: "Return to the main dashboard",
				icon: LayoutDashboard,
				color: "text-blue-600 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/40",
				shortcut: "⌘D",
				keywords: ["home", "main", "overview"],
				run: (): void => {
					router.push("/");
					closePalette();
				},
			},
			{
				id: "open-billing",
				title: "Open Billing",
				description: "View your plan and invoices",
				icon: CreditCard,
				color: "text-emerald-600 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/40",
				keywords: ["plan", "invoice", "payment", "subscription"],
				run: (): void => {
					router.push("/settings/billing");
					closePalette();
				},
			},
		],
		[closePalette, router, resolvedTheme, setTheme],
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
			title="Command palette"
			description="Search commands, pages, and actions"
			searchableItems={SEARCHABLE_ITEMS}
			quickActions={quickActions}
			recentSearches={recentSearches}
			pinnedUrls={pinnedUrls}
			onAddRecent={addRecent}
			onTogglePinned={togglePinned}
			onNavigate={handleNavigate}
			renderIcon={renderMenuIcon}
			aliasMap={SEARCH_ALIAS_MAP}
		/>
	);
}
