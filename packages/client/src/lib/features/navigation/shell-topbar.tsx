"use client";

import type { BreadcrumbStatus } from "@workspace/ui/components/breadcrumb-context";
import { AppShellHeader } from "@workspace/ui/components/app-shell-header";
import { useCommandPaletteShortcut } from "@workspace/ui/components/app-shell-topbar";
import { useCallback, useState, type ComponentType, type JSX, type ReactNode } from "react";

import { NotificationsDropdown } from "../notifications/notifications-dropdown";
import { ShellBreadcrumb } from "./shell-breadcrumb";

/** What an app's command palette receives: it is mounted only while open. */
export interface CommandPaletteProps {
	readonly open: boolean;
	readonly setOpen: (open: boolean) => void;
}

export interface ShellTopbarProps {
	/** The app's breadcrumb context status (`useBreadcrumb().status` of its provider). */
	readonly breadcrumbStatus: BreadcrumbStatus;
	/** The app's own command palette (its search entries are app-specific); usually a client-only chunk. */
	readonly commandPalette: ComponentType<CommandPaletteProps>;
	/** Extra header actions, placed before the notification bell. */
	readonly actions?: ReactNode;
}

/**
 * Every app shell's page header (the shared `AppShellHeader`): the breadcrumb trail, the notification bell
 * and search (⌘K). The command palette is mounted only while it is open, so its chunk is fetched on first use.
 */
export function ShellTopbar({ breadcrumbStatus, commandPalette: CommandPalette, actions }: ShellTopbarProps): JSX.Element {
	const [commandPaletteOpen, setCommandPaletteOpen] = useState<boolean>(false);

	const openCommandPalette = useCallback((): void => {
		setCommandPaletteOpen(true);
	}, []);

	useCommandPaletteShortcut(commandPaletteOpen, openCommandPalette);

	return (
		<>
			{commandPaletteOpen ? <CommandPalette open setOpen={setCommandPaletteOpen} /> : null}
			<AppShellHeader
				breadcrumb={<ShellBreadcrumb status={breadcrumbStatus} />}
				onOpenSearch={openCommandPalette}
				actions={
					<>
						{actions}
						<NotificationsDropdown />
					</>
				}
			/>
		</>
	);
}
