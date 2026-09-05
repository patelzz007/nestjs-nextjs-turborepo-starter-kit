import "server-only";

import { sidebarMenuDataToCapabilityMenuResponse } from "@/lib/navigation/sidebar-menu-to-capability-response";
import { USER_SIDEBAR_MENU_DATA } from "@/lib/navigation/sidebar-menu";
import { createWebServerCaller } from "@/lib/web-server-api";
import { CapabilityMenuResponseSchema, SessionPermissionsResponseSchema, type CapabilityMenuResponse, type SessionPermissionsResponse } from "@workspace/shared";

const STATIC_NAVIGATION_MENU: CapabilityMenuResponse = sidebarMenuDataToCapabilityMenuResponse(USER_SIDEBAR_MENU_DATA);

function hasNavigationSections(menu: CapabilityMenuResponse): boolean {
	return menu.sections.some((section) => section.items.length > 0);
}

/** SSR navigation menu — API `PLATFORM` scope when signed in, static JSON fallback otherwise. */
export async function loadWebInitialNavigationMenu(sessionActive: boolean): Promise<CapabilityMenuResponse> {
	if (!sessionActive) {
		return STATIC_NAVIGATION_MENU;
	}

	try {
		const server = createWebServerCaller();
		const response = await server.navigation.menu.query({ scope: "PLATFORM" });
		const parsed = CapabilityMenuResponseSchema.safeParse(response.data);
		if (parsed.success && hasNavigationSections(parsed.data)) {
			return parsed.data;
		}
	} catch {
		return STATIC_NAVIGATION_MENU;
	}

	return STATIC_NAVIGATION_MENU;
}

/** SSR session capabilities from `GET /auth/permissions` for first-paint sidebar filtering. */
export async function loadWebInitialSessionPermissions(sessionActive: boolean): Promise<SessionPermissionsResponse | undefined> {
	if (!sessionActive) {
		return undefined;
	}

	try {
		const server = createWebServerCaller();
		const response = await server.auth.permissions.query(undefined);
		const parsed = SessionPermissionsResponseSchema.safeParse(response.data);
		if (parsed.success) {
			return parsed.data;
		}
	} catch {
		return undefined;
	}

	return undefined;
}
