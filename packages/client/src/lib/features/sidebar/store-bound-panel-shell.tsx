"use client";

import { AppPanelShell, type AppPanelShellProps } from "@workspace/ui/components/app-panel-shell";
import * as React from "react";

import { useSidebarCommands, useSidebarIsOpen } from "./facade";

export type StoreBoundAppPanelShellProps = Omit<AppPanelShellProps, "sidebarOpen" | "onSidebarOpenChange">;

/**
 * The app panel shell, its sidebar open / collapsed state read from and
 * written to the sidebar store (`SidebarStoreProvider` — persisted per app,
 * shared with ⌘B and the toggles). Admin, web and merchant render this, not
 * `AppPanelShell` with the store wired by hand.
 *
 * It is the only component that re-renders when the sidebar toggles: the
 * layout above it never subscribes to the open state, so the sidebar, header
 * and page elements it built keep their identity and React skips them — the
 * spring starts on the very next frame instead of after a whole-shell render.
 */
export function StoreBoundAppPanelShell(props: StoreBoundAppPanelShellProps): React.JSX.Element {
	const isOpen = useSidebarIsOpen();
	const { open, close } = useSidebarCommands();
	const handleOpenChange = React.useCallback(
		(nextOpen: boolean): void => {
			if (nextOpen) {
				open();
			} else {
				close();
			}
		},
		[close, open],
	);
	return <AppPanelShell {...props} sidebarOpen={isOpen} onSidebarOpenChange={handleOpenChange} />;
}
