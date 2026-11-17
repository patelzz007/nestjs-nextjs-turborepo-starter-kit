import "server-only";

import { isFlagOn, type FeatureFlagBundle, type FeatureFlagKey } from "@workspace/shared";
import { cache } from "react";

import { loadServerLocationScope } from "@/contexts/tenancy/lib/tenant/server-location-scope";
import { loadTenantServerCaller } from "@/contexts/tenancy/lib/tenant/tenant-server-caller";
import { toLocationQueryInput } from "@/features/tenant-context/selectors";

/**
 * The merchant console's feature flag bundle for this member in this store (ADR 087), asked once per request: the
 * API's evaluated values for the tenant and the branch in effect, the same ones the browser's first fetch asks for.
 * Null when the API couldn't answer (or the member isn't one of this tenant's): every flag then reads as its code
 * default, so a failed read never turns anything on.
 */
export const loadMerchantFeatureFlagBundle = cache(async (tenantSlug: string): Promise<FeatureFlagBundle | null> => {
	const scope = await loadServerLocationScope(tenantSlug);
	const tenantId = scope.tenantContext?.data.tenant.id;
	if (tenantId === undefined) {
		return null;
	}
	const server = await loadTenantServerCaller(tenantSlug);
	const [result] = await Promise.allSettled([server.featureFlags.bundle.query({ app: "merchant", tenantId, locationId: toLocationQueryInput(scope.effectiveLocationId) })]);
	if (result.status === "rejected") {
		console.error("[merchant] feature flag bundle could not be loaded; every flag reads as its default", result.reason);
		return null;
	}
	return result.value.data;
});

/** Whether one flag is on for this member in this store. */
export async function isMerchantFeatureEnabled(tenantSlug: string, key: FeatureFlagKey): Promise<boolean> {
	return isFlagOn(await loadMerchantFeatureFlagBundle(tenantSlug), key);
}
