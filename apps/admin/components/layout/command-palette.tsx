"use client";

import { ICON_MAP } from "@/lib/navigation/menu-icons";
import { SEARCH_ALIAS_MAP } from "@/lib/palette/search";
import { useAuthorizedSearchableItems, useCanAccessRoute } from "@/components/layout/authorized-navigation";
import { ROUTES } from "@/lib/routes";
import { useCommandPaletteCommands, useCommandPalettePinnedUrls, useCommandPaletteRecentSearches } from "@workspace/client/lib/features/command-palette/facade";
import { AppCommandPalette, type AppCommandPaletteQuickAction } from "@workspace/ui/components/app-command-palette";
import { CircleUserRound, LayoutDashboard, Settings, SunMoon } from "lucide-react";
import { useThemeToggle } from "@workspace/ui/hooks/use-theme-toggle";
import { useRouter } from "next/navigation";
import * as React from "react";

export interface CommandPaletteProps {
	readonly open?: boolean;
	readonly setOpen?: (open: boolean) => void;
}

/** A quick action plus the page it opens (none for in-place actions such as the theme toggle). */
interface RoutedQuickAction {
	readonly href?: string;
	readonly action: AppCommandPaletteQuickAction;
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
	const { toggleTheme } = useThemeToggle();
	const searchableItems = useAuthorizedSearchableItems();
	const canAccessRoute = useCanAccessRoute();

	const recentSearches = useCommandPaletteRecentSearches();
	const pinnedUrls = useCommandPalettePinnedUrls();
	const { recordRecentSearch, togglePin } = useCommandPaletteCommands();

	const closePalette = React.useCallback((): void => {
		externalSetOpen?.(false);
	}, [externalSetOpen]);

	const quickActions = React.useMemo((): readonly AppCommandPaletteQuickAction[] => {
		const navigateTo = (href: string): void => {
			router.push(href);
			closePalette();
		};
		const actions: readonly RoutedQuickAction[] = [
			{
				action: {
					id: "toggle-theme",
					title: "Toggle Theme",
					description: "Switch between light and dark mode",
					icon: SunMoon,
					color: "text-warning bg-warning-soft",
					keywords: ["dark", "light", "mode", "theme"],
					run: (): void => {
						closePalette();
						toggleTheme();
					},
				},
			},
			{
				href: ROUTES.settings.index,
				action: {
					id: "open-settings",
					title: "Open Settings",
					description: "Platform configuration — billing and access control",
					icon: Settings,
					color: "text-primary bg-primary/10",
					keywords: ["configuration", "config", "platform"],
					run: (): void => {
						navigateTo(ROUTES.settings.index);
					},
				},
			},
			{
				href: ROUTES.account.index,
				action: {
					id: "open-account",
					title: "Open Account",
					description: "Your profile, password and two-factor authentication",
					icon: CircleUserRound,
					color: "text-info bg-info-soft",
					keywords: ["account", "profile", "name", "avatar", "security", "password", "2fa", "mfa"],
					run: (): void => {
						navigateTo(ROUTES.account.index);
					},
				},
			},
			{
				href: ROUTES.home,
				action: {
					id: "go-dashboard",
					title: "Go to Dashboard",
					description: "Return to the main dashboard",
					icon: LayoutDashboard,
					color: "text-success bg-success-soft",
					keywords: ["home", "main", "overview"],
					run: (): void => {
						navigateTo(ROUTES.home);
					},
				},
			},
		];
		// Navigation actions obey the route guard's rules, like the searchable items.
		return actions.filter((entry) => entry.href === undefined || canAccessRoute(entry.href)).map((entry) => entry.action);
	}, [canAccessRoute, closePalette, router, toggleTheme]);

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
			title="Command palette"
			description="Search commands, pages, and actions"
			searchableItems={searchableItems}
			quickActions={quickActions}
			recentSearches={recentSearches}
			pinnedUrls={pinnedUrls}
			onAddRecent={recordRecentSearch}
			onTogglePinned={togglePin}
			onNavigate={handleNavigate}
			renderIcon={renderMenuIcon}
			aliasMap={SEARCH_ALIAS_MAP}
		/>
	);
}
