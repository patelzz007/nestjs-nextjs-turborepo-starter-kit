import type { AppShellProfileMenuItem } from "@workspace/ui/components/app-shell-profile-dropdown";
import { CircleUser, KeyRound, LayoutDashboard, Settings } from "lucide-react";
import * as React from "react";

/** The tenant-scoped pages the profile menu leads to. */
export interface MerchantProfileMenuPaths {
	readonly account: string;
	readonly dashboard: string;
	readonly apiKeys: string;
	readonly settings: string;
}

/** What the member may open. */
export interface MerchantProfileMenuAccess {
	/** Enrollment is unfinished: only the personal account (where it is completed) is offered. */
	readonly isEnrollmentLocked: boolean;
	readonly canViewDashboard: boolean;
	readonly canManageApiKeys: boolean;
}

/**
 * The merchant portal's profile menu (opened from the sidebar's account row):
 * the personal account, then the dashboard and API keys when the member's
 * capabilities allow them, and the tenant's settings.
 */
export function merchantProfileMenuItems(
	access: MerchantProfileMenuAccess,
	paths: MerchantProfileMenuPaths,
	navigate: (path: string) => void,
): readonly AppShellProfileMenuItem[] {
	const goTo =
		(path: string): (() => void) =>
		(): void => {
			navigate(path);
		};
	const items: AppShellProfileMenuItem[] = [{ label: "Account", icon: <CircleUser className="size-4" aria-hidden="true" />, onClick: goTo(paths.account) }];
	if (access.isEnrollmentLocked) {
		return items;
	}
	if (access.canViewDashboard) {
		items.push({ label: "Dashboard", icon: <LayoutDashboard className="size-4" aria-hidden="true" />, onClick: goTo(paths.dashboard) });
	}
	if (access.canManageApiKeys) {
		items.push({ label: "API keys", icon: <KeyRound className="size-4" aria-hidden="true" />, onClick: goTo(paths.apiKeys) });
	}
	items.push({ label: "Tenant settings", icon: <Settings className="size-4" aria-hidden="true" />, onClick: goTo(paths.settings) });
	return items;
}
