"use client";

import { FeatureFlagsProvider } from "@workspace/client/lib/contexts/feature-flags";
import type { FeatureFlagBundle } from "@workspace/shared";
import * as React from "react";

import { useActiveLocationFilter, useActiveTenantId } from "@/features/tenant-context/facade";

export interface MerchantFeatureFlagsProps {
	/** The bundle the server rendered with, for the same store: nothing flagged flickers on load. */
	readonly initialBundle: FeatureFlagBundle | null;
	readonly children: React.ReactNode;
}

/** The merchant console's feature flags (ADR 087), for the active tenant and the store in effect. Mount inside the tenant context. */
export function MerchantFeatureFlags({ initialBundle, children }: MerchantFeatureFlagsProps): React.JSX.Element {
	const tenantId = useActiveTenantId();
	const { locationId } = useActiveLocationFilter();
	return (
		<FeatureFlagsProvider app="merchant" tenantId={tenantId} locationId={locationId} initialBundle={initialBundle}>
			{children}
		</FeatureFlagsProvider>
	);
}
