"use client";

import { useMerchantSidebarStore } from "@/stores/sidebar-store";

/**
 * Returns the merchant sidebar store slice used by the shell layout.
 * Keyboard shortcut (Ctrl/Cmd+B) is handled by the shared `SidebarProvider`.
 */
export function useMerchantSidebarControl(): {
	readonly isOpen: boolean;
	readonly toggle: () => void;
	readonly open: () => void;
	readonly close: () => void;
} {
	const isOpen = useMerchantSidebarStore((state) => state.isOpen);
	const toggle = useMerchantSidebarStore((state) => state.toggle);
	const open = useMerchantSidebarStore((state) => state.open);
	const close = useMerchantSidebarStore((state) => state.close);

	return { isOpen, toggle, open, close };
}
