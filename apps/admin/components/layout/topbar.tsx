"use client";

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { Leaf, Menu, Search, Settings } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { NetworkStatusIndicator } from "@/components/common/network-status-bar";
import { NotificationsDropdown } from "@/components/notifications/notifications-dropdown";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { CommandPalette } from "@/components/ui/command-palette";
import { Profile01 } from "@/components/settings/profile-01";
import { SIDEBAR_MENU } from "@/config/sidebar-menu";
import { useMediaQuery } from "@/hooks/use-media-query";
import { getInitials } from "@/lib/user-initials";
import { useSidebar } from "@/stores/sidebar-store";
import type { SidebarUser } from "@/types/sidebar";

export interface TopbarProps {
	readonly user: SidebarUser;
	readonly onLogout: () => void;
	readonly setIsMobileMenuOpen: (isOpen: boolean) => void;
}

/**
 * Top bar shown above the main content: mobile menu + sidebar toggle, brand
 * (when the sidebar is collapsed), command-palette search, notifications,
 * network status, theme toggle, settings, and the profile dropdown.
 */ export function Topbar({ user, onLogout, setIsMobileMenuOpen }: TopbarProps): React.JSX.Element {
	const { toggle, isOpen } = useSidebar();
	const [commandOpen, setCommandOpen] = React.useState(false);
	// The desktop sidebar only renders at the `lg` breakpoint (>= 1024px), so
	// the brand must show whenever we're below it — not just at the `md`
	// breakpoint that `useIsMobile` uses.
	const isBelowLg = !useMediaQuery("(min-width: 1024px)");

	const handleOpenMobileMenu = React.useCallback((): void => {
		setIsMobileMenuOpen(true);
	}, [setIsMobileMenuOpen]);

	const handleOpenCommand = React.useCallback((): void => {
		setCommandOpen(true);
	}, []);

	return (
		<>
			<CommandPalette open={commandOpen} setOpen={setCommandOpen} />
			<div className="flex h-14 w-full items-center justify-between border-b border-sidebar-border bg-background px-2 sm:px-4">
				{/* Left side */}
				<div className="flex min-w-0 items-center">
					{/* Mobile menu button */}
					<button type="button" onClick={handleOpenMobileMenu} className="mr-2 rounded-md p-2 transition-colors duration-200 hover:bg-muted lg:hidden" aria-label="Open menu">
						<Menu className="size-5 text-muted-foreground" />
					</button>

					{/* Desktop sidebar toggle */}
					<button type="button" onClick={toggle} className="mr-2 hidden rounded-md p-2 transition-colors duration-200 hover:bg-muted lg:block" aria-label="Toggle sidebar">
						<Menu className="size-5 text-muted-foreground" />
					</button>

					{/* Brand — shown when the sidebar is collapsed on desktop, or always below `lg` */}
					{!isOpen || isBelowLg ? (
						<div className="flex items-center">
							<div className="mr-2 flex h-7 w-7 items-center justify-center rounded-full bg-green-500">
								<Leaf className="size-4 text-white" />
							</div>
							<span className="text-lg font-semibold text-foreground">{SIDEBAR_MENU.header.title}</span>
						</div>
					) : null}
				</div>

				{/* Right side */}
				<div className="flex items-center">
					{/* Search */}
					<div className="relative mr-1 md:mr-2">
						<button type="button" onClick={handleOpenCommand} className="rounded-full p-2 transition-colors hover:bg-muted md:hidden" aria-label="Search">
							<Search className="size-5 text-muted-foreground" />
						</button>
						<button
							type="button"
							onClick={handleOpenCommand}
							className="hidden h-9 w-56 items-center gap-2 rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted md:flex lg:w-80"
							aria-label="Search pages">
							<Search className="size-4 shrink-0" />
							<span className="truncate">Search...</span>
							<span className="ml-auto flex shrink-0 items-center gap-1">
								<kbd className="hidden h-5 items-center gap-1 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
									⌘
								</kbd>
								<kbd className="hidden h-5 items-center gap-1 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
									K
								</kbd>
							</span>
						</button>
					</div>

					{/* Notifications */}
					<div className="mx-1 md:mx-2">
						<NotificationsDropdown />
					</div>

					{/* Network status */}
					<div className="mx-1 hidden md:mx-2 md:block">
						<NetworkStatusIndicator />
					</div>

					{/* Theme toggle */}
					<div className="mx-1 md:mx-2">
						<ThemeToggle />
					</div>

					{/* Settings */}
					<div className="mx-1 hidden sm:mx-2 sm:block">
						<Link href="/settings/general" aria-label="Settings">
							<Button variant="ghost" size="icon" className="rounded-full">
								<Settings className="size-5 text-muted-foreground" />
							</Button>
						</Link>
					</div>

					{/* Profile */}
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
				</div>
			</div>
		</>
	);
}
