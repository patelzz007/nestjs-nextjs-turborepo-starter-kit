import type { CapabilityMenuResponse } from "@workspace/shared";

import type { CompiledSidebarMenuData, CompiledSidebarMenuItem } from "../sidebar/sidebar-menu-schema";
import { compileCapabilityMenuResponse } from "./compile-capability-menu";

function collectItemSignatures(items: readonly CompiledSidebarMenuItem[]): readonly string[] {
	const signatures: string[] = [];
	for (const item of items) {
		signatures.push(`${item.title}:${item.url}`);
		if (item.children !== undefined) {
			signatures.push(...collectItemSignatures(item.children));
		}
	}
	return signatures;
}

/** Stable structural fingerprint — ignores generated item ids. */
export function sidebarMenuStructureSignature(menu: CompiledSidebarMenuData): string {
	const parts: string[] = [menu.header.title, menu.header.subtitle];
	for (const section of menu.sections) {
		parts.push(section.title);
		parts.push(...collectItemSignatures(section.items));
	}
	parts.push(...collectItemSignatures(menu.bottomItems));
	return parts.join("\0");
}

/**
 * Uses SSR/API menu on first paint while the zustand store still holds the static
 * fallback JSON. Once the store is synced, returns the live store menu.
 */
export function resolveSidebarDisplayMenu(
	storeMenu: CompiledSidebarMenuData,
	fallbackMenu: CompiledSidebarMenuData,
	bootstrapResponse: CapabilityMenuResponse | undefined,
): CompiledSidebarMenuData {
	if (bootstrapResponse === undefined) {
		return storeMenu;
	}

	if (sidebarMenuStructureSignature(storeMenu) !== sidebarMenuStructureSignature(fallbackMenu)) {
		return storeMenu;
	}

	const bootstrapMenu = compileCapabilityMenuResponse(bootstrapResponse);
	if (bootstrapMenu === undefined) {
		return storeMenu;
	}

	return bootstrapMenu;
}
