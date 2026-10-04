"use client";

import { useMerchantLocation } from "@/features/tenant-context/facade";
import { MerchantSurfacePanel } from "@/components/merchant-ui/surface-panel";
import { MapPin } from "lucide-react";
import * as React from "react";

export interface MerchantLocationScopeBannerProps {
	/** What the store filter means on THIS page, shown after "Filtered to <store>." (each page scopes different data). */
	readonly filteredNote: string;
	/** What "All locations" means on this page — shown only to members offered that option. */
	readonly allStoresNote: string;
}

/** States which store a page's data is scoped to, in the page's own words. */
export function MerchantLocationScopeBanner({ filteredNote, allStoresNote }: MerchantLocationScopeBannerProps): React.JSX.Element | null {
	const { locationId, activeLocation, canSelectAllLocations } = useMerchantLocation();

	if (locationId === undefined || activeLocation === undefined) {
		return canSelectAllLocations ? (
			<MerchantSurfacePanel className="flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground">
				<MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
				<span>{allStoresNote}</span>
			</MerchantSurfacePanel>
		) : null;
	}

	return (
		<MerchantSurfacePanel className="flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground">
			<MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
			<span>
				Filtered to <strong className="font-medium text-foreground">{activeLocation.name}</strong>. {filteredNote}
			</span>
		</MerchantSurfacePanel>
	);
}
