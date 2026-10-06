"use client";

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { CircleUserRound, LogOut, Settings, Shield } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { getUserInitials } from "@workspace/ui/lib/core/user-initials";
import { useCanAccessRoute } from "@/components/layout/authorized-navigation";
import type { SidebarUser } from "@/lib/navigation/sidebar";
import { ROUTES } from "@/lib/routes";

export interface Profile01Props {
	readonly user: SidebarUser;
	readonly onLogout: () => void;
}

interface ProfileMenuItem {
	readonly label: string;
	readonly href: string;
	readonly icon: React.ReactNode;
}

/**
 * Profile dropdown content shown in the topbar: the signed-in user's card
 * (avatar, name, email) followed by the profile, account-security and settings links
 * the session may open, and a logout button. Personal pages live under
 * `/account`; Settings is platform configuration.
 */
export function Profile01({ user, onLogout }: Profile01Props): React.JSX.Element {
	const router = useRouter();
	const initials = getUserInitials(user.name);
	const canAccessRoute = useCanAccessRoute();

	// Links go through the route guard's rules: a page the session cannot open is not offered.
	const allMenuItems: readonly ProfileMenuItem[] = [
		{ label: "Profile", href: ROUTES.account.profile, icon: <CircleUserRound className="size-4" /> },
		{ label: "Security", href: ROUTES.account.security, icon: <Shield className="size-4" /> },
		{ label: "Settings", href: ROUTES.settings.index, icon: <Settings className="size-4" /> },
	];
	const menuItems = allMenuItems.filter((item) => canAccessRoute(item.href));

	const handleMenuClick = React.useCallback(
		(event: React.MouseEvent<HTMLButtonElement>): void => {
			const href = event.currentTarget.dataset.href;
			if (href !== undefined) {
				router.push(href);
			}
		},
		[router],
	);

	const handleLogout = React.useCallback((): void => {
		onLogout();
	}, [onLogout]);

	return (
		<div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card shadow-lg">
			{/* Gradient Background Accent */}
			<div className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-transparent" />

			<div className="relative p-6">
				{/* User Profile Section */}
				<div className="mb-6 flex items-start gap-4">
					<div className="relative shrink-0">
						<div className="relative h-14 w-14 rounded-full ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
							<Avatar className="h-full w-full">
								<AvatarFallback className="rounded-full text-base font-semibold">{initials}</AvatarFallback>
							</Avatar>
						</div>
					</div>

					<div className="min-w-0 flex-1 pt-1">
						<h3 className="truncate text-base font-semibold text-foreground">{user.name}</h3>
						<p className="truncate text-sm text-muted-foreground">{user.email}</p>
					</div>
				</div>

				{/* Divider */}
				<div className="my-4 h-px bg-border/60" />

				{/* Menu Items */}
				<div className="space-y-1">
					{menuItems.map((item) => (
						<Button
							key={item.label}
							type="button"
							variant="nav"
							data-href={item.href}
							onClick={handleMenuClick}
							className="group h-auto justify-start rounded-lg px-3 py-2.5 transition-all duration-200 hover:translate-x-0.5 hover:bg-accent/50">
							<div className="flex items-center gap-3">
								<div className="text-muted-foreground transition-colors group-hover:text-foreground">{item.icon}</div>
								<span className="text-sm font-medium text-foreground">{item.label}</span>
							</div>
						</Button>
					))}

					{/* Divider before logout */}
					<div className="my-2 h-px bg-border/60" />

					{/* Logout Button */}
					<Button
						type="button"
						variant="nav"
						onClick={handleLogout}
						className="group h-auto justify-start gap-3 rounded-lg px-3 py-2.5 transition-all duration-200 hover:translate-x-0.5 hover:bg-destructive/10">
						<div className="text-muted-foreground transition-colors group-hover:text-destructive">
							<LogOut className="size-4" />
						</div>
						<span className="text-sm font-medium text-foreground transition-colors group-hover:text-destructive">Logout</span>
					</Button>
				</div>
			</div>
		</div>
	);
}
