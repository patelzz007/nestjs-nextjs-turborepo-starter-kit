"use client";

import { useWebSession } from "@/components/auth/web-authorization-provider";
import { useAuth } from "@workspace/client/lib/auth";
import { toAuthUser } from "@/lib/auth/map-auth-user";
import { AppShellProfileDropdown } from "@workspace/ui/components/navigation/app-shell-profile-dropdown";
import { ShellThemeToggle } from "@workspace/ui/components/navigation/shell-theme-toggle";
import { buttonVariants } from "@workspace/ui/components/form/button";
import { cn } from "@workspace/ui/lib/core/utils";
import { Gift, LayoutDashboard, LogIn, Ticket } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { landingSectionPath, LANDING_SECTION_IDS, loginPath, ROUTES } from "@/lib/routes";

/** Landing header auth — Sign in for guests, avatar dropdown when signed in. */
export function LandingAuthActions(): React.JSX.Element {
	const { user, login, logout, api } = useAuth();
	const { isAuthenticated } = useWebSession();
	const router = useRouter();

	// Load the profile only when the server saw a session cookie: a guest has
	// nothing to load, and asking anyway answered 401 on every page view.
	const meQuery = api.auth.me.useQuery(undefined, {
		enabled: user === null && isAuthenticated,
		retry: false,
	});

	React.useEffect((): void => {
		const profile = meQuery.data?.data;
		if (profile === undefined) {
			return;
		}
		login(toAuthUser(profile));
	}, [login, meQuery.data?.data]);

	const handleLogout = React.useCallback((): void => {
		void logout();
	}, [logout]);

	const profileMenuItems = React.useMemo(
		(): readonly { label: string; icon: React.ReactNode; onClick: () => void }[] => [
			{
				label: "Dashboard",
				icon: <LayoutDashboard className="size-4" aria-hidden="true" />,
				onClick: (): void => {
					router.push(ROUTES.rewardHub.browse);
				},
			},
			{
				label: "My rewards",
				icon: <Ticket className="size-4" aria-hidden="true" />,
				onClick: (): void => {
					router.push(ROUTES.rewardHub.wallet);
				},
			},
			{
				label: "Browse offers",
				icon: <Gift className="size-4" aria-hidden="true" />,
				onClick: (): void => {
					router.push(landingSectionPath(LANDING_SECTION_IDS.rewards));
				},
			},
		],
		[router],
	);

	return (
		<div className="flex items-center gap-2 sm:gap-3">
			<ShellThemeToggle />
			{user !== null ? (
				<AppShellProfileDropdown name={user.fullName} email={user.email} menuItems={profileMenuItems} onLogout={handleLogout} />
			) : (
				<Link href={loginPath(ROUTES.rewardHub.browse)} className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}>
					<LogIn className="size-4" aria-hidden="true" />
					Sign in
				</Link>
			)}
		</div>
	);
}
