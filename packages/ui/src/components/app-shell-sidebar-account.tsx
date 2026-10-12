"use client";

import { Button } from "@workspace/ui/components/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { AppShellProfileMenu, type AppShellProfileMenuItem } from "@workspace/ui/components/app-shell-profile-dropdown";
import { ShellThemeToggle } from "@workspace/ui/components/shell-theme-toggle";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { getUserInitials } from "@workspace/ui/lib/core/user-initials";
import { cn } from "@workspace/ui/lib/core/utils";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { ChevronsUpDown, LogOut } from "lucide-react";
import * as React from "react";

export interface AppShellSidebarAccountProps {
	readonly name: string;
	readonly email?: string | null | undefined;
	readonly onLogout: () => void;
	/** The app's profile menu items, shown in the shared profile menu (with log out). */
	readonly menuItems?: readonly AppShellProfileMenuItem[];
	/** A whole menu of the app's own instead of the shared one (it renders its own log out). */
	readonly menuContent?: React.ReactNode;
	/** Connection and session status, shown above the user row. */
	readonly status?: React.ReactNode;
	/** Per-usage overrides of the `appShellProfileDropdown` family's copy (menu trigger, log out). */
	readonly labels?: UiKitLabelsOverride<"appShellProfileDropdown">;
	readonly className?: string;
}

const NO_MENU_ITEMS: readonly AppShellProfileMenuItem[] = [];

/** The footer's small icon buttons (theme, log out): quiet until hovered. */
const FOOTER_ICON_BUTTON_CLASS = "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground [&_svg]:size-3.5";

/**
 * The signed-in account at the foot of the panel sidebar (app shell 3) —
 * admin, web and merchant: the app's status (connection, session), then the
 * user row, which opens the profile menu, with the theme toggle and log out
 * beside it. The ref reaches the wrapper `<div>`.
 */
export const AppShellSidebarAccount = React.forwardRef<HTMLDivElement, AppShellSidebarAccountProps>(function AppShellSidebarAccount(
	{ name, email, onLogout, menuItems = NO_MENU_ITEMS, menuContent, status, labels: labelsOverride, className },
	ref,
): React.JSX.Element {
	const labels = useUiKitLabels("appShellProfileDropdown", labelsOverride);
	return (
		<div ref={ref} data-slot="app-shell-sidebar-account" className={cn("flex flex-col gap-1.5", className)}>
			{status !== undefined && status !== null ? <div className="flex flex-wrap items-center gap-1.5 px-2">{status}</div> : null}
			<div className="flex items-center gap-1 px-1 py-1">
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<button
								type="button"
								className="flex min-w-0 flex-1 items-center gap-1 rounded-md p-1 text-start outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring"
							/>
						}
						aria-label={`${labels.openMenuAriaLabel}, ${name}`}>
						<AccountIdentity name={name} email={email} />
						<ChevronsUpDown className="ms-auto size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
					</DropdownMenuTrigger>
					<DropdownMenuContent side="top" align="start" sideOffset={8} className="w-[320px] overflow-hidden p-0 sm:w-80">
						{menuContent ?? <AppShellProfileMenu name={name} email={email} menuItems={menuItems} onLogout={onLogout} logoutLabel={labels.logout} />}
					</DropdownMenuContent>
				</DropdownMenu>
				<ShellThemeToggle size="icon-xs" className={FOOTER_ICON_BUTTON_CLASS} />
				<Button type="button" variant="ghost" size="icon-xs" onClick={onLogout} className={FOOTER_ICON_BUTTON_CLASS} aria-label={labels.logout} title={labels.logout}>
					<LogOut aria-hidden="true" />
				</Button>
			</div>
		</div>
	);
});

interface AccountIdentityProps {
	readonly name: string;
	readonly email?: string | null | undefined;
}

/** The signed-in person: initials, name and email, truncated with the full text as a tooltip. */
function AccountIdentity({ name, email }: AccountIdentityProps): React.JSX.Element {
	return (
		<span className="flex min-w-0 items-center gap-2.5">
			<span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-[length:var(--text-sidebar-caption)] font-bold text-sidebar-foreground ring-1 ring-sidebar-border/50">
				{getUserInitials(name)}
			</span>
			<span className="min-w-0">
				<span className="block truncate text-sm leading-tight font-medium text-sidebar-foreground" title={name}>
					{name}
				</span>
				{email !== null && email !== undefined && email.length > 0 ? (
					<span className="block truncate text-[length:var(--text-sidebar-caption)] leading-tight text-muted-foreground" title={email}>
						{email}
					</span>
				) : null}
			</span>
		</span>
	);
}
