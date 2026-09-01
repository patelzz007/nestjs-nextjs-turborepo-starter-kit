"use client";

import { WebNotificationsDropdown } from "@/components/layout/web-notifications-dropdown";
import { useWebSidebarControl } from "@/components/layout/use-web-sidebar-control";
import { useWebSidebarStore } from "@/stores/sidebar-store";
import { useAuth } from "@workspace/client/lib/auth";
import { AppShellProfileDropdown } from "@workspace/ui/components/navigation/app-shell-profile-dropdown";
import { AppShellTopbar, useCommandPaletteShortcut } from "@workspace/ui/components/navigation/app-shell-topbar";
import { ShellThemeToggle } from "@workspace/ui/components/navigation/shell-theme-toggle";
import { Button } from "@workspace/ui/components/form/button";
import { Gift, Settings, Ticket } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

const CommandPalette = dynamic(() => import("@/components/layout/command-palette").then((module) => module.CommandPalette), { ssr: false });

/** Sticky topbar with sidebar toggle and command palette search. */
export function RewardHubTopbar(): React.JSX.Element {
	const { user, logout } = useAuth();
	const router = useRouter();
	const { isOpen: sidebarOpen } = useWebSidebarControl();
	const menuTitle = useWebSidebarStore((state) => state.menu.header.title);
	const [commandOpen, setCommandOpen] = React.useState<boolean>(false);

	const handleOpenCommand = React.useCallback((): void => {
		setCommandOpen(true);
	}, []);

	useCommandPaletteShortcut(commandOpen, handleOpenCommand);

	const handleLogout = React.useCallback((): void => {
		void logout();
	}, [logout]);

	const profileMenuItems = React.useMemo(
		(): readonly { label: string; icon: React.ReactNode; onClick: () => void }[] => [
			{
				label: "Browse rewards",
				icon: <Gift className="size-4" aria-hidden="true" />,
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
		],
		[router],
	);

	return (
		<>
			{commandOpen ? <CommandPalette open setOpen={setCommandOpen} /> : null}
			<AppShellTopbar
				className="panel-shell-topbar h-16 shrink-0"
				showBrandOnDesktop={!sidebarOpen}
				brand={{
					icon: (
						<div className="mr-2 flex size-8 items-center justify-center rounded-lg bg-primary">
							<Gift className="size-4 text-primary-foreground" aria-hidden="true" />
						</div>
					),
					title: menuTitle,
				}}
				search={{
					placeholder: "Search...",
					onOpen: handleOpenCommand,
				}}>
				<div className="mx-1 md:mx-2">
					<WebNotificationsDropdown />
				</div>

				<div className="mx-1 md:mx-2">
					<ShellThemeToggle />
				</div>

				<div className="mx-1 hidden sm:mx-2 sm:block">
					<Link href="/rewardhub/settings" aria-label="Settings">
						<Button variant="ghost" size="icon" className="rounded-full">
							<Settings className="size-5 text-muted-foreground" />
						</Button>
					</Link>
				</div>

				{user !== null ? (
					<div className="ml-1 md:ml-3">
						<AppShellProfileDropdown name={user.fullName} email={user.email} menuItems={profileMenuItems} onLogout={handleLogout} />
					</div>
				) : null}
			</AppShellTopbar>
		</>
	);
}
