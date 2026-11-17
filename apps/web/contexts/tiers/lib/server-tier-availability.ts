import "server-only";

import type { TierAvailability } from "@workspace/shared";

import { createWebServerCaller } from "@/lib/web-server-api";

/**
 * Whether tiers are on and the viewer's tier, read before a catalog page is prefetched (the catalog's request depends
 * on it, ADR 085). A failed read renders the page as with tiers off — claimable rewards only, nothing marked — which
 * the API's own tier filter keeps correct; the failure is logged, never hidden.
 */
export async function readTierAvailability(): Promise<TierAvailability | undefined> {
	const [result] = await Promise.allSettled([createWebServerCaller().tiers.availability.query(undefined)]);
	if (result.status === "fulfilled") {
		return result.value.data;
	}
	console.error("tiers.availability could not be read; the page renders without locked rewards.", result.reason);
	return undefined;
}
