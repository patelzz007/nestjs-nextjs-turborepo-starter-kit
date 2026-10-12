"use client";

import { WebNotificationsDropdown } from "@/components/layout/web-notifications-dropdown";
import { WebShellBreadcrumb } from "@/components/layout/web-shell-breadcrumb";
import { AppShellHeader } from "@workspace/ui/components/app-shell-header";
import { useCommandPaletteShortcut } from "@workspace/ui/components/app-shell-topbar";
import dynamic from "next/dynamic";
import * as React from "react";

const CommandPalette = dynamic(() => import("@/components/layout/command-palette").then((module) => module.CommandPalette), { ssr: false });

/**
 * The reward hub's page header (the shared `AppShellHeader`, app shell 3): the
 * breadcrumb trail, notifications and search (⌘K). Theme, settings and the
 * profile menu live in the sidebar's account row.
 */
export function RewardHubTopbar(): React.JSX.Element {
	const [commandOpen, setCommandOpen] = React.useState<boolean>(false);

	const handleOpenCommand = React.useCallback((): void => {
		setCommandOpen(true);
	}, []);

	useCommandPaletteShortcut(commandOpen, handleOpenCommand);

	return (
		<>
			{commandOpen ? <CommandPalette open setOpen={setCommandOpen} /> : null}
			<AppShellHeader breadcrumb={<WebShellBreadcrumb />} onOpenSearch={handleOpenCommand} actions={<WebNotificationsDropdown />} />
		</>
	);
}
