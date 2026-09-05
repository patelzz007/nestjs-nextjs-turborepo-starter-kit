import { hasCapability, type CapabilitySlug } from "@workspace/shared";

import type { CompiledSidebarMenuData, CompiledSidebarMenuItem, SidebarMenuData, SidebarMenuItem } from "../sidebar/sidebar-menu-schema";

interface CapabilityGatedMenuItem {
	readonly requiredCapability?: CapabilitySlug;
	readonly requiredCapabilities?: readonly CapabilitySlug[];
	readonly children?: readonly CapabilityGatedMenuItem[];
}

function resolveRequiredCapabilities(item: CapabilityGatedMenuItem): readonly CapabilitySlug[] | undefined {
	if (item.requiredCapabilities !== undefined && item.requiredCapabilities.length > 0) {
		return item.requiredCapabilities;
	}
	if (item.requiredCapability !== undefined) {
		return [item.requiredCapability];
	}
	return undefined;
}

function isMenuItemVisible(item: CapabilityGatedMenuItem, capabilities: readonly CapabilitySlug[]): boolean {
	const requiredCapabilities = resolveRequiredCapabilities(item);
	if (requiredCapabilities !== undefined) {
		return requiredCapabilities.some((slug) => hasCapability(capabilities, slug));
	}
	return true;
}

function filterRawMenuItems(items: readonly SidebarMenuItem[], capabilities: readonly CapabilitySlug[]): readonly SidebarMenuItem[] {
	const filtered: SidebarMenuItem[] = [];
	for (const item of items) {
		if (!isMenuItemVisible(item, capabilities)) {
			continue;
		}
		const children = item.children !== undefined ? filterRawMenuItems(item.children, capabilities) : undefined;
		const requiredCapabilities = resolveRequiredCapabilities(item);
		filtered.push({
			title: item.title,
			url: item.url,
			icon: item.icon,
			disabled: item.disabled,
			requiredCapabilities,
			children,
		});
	}
	return filtered;
}

function filterCompiledMenuItems(items: readonly CompiledSidebarMenuItem[], capabilities: readonly CapabilitySlug[]): readonly CompiledSidebarMenuItem[] {
	const filtered: CompiledSidebarMenuItem[] = [];
	for (const item of items) {
		if (!isMenuItemVisible(item, capabilities)) {
			continue;
		}
		const children = item.children !== undefined ? filterCompiledMenuItems(item.children, capabilities) : undefined;
		const requiredCapabilities = resolveRequiredCapabilities(item);
		filtered.push({
			id: item.id,
			title: item.title,
			url: item.url,
			icon: item.icon,
			disabled: item.disabled,
			requiredCapabilities,
			children,
		});
	}
	return filtered;
}

/** Filters raw sidebar menu JSON by granted capability slugs. */
export function filterSidebarMenuData(menu: SidebarMenuData, capabilities: readonly CapabilitySlug[]): SidebarMenuData {
	const sections: SidebarMenuData["sections"] = [];
	for (const section of menu.sections) {
		const items = filterRawMenuItems(section.items, capabilities);
		if (items.length === 0) {
			continue;
		}
		sections.push({
			title: section.title,
			color: section.color,
			items: [...items],
		});
	}

	return {
		header: menu.header,
		sections,
		bottomItems: [...filterRawMenuItems(menu.bottomItems, capabilities)],
	};
}

/** Filters a compiled sidebar menu snapshot by capability slugs. */
export function filterCompiledSidebarMenu(menu: CompiledSidebarMenuData, capabilities: readonly CapabilitySlug[]): CompiledSidebarMenuData {
	const sections: CompiledSidebarMenuData["sections"] = [];
	for (const section of menu.sections) {
		const items = filterCompiledMenuItems(section.items, capabilities);
		if (items.length === 0) {
			continue;
		}
		sections.push({
			title: section.title,
			color: section.color,
			items: [...items],
		});
	}

	return {
		header: menu.header,
		sections,
		bottomItems: [...filterCompiledMenuItems(menu.bottomItems, capabilities)],
	};
}
