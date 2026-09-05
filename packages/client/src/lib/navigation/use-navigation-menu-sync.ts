"use client";

import { CapabilityMenuResponseSchema, type CapabilityMenuResponse, type CapabilityScope, type DataValue } from "@workspace/shared";
import * as React from "react";

import { useAuth } from "../auth";
import { capabilityMenuResponseToSidebarData } from "./capability-menu-mapper";
import type { SidebarMenuData } from "../sidebar/sidebar-menu-schema";

export interface NavigationMenuSyncOptions {
	readonly initialMenu?: CapabilityMenuResponse;
}

function serializeSidebarMenu(menu: SidebarMenuData): string {
	return JSON.stringify(menu);
}

type NavigationMenuSource = DataValue | CapabilityMenuResponse;

function parseNavigationMenu(raw: NavigationMenuSource | undefined): SidebarMenuData | undefined {
	if (raw === undefined) return undefined;

	const parsed = CapabilityMenuResponseSchema.safeParse(raw);
	if (!parsed.success) return undefined;

	return capabilityMenuResponseToSidebarData(parsed.data);
}

/** Applies SSR navigation menu data before the first paint. */
export function useInitialNavigationMenu(setMenu: (menuData: SidebarMenuData) => void, initialMenu: CapabilityMenuResponse | undefined): void {
	const lastAppliedRef = React.useRef<string | null>(null);

	React.useLayoutEffect((): void => {
		const nextMenu = parseNavigationMenu(initialMenu);
		if (nextMenu === undefined) return;

		const signature = serializeSidebarMenu(nextMenu);
		if (lastAppliedRef.current === signature) return;

		lastAppliedRef.current = signature;
		setMenu(nextMenu);
	}, [initialMenu, setMenu]);
}

/** Hydrates the sidebar store from `GET /navigation/menu` when the API returns data. */
export function useNavigationMenuSync(scope: CapabilityScope, setMenu: (menuData: SidebarMenuData) => void, options?: NavigationMenuSyncOptions): void {
	const { api } = useAuth();
	const lastAppliedRef = React.useRef<string | null>(null);

	const menuQuery = api.navigation.menu.useQuery({ scope }, { staleTime: 60_000 });

	React.useLayoutEffect((): void => {
		const raw = menuQuery.data?.data ?? options?.initialMenu;
		const nextMenu = parseNavigationMenu(raw);
		if (nextMenu === undefined) return;

		const signature = serializeSidebarMenu(nextMenu);
		if (lastAppliedRef.current === signature) return;

		lastAppliedRef.current = signature;
		setMenu(nextMenu);
	}, [menuQuery.data?.data, options?.initialMenu, setMenu]);
}
