import type { PaletteSearchableItem } from "@workspace/ui/lib/palette-types";
import type { LucideIcon } from "lucide-react";
import * as React from "react";

import { WEB_AUTH_NAV_ITEM, WEB_NAV_ITEMS, type WebNavItem } from "@/lib/navigation/nav-items";

const ALL_WEB_NAV_ITEMS: readonly WebNavItem[] = [...WEB_NAV_ITEMS, WEB_AUTH_NAV_ITEM];

export const WEB_PALETTE_ITEMS: readonly PaletteSearchableItem[] = ALL_WEB_NAV_ITEMS.map((item) => ({
	id: item.id,
	title: item.title,
	url: item.url,
	section: item.section,
	breadcrumb: [item.section, item.title],
	icon: item.id,
}));

const iconById = new Map<string, LucideIcon>(ALL_WEB_NAV_ITEMS.map((item) => [item.id, item.icon]));

export function renderWebPaletteIcon(iconKey: string | undefined, className: string): React.ReactNode {
	if (iconKey === undefined) {
		return null;
	}
	const Icon = iconById.get(iconKey);
	if (Icon === undefined) {
		return null;
	}
	return <Icon className={className} aria-hidden="true" />;
}
