"use client";

import { useWebSession } from "@/contexts/identity/components/web-authorization-provider";
import { useAuthCommands, useAuthUser } from "@workspace/client/lib/contexts/identity";
import { useOwnAvatar } from "@workspace/client/lib/contexts/identity/profile/use-own-avatar";
import { AppShellProfileDropdown } from "@workspace/ui/components/app-shell-profile-dropdown";
import { ShellThemeToggle } from "@workspace/ui/components/shell-theme-toggle";
import { buttonVariants } from "@workspace/ui/components/button";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { cn } from "@workspace/ui/lib/core/utils";
import { Gift, LayoutDashboard, LogIn, Ticket } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { landingSectionPath, LANDING_SECTION_IDS, loginPath, ROUTES } from "@/lib/routes";

/**
 * Landing header auth — Sign in for guests, avatar dropdown when signed in,
 * and a neutral placeholder while a member's session is not verified yet
 * (the check is running, or the API is unreachable): a transient failure must
 * never show a member the signed-out "Sign in" button.
 */
export function LandingAuthActions(): React.JSX.Element {
	// The profile comes from the auth facade (the root session check restores
	// it; a guest makes no request) — never re-synced from here.
	const user = useAuthUser();
	const avatar = useOwnAvatar();
	// True while the server saw a session cookie and the client has no verdict yet.
	const { isAuthenticated: mayBeSignedIn } = useWebSession();
	const { logout } = useAuthCommands();
	const router = useRouter();

	const handleLogout = React.useCallback((): void => {
		void logout();
	}, [logout]);

	const profileMenuItems = React.useMemo(
		(): readonly { label: string; icon: React.ReactNode; onClick: () => void }[] => [
			{
				label: "Dashboard",
				icon: <LayoutDashboard className="size-4" aria-hidden="true" />,
				onClick: (): void => {
					router.push(ROUTES.dashboard.browse);
				},
			},
			{
				label: "My rewards",
				icon: <Ticket className="size-4" aria-hidden="true" />,
				onClick: (): void => {
					router.push(ROUTES.dashboard.wallet);
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
				<AppShellProfileDropdown name={user.fullName} email={user.email} avatar={avatar} menuItems={profileMenuItems} onLogout={handleLogout} />
			) : mayBeSignedIn ? (
				<Skeleton variant="circular" className="size-8" aria-hidden="true" />
			) : (
				<Link href={loginPath(ROUTES.dashboard.browse)} className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}>
					<LogIn className="size-4" aria-hidden="true" />
					Sign in
				</Link>
			)}
		</div>
	);
}
