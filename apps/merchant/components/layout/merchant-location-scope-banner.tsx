"use client";

import { useMerchantLocation } from "@/lib/org/location-context";
import { MerchantSurfacePanel } from "@/components/merchant-ui/surface-panel";
import { MapPin } from "lucide-react";
import * as React from "react";

export function MerchantLocationScopeBanner(): React.JSX.Element | null {
	const { locationId, activeLocation, canSelectAllLocations } = useMerchantLocation();

	if (locationId === undefined || activeLocation === undefined) {
		return canSelectAllLocations ? (
			<MerchantSurfacePanel className="flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground">
				<MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
				<span>Showing combined metrics for all accessible store locations.</span>
			</MerchantSurfacePanel>
		) : null;
	}

	return (
		<MerchantSurfacePanel className="flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground">
			<MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
			<span>
				Filtered to <strong className="font-medium text-foreground">{activeLocation.name}</strong>. Redemptions and redemption trends are store-specific; reward counts remain
				organization-wide.
			</span>
		</MerchantSurfacePanel>
	);
}
