"use client";

import { useAuth } from "../identity";

/** How long whether tiers are on is reused before it is read again: the flag changes rarely. */
export const TIERS_AVAILABILITY_STALE_TIME_MS = 60_000;

/**
 * Whether customer tiers are on (`GET /tiers/availability`, the `customer-tiers` flag, ADR 085). `false` until it is
 * known: a screen shows tiers only once they are confirmed on, never a tier that may be hidden a moment later.
 */
export function useTiersEnabled(): boolean {
	const { api } = useAuth();
	const availability = api.tiers.availability.useQuery(undefined, { staleTime: TIERS_AVAILABILITY_STALE_TIME_MS });
	return availability.data?.data.enabled === true;
}
