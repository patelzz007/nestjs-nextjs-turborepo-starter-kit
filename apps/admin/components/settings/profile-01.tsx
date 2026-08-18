"use client";

import { Avatar, AvatarFallback } from "@workspace/ui/components/display/avatar";
import { Button } from "@workspace/ui/components/form/button";
import { toastMessage } from "@workspace/ui/components/feedback/toast";
import { CreditCard, FileText, LogOut, MoveUpRight, Settings, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { getInitials } from "@/lib/user-initials";
import type { SidebarUser } from "@/lib/navigation/sidebar";

export interface Profile01Props {
	readonly user: SidebarUser;
	readonly onLogout: () => void;
	readonly subscription?: string;
}

interface ProfileMenuItem {
	readonly label: string;
	readonly href?: string;
	readonly external?: boolean;
	readonly icon: React.ReactNode;
}

/**
 * Profile dropdown content shown in the topbar: the signed-in user's card
 * (avatar + online status + plan badge) followed by account / settings /
 * terms actions and a logout button. Navigation targets are real routes —
 * nothing points at a dead `/settings` route anymore.
 */
export function Profile01({ user, onLogout, subscription = "Free Trial" }: Profile01Props): React.JSX.Element {
	const router = useRouter();
	const initials = getInitials(user.name);

	const menuItems: readonly ProfileMenuItem[] = [
		{ label: "Billing", href: "/settings/billing", icon: <CreditCard className="size-4" /> },
		{ label: "Settings", href: "/settings/general", icon: <Settings className="size-4" /> },
		{ label: "Terms & Policies", external: true, icon: <FileText className="size-4" /> },
	];

	const handleMenuClick = React.useCallback(
		(event: React.MouseEvent<HTMLButtonElement>): void => {
			const href = event.currentTarget.dataset.href;
			if (href === undefined || href.length === 0) {
				toastMessage.info({ title: "Coming soon", description: "This feature will be available soon." });
				return;
			}
			router.push(href);
		},
		[router],
	);

	const handleUpgrade = React.useCallback((): void => {
		router.push("/settings/billing");
	}, [router]);

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
							{/* Online Status Indicator */}
							<div className="absolute -right-0.5 -bottom-0.5 h-4 w-4 rounded-full bg-emerald-500 shadow-sm ring-2 ring-background" />
						</div>
					</div>

					<div className="min-w-0 flex-1 pt-1">
						<h3 className="truncate text-base font-semibold text-foreground">{user.name}</h3>
						<p className="truncate text-sm text-muted-foreground">{user.email}</p>
					</div>
				</div>

				{/* Subscription Badge */}
				<div className="mb-4 rounded-xl border border-primary/20 bg-linear-to-r from-primary/10 to-primary/5 p-3">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<div className="rounded-lg bg-primary/10 p-1.5">
								<Sparkles className="h-3.5 w-3.5 text-primary" />
							</div>
							<div>
								<p className="text-xs font-medium text-muted-foreground">Current Plan</p>
								<p className="text-sm font-semibold text-foreground">{subscription}</p>
							</div>
						</div>
						<Button type="button" variant="ghost" size="sm" onClick={handleUpgrade} className="text-xs font-medium text-primary hover:text-primary/80">
							Upgrade
						</Button>
					</div>
				</div>

				{/* Divider */}
				<div className="my-4 h-px bg-border/60" />

				{/* Menu Items */}
				<div className="space-y-1">
					{menuItems.map((item) => (
						<button
							key={item.label}
							type="button"
							data-href={item.href ?? ""}
							onClick={handleMenuClick}
							className="group flex w-full items-center justify-between rounded-lg px-3 py-2.5 transition-all duration-200 hover:translate-x-0.5 hover:bg-accent/50">
							<div className="flex items-center gap-3">
								<div className="text-muted-foreground transition-colors group-hover:text-foreground">{item.icon}</div>
								<span className="text-sm font-medium text-foreground">{item.label}</span>
							</div>
							{item.external ? <MoveUpRight className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-foreground" /> : null}
						</button>
					))}

					{/* Divider before logout */}
					<div className="my-2 h-px bg-border/60" />

					{/* Logout Button */}
					<button
						type="button"
						onClick={handleLogout}
						className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200 hover:translate-x-0.5 hover:bg-destructive/10">
						<div className="text-muted-foreground transition-colors group-hover:text-destructive">
							<LogOut className="size-4" />
						</div>
						<span className="text-sm font-medium text-foreground transition-colors group-hover:text-destructive">Logout</span>
					</button>
				</div>
			</div>
		</div>
	);
}
