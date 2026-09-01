"use client";

import { Avatar, AvatarFallback } from "@workspace/ui/components/display/avatar";
import { Button } from "@workspace/ui/components/form/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@workspace/ui/components/overlay/dropdown-menu";
import { getUserInitials } from "@workspace/ui/lib/user-initials";
import { LogOut, MoveUpRight } from "lucide-react";
import * as React from "react";

export interface AppShellProfileMenuItem {
	readonly label: string;
	readonly icon: React.ReactNode;
	readonly onClick: () => void;
	readonly external?: boolean;
}

export interface AppShellProfileDropdownProps {
	readonly name: string;
	readonly email?: string | null;
	readonly menuItems?: readonly AppShellProfileMenuItem[];
	readonly onLogout: () => void;
}

function AppShellProfileMenu({ name, email, menuItems = [], onLogout }: AppShellProfileDropdownProps): React.JSX.Element {
	const initials = getUserInitials(name);

	const handleLogout = React.useCallback((): void => {
		onLogout();
	}, [onLogout]);

	return (
		<div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card shadow-lg">
			<div className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-transparent" />

			<div className="relative p-6">
				<div className="mb-6 flex items-start gap-4">
					<div className="relative shrink-0">
						<div className="relative h-14 w-14 rounded-full ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
							<Avatar className="h-full w-full">
								<AvatarFallback className="rounded-full text-base font-semibold">{initials}</AvatarFallback>
							</Avatar>
							<div className="absolute -right-0.5 -bottom-0.5 h-4 w-4 rounded-full bg-emerald-500 shadow-sm ring-2 ring-background" />
						</div>
					</div>

					<div className="min-w-0 flex-1 pt-1">
						<h3 className="truncate text-base font-semibold text-foreground">{name}</h3>
						{email !== null && email !== undefined && email.length > 0 ? <p className="truncate text-sm text-muted-foreground">{email}</p> : null}
					</div>
				</div>

				{menuItems.length > 0 ? (
					<>
						<div className="my-4 h-px bg-border/60" />
						<div className="space-y-1">
							{menuItems.map((item) => (
								<Button
									key={item.label}
									type="button"
									variant="nav"
									onClick={item.onClick}
									className="group h-auto justify-between rounded-lg px-3 py-2.5 transition-all duration-200 hover:translate-x-0.5 hover:bg-muted hover:text-foreground">
									<div className="flex items-center gap-3">
										<div className="text-muted-foreground transition-colors group-hover:text-foreground">{item.icon}</div>
										<span className="text-sm font-medium text-foreground">{item.label}</span>
									</div>
									{item.external ? <MoveUpRight className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-foreground" /> : null}
								</Button>
							))}
						</div>
					</>
				) : null}

				<div className={menuItems.length > 0 ? "my-2 h-px bg-border/60" : "my-4 h-px bg-border/60"} />

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
	);
}

/** Avatar trigger that opens the shared profile dropdown panel. */
export function AppShellProfileDropdown(props: AppShellProfileDropdownProps): React.JSX.Element {
	const initials = getUserInitials(props.name);

	return (
		<div className="ml-1 md:ml-3">
			<DropdownMenu>
				<DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="rounded-full" />} aria-label="Open profile menu">
					<Avatar className="size-8">
						<AvatarFallback className="rounded-full text-xs">{initials}</AvatarFallback>
					</Avatar>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" sideOffset={8} className="w-[320px] overflow-hidden p-0 sm:w-96">
					<AppShellProfileMenu {...props} />
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
