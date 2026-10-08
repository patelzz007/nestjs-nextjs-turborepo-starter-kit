import { ApiError } from "@workspace/client/lib/api/use-api";
import { LIST_SLOT_INDEX, MerchantErrorCodes } from "@workspace/shared";
import type { QueryCache, QueryKey } from "@tanstack/react-query";
import { z } from "zod";

/**
 * Detects the API refusing a store for this member: a query of THIS
 * organization that failed with 403 `ORGANIZATION_LOCATION_FORBIDDEN`. The
 * store it asked for is read from the query's key — every org-scoped query key
 * is `["organization", orgSlug, …, input]`, and a location-scoped input carries
 * its `locationId` — and validated, never assumed.
 */

/** Key segment every organization-scoped query starts with (`apiRouter` scopes). */
const ORGANIZATION_KEY_SEGMENT = "organization";

/** An organization-scoped query key: the scope segments, then the request input object. */
const OrganizationQueryKeySchema = z.tuple([z.literal(ORGANIZATION_KEY_SEGMENT), z.string()]).rest(z.union([z.string(), z.looseObject({})]));
const LocationScopedInputSchema = z.looseObject({ locationId: z.uuid() });
const QueryErrorSchema = z.instanceof(Error);

/** Whether `error` is the API refusing a store as outside the member's scope. */
export function isLocationForbiddenError(error: Error): boolean {
	return error instanceof ApiError && error.code === MerchantErrorCodes.ORGANIZATION_LOCATION_FORBIDDEN;
}

/** The store a failed query of `orgSlug` asked for, when its error is a location refusal; otherwise `undefined`. */
export function readRejectedLocationId(queryKey: QueryKey, error: Error, orgSlug: string): string | undefined {
	if (!isLocationForbiddenError(error)) {
		return undefined;
	}
	const key = OrganizationQueryKeySchema.safeParse(queryKey);
	if (!key.success || key.data[LIST_SLOT_INDEX.second] !== orgSlug) {
		return undefined;
	}
	const input = LocationScopedInputSchema.safeParse(key.data.at(-1));
	return input.success ? input.data.locationId : undefined;
}

/** Calls `onRejected` with each store the API refuses for `orgSlug`; returns the unsubscribe. */
export function subscribeToLocationRejections(queryCache: QueryCache, orgSlug: string, onRejected: (locationId: string) => void): () => void {
	return queryCache.subscribe((event): void => {
		if (event.type !== "updated" || event.action.type !== "error") {
			return;
		}
		// The cache types keys and errors loosely: both are validated before use.
		const key = OrganizationQueryKeySchema.safeParse(event.query.queryKey);
		const error = QueryErrorSchema.safeParse(event.action.error);
		if (!key.success || !error.success) {
			return;
		}
		const locationId = readRejectedLocationId(key.data, error.data, orgSlug);
		if (locationId !== undefined) {
			onRejected(locationId);
		}
	});
}
