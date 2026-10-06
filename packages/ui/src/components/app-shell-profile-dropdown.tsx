"use client";

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { getUserInitials } from "@workspace/ui/lib/core/user-initials";
import { cn } from "@workspace/ui/lib/core/utils";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import type { AppShellProfileDropdownLabels } from "@workspace/ui/lib/shell/labels";
import { LogOut, MoveUpRight } from "lucide-react";
import * as React from "react";

export type { AppShellProfileDropdownLabels };

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
	/** Controlled open state of the menu; omit for an uncontrolled menu. */
	readonly open?: boolean;
	readonly onOpenChange?: (open: boolean) => void;
	/** Per-usage overrides of the `appShellProfileDropdown` family's copy (trigger name, logout). */
	readonly labels?: UiKitLabelsOverride<"appShellProfileDropdown">;
	readonly className?: string;
}

/** Gap (px) between the avatar trigger and the menu panel. */
const PROFILE_MENU_SIDE_OFFSET = 8;

const NO_MENU_ITEMS: readonly AppShellProfileMenuItem[] = [];

/** The trigger is a round ghost icon button — hoisted so its element identity is stable. */
const PROFILE_TRIGGER_RENDER = <Button variant="ghost" size="icon" className="rounded-full" />;

interface AppShellProfileMenuProps {
	readonly name: string;
	readonly email?: string | null | undefined;
	readonly menuItems: readonly AppShellProfileMenuItem[];
	readonly onLogout: () => void;
	readonly logoutLabel: string;
}

function AppShellProfileMenu({ name, email, menuItems, onLogout, logoutLabel }: AppShellProfileMenuProps): React.JSX.Element {
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
						<div className="relative size-14 rounded-full ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
							<Avatar className="size-full">
								<AvatarFallback className="rounded-full text-base font-semibold">{initials}</AvatarFallback>
							</Avatar>
							<div className="absolute -right-0.5 -bottom-0.5 size-4 rounded-full bg-success shadow-sm ring-2 ring-background" />
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
									{item.external ? <MoveUpRight className="size-3.5 text-muted-foreground transition-colors group-hover:text-foreground" /> : null}
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
					<span className="text-sm font-medium text-foreground transition-colors group-hover:text-destructive">{logoutLabel}</span>
				</Button>
			</div>
		</div>
	);
}

/** Avatar trigger that opens the shared profile dropdown panel. The ref reaches the wrapper `<div>`. */
export const AppShellProfileDropdown = React.forwardRef<HTMLDivElement, AppShellProfileDropdownProps>(function AppShellProfileDropdown(
	{ name, email, menuItems = NO_MENU_ITEMS, onLogout, open, onOpenChange, labels: labelsOverride, className },
	ref,
): React.JSX.Element {
	const labels = useUiKitLabels("appShellProfileDropdown", labelsOverride);
	const initials = getUserInitials(name);

	return (
		<div ref={ref} data-slot="app-shell-profile-dropdown" className={cn("ml-1 md:ml-3", className)}>
			<DropdownMenu open={open} onOpenChange={onOpenChange}>
				<DropdownMenuTrigger render={PROFILE_TRIGGER_RENDER} aria-label={labels.openMenuAriaLabel}>
					<Avatar className="size-8">
						<AvatarFallback className="rounded-full text-xs">{initials}</AvatarFallback>
					</Avatar>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" sideOffset={PROFILE_MENU_SIDE_OFFSET} className="w-80 overflow-hidden p-0 sm:w-96">
					<AppShellProfileMenu name={name} email={email} menuItems={menuItems} onLogout={onLogout} logoutLabel={labels.logout} />
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
});
