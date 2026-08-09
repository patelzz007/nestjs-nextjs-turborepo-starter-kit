"use client";

import { Avatar, AvatarFallback } from "@workspace/ui/components/display/avatar";
import { Button } from "@workspace/ui/components/form/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@workspace/ui/components/overlay/dropdown-menu";
import { Leaf, Menu, Search, Settings } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import * as React from "react";

import { NetworkStatusIndicator } from "@/components/common/network-status-bar";
import { NotificationsDropdown } from "@/components/notifications/notifications-dropdown";
import { SessionStatusBadge } from "@/components/common/session-status-badge";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { Profile01 } from "@/components/settings/profile-01";
import { SIDEBAR_MENU } from "@/lib/navigation/sidebar-menu";
import { getInitials } from "@/lib/user-initials";
import { useSidebar } from "@/stores/sidebar-store";
import type { SidebarUser } from "@/lib/navigation/sidebar";

// The command palette pulls in `cmdk` + the palette search index — code-split
// it so neither ships in the initial bundle. It only mounts once the user
// opens it (⌘K or the search button); the shortcut listener lives here.
const CommandPalette = dynamic(() => import("@/components/layout/command-palette").then((m) => m.CommandPalette), { ssr: false });

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
	const { toggle } = useSidebar();
	const [commandOpen, setCommandOpen] = React.useState(false);

	const handleOpenMobileMenu = React.useCallback((): void => {
		setIsMobileMenuOpen(true);
	}, [setIsMobileMenuOpen]);

	const handleOpenCommand = React.useCallback((): void => {
		setCommandOpen(true);
	}, []);

	// ⌘K / Ctrl+K shortcut. Lives here (not inside the palette) because the
	// palette is now only mounted while open — the shortcut must work before
	// its first open. Once mounted, the palette registers its own handler
	// (toggle-close), so this one skips while `commandOpen` is true to avoid a
	// double toggle on the same keypress.
	React.useEffect(() => {
		const handleShortcut = (event: KeyboardEvent): void => {
			if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
				event.preventDefault();
				if (!commandOpen) {
					setCommandOpen(true);
				}
			}
		};

		document.addEventListener("keydown", handleShortcut);
		return (): void => {
			document.removeEventListener("keydown", handleShortcut);
		};
	}, [commandOpen]);

	return (
		<>
			{/* The palette only mounts on demand — cmdk stays out of the initial
			    bundle and out of the DOM until the user opens it. */}
			{commandOpen ? <CommandPalette open setOpen={setCommandOpen} /> : null}
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

					{/* Brand — ALWAYS rendered (no JS media-query flash on reload). Its
					    visibility is pure CSS and MOBILE-ONLY: shown below `lg` where
					    the sidebar is a mobile drawer, always hidden at `lg` and up
					    (the desktop sidebar header already shows the app title, and
					    re-showing it while collapsed reads as a stray mobile icon).
					    See the `.topbar-brand` rule in globals.css. */}
					<div className="topbar-brand flex items-center">
						<div className="mr-2 flex h-7 w-7 items-center justify-center rounded-full bg-green-500">
							<Leaf className="size-4 text-white" />
						</div>
						<span className="text-lg font-semibold text-foreground">{SIDEBAR_MENU.header.title}</span>
					</div>
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

					{/* Session status — compact pill: live token-expiry countdown computed
					    locally from the JWT exp claim (GET /session once on mount). The
					    topbar lives in the persistent (panel) shell, so the badge mounts
					    ONCE for the whole session — no refetch on page navigation. Hidden
					    below `lg` to keep the small-screen topbar uncluttered. */}
					<div className="mx-1 hidden lg:block">
						<SessionStatusBadge compact />
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
