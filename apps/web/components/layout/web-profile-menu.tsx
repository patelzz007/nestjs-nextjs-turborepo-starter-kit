import type { AppShellProfileMenuItem } from "@workspace/ui/components/app-shell-profile-dropdown";
import { Gift, Settings, Ticket } from "lucide-react";
import * as React from "react";

import { ROUTES } from "@/lib/routes";

/**
 * The web app's profile menu (opened from the sidebar's account row): the
 * reward pages, and the personal account settings — which need a session, so
 * guests are not offered them.
 */
export function webProfileMenuItems(isAuthenticated: boolean, navigate: (path: string) => void): readonly AppShellProfileMenuItem[] {
	const goTo =
		(path: string): (() => void) =>
		(): void => {
			navigate(path);
		};
	const items: AppShellProfileMenuItem[] = [
		{ label: "Browse rewards", icon: <Gift className="size-4" aria-hidden="true" />, onClick: goTo(ROUTES.dashboard.browse) },
		{ label: "My rewards", icon: <Ticket className="size-4" aria-hidden="true" />, onClick: goTo(ROUTES.dashboard.wallet) },
	];
	if (isAuthenticated) {
		items.push({ label: "Account settings", icon: <Settings className="size-4" aria-hidden="true" />, onClick: goTo(ROUTES.dashboard.account) });
	}
	return items;
}
