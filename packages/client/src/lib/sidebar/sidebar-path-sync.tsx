"use client";

import { usePathname } from "next/navigation";
import * as React from "react";

import type { SidebarState } from "./sidebar-store";

interface SidebarStoreApi {
	getState: () => SidebarState;
}

export interface SidebarPathSyncProps {
	readonly store: SidebarStoreApi;
}

/** Keeps `currentPage` / `previousPage` in the sidebar store aligned with the router. */
export function SidebarPathSync({ store }: SidebarPathSyncProps): null {
	const pathname = usePathname();

	React.useEffect((): void => {
		store.getState().setCurrentPage(pathname);
	}, [pathname, store]);

	return null;
}
