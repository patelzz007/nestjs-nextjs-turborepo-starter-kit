"use client";

import { MerchantLocationSwitcher, MerchantLocationSwitcherMobile } from "@/components/layout/merchant-location-switcher";
import { MerchantNotificationsDropdown } from "@/components/layout/merchant-notifications-dropdown";
import type { ServerUser } from "@/lib/auth/server";
import { useOrganizationPath } from "@/lib/org/use-organization-path";
import { ORG_ROUTES } from "@/lib/routes";
import { useMerchantSessionProfile } from "@/lib/session/profile";
import { useMerchantLogout } from "@/lib/session/use-merchant-logout";
import { MERCHANT_SIDEBAR_MENU } from "@/lib/navigation/sidebar-menu";
import { useSidebarIsOpen } from "@workspace/client/lib/features/sidebar/facade";
import { useAuth, isRestrictedAuthUser } from "@workspace/client/lib/auth";
import { useAuthorization } from "@workspace/client/lib/auth/can";
import { MERCHANT_CAPABILITY } from "@workspace/shared";
import { AppShellProfileDropdown } from "@workspace/ui/components/navigation/app-shell-profile-dropdown";
import { AppShellTopbar, useCommandPaletteShortcut } from "@workspace/ui/components/navigation/app-shell-topbar";
import { ShellThemeToggle } from "@workspace/ui/components/navigation/shell-theme-toggle";
import { Button } from "@workspace/ui/components/form/button";
import { CircleUser, Gift, KeyRound, LayoutDashboard, Settings } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

const CommandPalette = dynamic(() => import("@/components/layout/merchant-command-palette").then((module) => module.MerchantCommandPalette), { ssr: false });

export interface MerchantTopbarProps {
	readonly initialUser?: ServerUser | null;
}

export function MerchantTopbar({ initialUser = null }: MerchantTopbarProps): React.JSX.Element {
	const { user } = useAuth();
	const logout = useMerchantLogout();
	const isEnrollmentLocked = isRestrictedAuthUser(user);
	const sessionProfile = useMerchantSessionProfile();
	const { can } = useAuthorization();
	const router = useRouter();
	const settingsPath = useOrganizationPath(ORG_ROUTES.settings.index);
	const accountPath = useOrganizationPath(ORG_ROUTES.account);
	const dashboardPath = useOrganizationPath(ORG_ROUTES.dashboard);
	const apiKeysPath = useOrganizationPath(ORG_ROUTES.apiKeys);
	const sidebarOpen = useSidebarIsOpen();
	const menuTitle = MERCHANT_SIDEBAR_MENU.header.title;
	const [commandOpen, setCommandOpen] = React.useState<boolean>(false);

	const handleOpenCommand = React.useCallback((): void => {
		setCommandOpen(true);
	}, []);

	useCommandPaletteShortcut(commandOpen, handleOpenCommand);

	const handleLogout = React.useCallback((): void => {
		void logout();
	}, [logout]);

	const profileMenuItems = React.useMemo((): readonly { label: string; icon: React.ReactNode; onClick: () => void }[] => {
		const accountItem = {
			label: "Account",
			icon: <CircleUser className="size-4" aria-hidden="true" />,
			onClick: (): void => {
				router.push(accountPath);
			},
		};

		// The personal account is where enrollment is completed — it stays reachable while locked.
		if (isEnrollmentLocked) {
			return [accountItem];
		}

		const items: { label: string; icon: React.ReactNode; onClick: () => void }[] = [accountItem];

		if (can(MERCHANT_CAPABILITY.viewDashboard)) {
			items.push({
				label: "Dashboard",
				icon: <LayoutDashboard className="size-4" aria-hidden="true" />,
				onClick: (): void => {
					router.push(dashboardPath);
				},
			});
		}

		if (can(MERCHANT_CAPABILITY.manageApiKeys)) {
			items.push({
				label: "API keys",
				icon: <KeyRound className="size-4" aria-hidden="true" />,
				onClick: (): void => {
					router.push(apiKeysPath);
				},
			});
		}

		return items;
	}, [accountPath, apiKeysPath, can, dashboardPath, isEnrollmentLocked, router]);

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
				<div className="mx-1 flex items-center gap-2 md:mx-2">
					<MerchantLocationSwitcher />
					<MerchantLocationSwitcherMobile />
					<MerchantNotificationsDropdown />
				</div>

				<div className="mx-1 md:mx-2">
					<ShellThemeToggle />
				</div>

				{isEnrollmentLocked ? null : (
					<div className="mx-1 hidden sm:mx-2 sm:block">
						<Link href={settingsPath} aria-label="Organization settings">
							<Button variant="ghost" size="icon" className="rounded-full">
								<Settings className="size-5 text-muted-foreground" />
							</Button>
						</Link>
					</div>
				)}

				{profileEmail.length > 0 ? (
					<div className="ml-1 md:ml-3">
						<AppShellProfileDropdown name={profileName} email={profileEmail} menuItems={profileMenuItems} onLogout={handleLogout} />
					</div>
				) : null}
			</AppShellTopbar>
		</>
	);
}
