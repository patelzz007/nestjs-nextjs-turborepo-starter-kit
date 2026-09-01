"use client";

import { useAuth } from "@workspace/client/lib/auth";
import { toAuthUser } from "@/lib/map-auth-user";
import { AppShellProfileDropdown } from "@workspace/ui/components/navigation/app-shell-profile-dropdown";
import { ShellThemeToggle } from "@workspace/ui/components/navigation/shell-theme-toggle";
import { Button } from "@workspace/ui/components/form/button";
import { Gift, LayoutDashboard, LogIn, Ticket } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

/** Landing header auth — Sign in for guests, avatar dropdown when signed in. */
export function LandingAuthActions(): React.JSX.Element {
	const { user, login, logout, api } = useAuth();
	const router = useRouter();

	const meQuery = api.auth.me.useQuery(undefined, {
		enabled: user === null,
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
					router.push("/rewardhub");
				},
			},
			{
				label: "My rewards",
				icon: <Ticket className="size-4" aria-hidden="true" />,
				onClick: (): void => {
					router.push("/rewardhub/claims");
				},
			},
			{
				label: "Browse offers",
				icon: <Gift className="size-4" aria-hidden="true" />,
				onClick: (): void => {
					router.push("/#rewards");
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
				<Link href="/auth/login?redirect=%2Frewardhub">
					<Button size="sm" className="gap-1.5">
						<LogIn className="size-4" aria-hidden="true" />
						Sign in
					</Button>
				</Link>
			)}
		</div>
	);
}
