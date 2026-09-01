"use client";

import { AppShellTopbar, useCommandPaletteShortcut } from "@workspace/ui/components/navigation/app-shell-topbar";
import { ShellThemeToggle } from "@workspace/ui/components/navigation/shell-theme-toggle";
import { Avatar, AvatarFallback } from "@workspace/ui/components/display/avatar";
import { Button } from "@workspace/ui/components/form/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@workspace/ui/components/overlay/dropdown-menu";
import { Leaf, Settings } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import * as React from "react";

import { NetworkStatusIndicator } from "@/components/common/network-status-bar";
import { NotificationsDropdown } from "@/components/notifications/notifications-dropdown";
import { SessionStatusBadge } from "@/components/common/session-status-badge";
import { Profile01 } from "@/components/settings/profile-01";
import { useSidebarStore } from "@/stores/sidebar-store";
import { getInitials } from "@/lib/user-initials";
import type { SidebarUser } from "@/lib/navigation/sidebar";

const CommandPalette = dynamic(() => import("@/components/layout/command-palette").then((m) => m.CommandPalette), { ssr: false });

export interface TopbarProps {
	readonly user: SidebarUser;
	readonly onLogout: () => void;
}

/**
 * Top bar shown above the main content: sidebar toggle, brand (when collapsed),
 * command-palette search, notifications, network status, theme toggle, settings,
 * and the profile dropdown.
 */
export function Topbar({ user, onLogout }: TopbarProps): React.JSX.Element {
	const [commandOpen, setCommandOpen] = React.useState(false);
	const menuTitle = useSidebarStore((state) => state.menu.header.title);

	const handleOpenCommand = React.useCallback((): void => {
		setCommandOpen(true);
	}, []);

	useCommandPaletteShortcut(commandOpen, handleOpenCommand);

	return (
		<>
			{commandOpen ? <CommandPalette open setOpen={setCommandOpen} /> : null}
			<AppShellTopbar
				className="admin-shell-topbar h-16 shrink-0"
				brand={{
					icon: (
						<div className="mr-2 flex h-7 w-7 items-center justify-center rounded-full bg-green-500">
							<Leaf className="size-4 text-white" aria-hidden="true" />
						</div>
					),
					title: menuTitle,
				}}
				search={{
					placeholder: "Search...",
					onOpen: handleOpenCommand,
				}}>
				<div className="mx-1 md:mx-2">
					<NotificationsDropdown />
				</div>

				<div className="mx-1 hidden md:mx-2 md:block">
					<NetworkStatusIndicator />
				</div>

				<div className="mx-1 hidden lg:block">
					<SessionStatusBadge compact />
				</div>

				<div className="mx-1 md:mx-2">
					<ShellThemeToggle />
				</div>

				<div className="mx-1 hidden sm:mx-2 sm:block">
					<Link href="/settings/general" aria-label="Settings">
						<Button variant="ghost" size="icon" className="rounded-full">
							<Settings className="size-5 text-muted-foreground" />
						</Button>
					</Link>
				</div>

				<div className="ml-1 md:ml-3">
					<DropdownMenu>
						<DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="rounded-full" />} aria-label="Open profile menu">
							<Avatar className="size-8">
								<AvatarFallback className="rounded-full text-xs">{getInitials(user.name)}</AvatarFallback>
							</Avatar>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" sideOffset={8} className="w-[320px] overflow-hidden p-0 sm:w-96">
							<Profile01 user={user} onLogout={onLogout} />
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</AppShellTopbar>
		</>
	);
}
