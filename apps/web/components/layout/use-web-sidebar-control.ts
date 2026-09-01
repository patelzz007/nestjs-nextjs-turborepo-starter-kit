"use client";

import { useWebSidebarStore } from "@/stores/sidebar-store";

export function useWebSidebarControl(): {
	readonly isOpen: boolean;
	readonly toggle: () => void;
	readonly open: () => void;
	readonly close: () => void;
} {
	const isOpen = useWebSidebarStore((state) => state.isOpen);
	const toggle = useWebSidebarStore((state) => state.toggle);
	const open = useWebSidebarStore((state) => state.open);
	const close = useWebSidebarStore((state) => state.close);

	return { isOpen, toggle, open, close };
}
