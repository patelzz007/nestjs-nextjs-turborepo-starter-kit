"use client";

import { MerchantNotificationsDropdown } from "@/components/layout/merchant-notifications-dropdown";
import type { ServerUser } from "@/lib/auth-server";
import { useMerchantCapabilities } from "@/lib/merchant-capabilities";
import { useMerchantSessionProfile } from "@/lib/merchant-session-profile";
import { useMerchantSidebarControl } from "@/components/layout/use-merchant-sidebar-control";
import { useMerchantSidebarStore } from "@/stores/sidebar-store";
import { useAuth } from "@workspace/client/lib/auth";
import { AppShellProfileDropdown } from "@workspace/ui/components/navigation/app-shell-profile-dropdown";
import { AppShellTopbar, useCommandPaletteShortcut } from "@workspace/ui/components/navigation/app-shell-topbar";
import { ShellThemeToggle } from "@workspace/ui/components/navigation/shell-theme-toggle";
import { Button } from "@workspace/ui/components/form/button";
import { Gift, KeyRound, LayoutDashboard, Settings } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

const CommandPalette = dynamic(() => import("@/components/layout/merchant-command-palette").then((module) => module.MerchantCommandPalette), { ssr: false });

export interface MerchantTopbarProps {
	readonly initialUser?: ServerUser | null;
}

export function MerchantTopbar({ initialUser = null }: MerchantTopbarProps): React.JSX.Element {
	const { logout } = useAuth();
	const sessionProfile = useMerchantSessionProfile();
	const { hasCapability } = useMerchantCapabilities();
	const router = useRouter();
	const { isOpen: sidebarOpen } = useMerchantSidebarControl();
	const menuTitle = useMerchantSidebarStore((state) => state.menu.header.title);
	const [commandOpen, setCommandOpen] = React.useState<boolean>(false);

	const handleOpenCommand = React.useCallback((): void => {
		setCommandOpen(true);
	}, []);

	useCommandPaletteShortcut(commandOpen, handleOpenCommand);

	const handleLogout = React.useCallback((): void => {
		void logout();
	}, [logout]);

	const profileMenuItems = React.useMemo((): readonly { label: string; icon: React.ReactNode; onClick: () => void }[] => {
		const items: { label: string; icon: React.ReactNode; onClick: () => void }[] = [
			{
				label: "Dashboard",
				icon: <LayoutDashboard className="size-4" aria-hidden="true" />,
				onClick: (): void => {
					router.push("/");
				},
			},
		];

		if (hasCapability("merchant:manage_api_keys")) {
			items.push({
				label: "API keys",
				icon: <KeyRound className="size-4" aria-hidden="true" />,
				onClick: (): void => {
					router.push("/api-keys");
				},
			});
		}

		return items;
	}, [hasCapability, router]);

	const profileName = sessionProfile.isLoading && initialUser !== null ? initialUser.name : sessionProfile.fullName;
	const profileEmail = sessionProfile.isLoading && initialUser !== null ? initialUser.email : sessionProfile.email;

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
					<MerchantNotificationsDropdown />
				</div>

				<div className="mx-1 md:mx-2">
					<ShellThemeToggle />
				</div>

				<div className="mx-1 hidden sm:mx-2 sm:block">
					<Link href="/settings" aria-label="Settings">
						<Button variant="ghost" size="icon" className="rounded-full">
							<Settings className="size-5 text-muted-foreground" />
						</Button>
					</Link>
				</div>

				{profileEmail.length > 0 ? (
					<div className="ml-1 md:ml-3">
						<AppShellProfileDropdown name={profileName} email={profileEmail} menuItems={profileMenuItems} onLogout={handleLogout} />
					</div>
				) : null}
			</AppShellTopbar>
		</>
	);
}
