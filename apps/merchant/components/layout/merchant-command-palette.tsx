"use client";

import { isMerchantEnrollmentAllowedPath, useMerchantEnrollmentLock } from "@/lib/auth/enrollment";
import { createMerchantNavHrefResolver } from "@/lib/navigation/resolve-nav-href";
import { useOrganizationSlug } from "@/lib/org/use-organization-slug";
import { useOrganizationPath } from "@/lib/org/use-organization-path";
import { ORG_ROUTES } from "@/lib/routes";
import { buildMerchantPaletteItems, renderMerchantPaletteIcon } from "@/lib/palette/nav-items";
import { useAuthorization } from "@workspace/client/lib/auth/can";
import { MERCHANT_CAPABILITY } from "@workspace/shared";
import { toastMessage } from "@workspace/ui/components/feedback/toast";
import { useCommandPaletteCommands, useCommandPalettePinnedUrls, useCommandPaletteRecentSearches } from "@workspace/client/lib/features/command-palette/facade";
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
	const { can } = useAuthorization();
	const { isLocked: isEnrollmentLocked, disabledTooltip: enrollmentDisabledTooltip } = useMerchantEnrollmentLock();
	const organizationSlug = useOrganizationSlug();
	const accountPath = useOrganizationPath(ORG_ROUTES.account);
	const rewardsPath = useOrganizationPath(ORG_ROUTES.rewards.list);
	const resolveNavHref = React.useMemo(() => createMerchantNavHrefResolver(organizationSlug), [organizationSlug]);

	const recentSearches = useCommandPaletteRecentSearches();
	const pinnedUrls = useCommandPalettePinnedUrls();
	const { recordRecentSearch, togglePin } = useCommandPaletteCommands();

	const closePalette = React.useCallback((): void => {
		externalSetOpen?.(false);
	}, [externalSetOpen]);

	const quickActions = React.useMemo((): readonly AppCommandPaletteQuickAction[] => {
		const actions: AppCommandPaletteQuickAction[] = [
			{
				id: "toggle-theme",
				title: "Toggle theme",
				description: "Switch between light and dark mode",
				icon: SunMoon,
				color: "text-warning bg-warning-soft",
				keywords: ["dark", "light", "mode", "theme"],
				run: (): void => {
					closePalette();
					setTheme(resolvedTheme === "dark" ? "light" : "dark");
				},
			},
		];

		if (!isEnrollmentLocked && can(MERCHANT_CAPABILITY.viewRewards)) {
			actions.push({
				id: "open-rewards",
				title: "Open rewards",
				description: "Browse offers and inventory",
				icon: Ticket,
				color: "text-success bg-success-soft",
				keywords: ["home", "offers", "inventory"],
				run: (): void => {
					router.push(rewardsPath);
					closePalette();
				},
			});
		}

		return actions;
	}, [can, closePalette, isEnrollmentLocked, resolvedTheme, rewardsPath, router, setTheme]);

	const searchableItems = React.useMemo(() => {
		const items = buildMerchantPaletteItems(can);
		if (!isEnrollmentLocked) {
			return items;
		}
		return items.filter((item) => isMerchantEnrollmentAllowedPath(item.url));
	}, [can, isEnrollmentLocked]);

	const handleNavigate = React.useCallback(
		(url: string): void => {
			if (isEnrollmentLocked && !isMerchantEnrollmentAllowedPath(url)) {
				closePalette();
				toastMessage.info({
					title: "Account setup required",
					description: enrollmentDisabledTooltip,
				});
				router.push(accountPath);
				return;
			}
			router.push(resolveNavHref(url));
			closePalette();
		},
		[accountPath, closePalette, enrollmentDisabledTooltip, isEnrollmentLocked, resolveNavHref, router],
	);

	return (
		<AppCommandPalette
			{...(externalOpen !== undefined ? { open: externalOpen } : {})}
			{...(externalSetOpen !== undefined ? { setOpen: externalSetOpen } : {})}
			title="Search Merchant Portal"
			description="Navigate pages, pin shortcuts, and run quick actions"
			placeholder="Search merchant portal pages and actions…"
			searchableItems={searchableItems}
			quickActions={quickActions}
			recentSearches={recentSearches}
			pinnedUrls={pinnedUrls}
			onAddRecent={recordRecentSearch}
			onTogglePinned={togglePin}
			onNavigate={handleNavigate}
			renderIcon={renderMerchantPaletteIcon}
		/>
	);
}
