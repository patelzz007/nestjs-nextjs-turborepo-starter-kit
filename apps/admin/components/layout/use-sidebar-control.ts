"use client";

import * as React from "react";

import { useSidebar, type SidebarState } from "@/stores/sidebar-store";

/**
 * Returns the sidebar store and wires up the global keyboard shortcut
 * (Ctrl/Cmd + B) to toggle the sidebar — exactly the pattern from the
 * reference implementation.
 */
export function useSidebarControl(): SidebarState {
	const sidebar = useSidebar();

	React.useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent): void => {
			if ((event.ctrlKey || event.metaKey) && event.key === "b") {
				event.preventDefault();
				sidebar.toggle();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return (): void => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [sidebar]);

	return sidebar;
}
