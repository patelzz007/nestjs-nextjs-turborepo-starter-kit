import { filterMerchantNavItems, MERCHANT_NAV_ITEMS, type MerchantNavItem } from "@/lib/navigation/nav-items";
import type { MerchantCapability } from "@workspace/shared";
import type { PaletteSearchableItem } from "@workspace/ui/lib/palette-types";
import type { LucideIcon } from "lucide-react";
import * as React from "react";

function toPaletteItem(item: MerchantNavItem): PaletteSearchableItem {
	return {
		id: item.id,
		title: item.title,
		url: item.url,
		section: item.section,
		breadcrumb: [item.section, item.title],
		icon: item.id,
	};
}

export function buildMerchantPaletteItems(capabilities: readonly MerchantCapability[]): readonly PaletteSearchableItem[] {
	return filterMerchantNavItems(MERCHANT_NAV_ITEMS, capabilities).map(toPaletteItem);
}

const iconById = new Map<string, LucideIcon>(MERCHANT_NAV_ITEMS.map((item) => [item.id, item.icon]));

export function renderMerchantPaletteIcon(iconKey: string | undefined, className: string): React.ReactNode {
	if (iconKey === undefined) {
		return null;
	}
	const Icon = iconById.get(iconKey);
	if (Icon === undefined) {
		return null;
	}
	return <Icon className={className} aria-hidden="true" />;
}
