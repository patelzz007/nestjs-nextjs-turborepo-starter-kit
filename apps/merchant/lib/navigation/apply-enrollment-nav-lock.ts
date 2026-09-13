import { isMerchantEnrollmentAllowedPath } from "@/lib/auth/enrollment";
import type { CompiledSidebarMenuData, CompiledSidebarMenuItem } from "@workspace/client/lib/sidebar/sidebar-menu-schema";

function lockMenuItem(item: CompiledSidebarMenuItem, isLocked: boolean): CompiledSidebarMenuItem {
	const isAllowed = isMerchantEnrollmentAllowedPath(item.url);
	const children = item.children?.map((child) => lockMenuItem(child, isLocked));

	if (!isLocked) {
		return children === undefined ? item : { ...item, children };
	}

	if (isAllowed) {
		return {
			...item,
			disabled: false,
			children,
		};
	}

	return {
		...item,
		disabled: true,
		children,
	};
}

/** Disable sidebar navigation while email verification is still pending. */
export function applyEnrollmentNavLock(menu: CompiledSidebarMenuData, isLocked: boolean): CompiledSidebarMenuData {
	if (!isLocked) {
		return menu;
	}

	return {
		...menu,
		sections: menu.sections.map((section) => ({
			...section,
			items: section.items.map((item) => lockMenuItem(item, isLocked)),
		})),
		bottomItems: menu.bottomItems.map((item) => lockMenuItem(item, isLocked)),
	};
}
