"use client";

import { MerchantLocationSwitcher, MerchantLocationSwitcherMobile } from "@/components/layout/merchant-location-switcher";
import { MerchantNotificationsDropdown } from "@/components/layout/merchant-notifications-dropdown";
import { MerchantShellBreadcrumb } from "@/components/layout/merchant-shell-breadcrumb";
import { AppShellHeader } from "@workspace/ui/components/app-shell-header";
import { useCommandPaletteShortcut } from "@workspace/ui/components/app-shell-topbar";
import dynamic from "next/dynamic";
import * as React from "react";

const CommandPalette = dynamic(() => import("@/components/layout/merchant-command-palette").then((module) => module.MerchantCommandPalette), { ssr: false });

/**
 * The merchant portal's page header (the shared `AppShellHeader`, app shell
 * 3): the breadcrumb trail, the store switcher and notifications (the page's
 * context), and search (⌘K). Theme, settings and the profile menu live in the
 * sidebar's account row.
 */
export function MerchantTopbar(): React.JSX.Element {
	const [commandOpen, setCommandOpen] = React.useState<boolean>(false);

	const handleOpenCommand = React.useCallback((): void => {
		setCommandOpen(true);
	}, []);

	useCommandPaletteShortcut(commandOpen, handleOpenCommand);

	return (
		<>
			{commandOpen ? <CommandPalette open setOpen={setCommandOpen} /> : null}
			<AppShellHeader
				breadcrumb={<MerchantShellBreadcrumb />}
				onOpenSearch={handleOpenCommand}
				actions={
					<>
						<MerchantLocationSwitcher />
						<MerchantLocationSwitcherMobile />
						<MerchantNotificationsDropdown />
					</>
				}
			/>
		</>
	);
}
