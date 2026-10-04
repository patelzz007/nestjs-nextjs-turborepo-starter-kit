import { QueryClient } from "@tanstack/react-query";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { ApiError } from "@workspace/client/lib/api/use-api";
import { MerchantErrorCodes } from "@workspace/shared";
import { describe, expect, it, vi } from "vitest";

import { TEST_ORG_SLUG } from "@/test/authorization";
import { STORE_A } from "@/test/terminals";

import { readRejectedLocationId, subscribeToLocationRejections } from "./location-rejection";

const HTTP_FORBIDDEN = 403;

function locationForbidden(): ApiError {
	return new ApiError({ message: "Location is outside your membership scope", error: MerchantErrorCodes.ORGANIZATION_LOCATION_FORBIDDEN, statusCode: HTTP_FORBIDDEN });
}

const REDEMPTIONS_KEY = apiRouter.organizations.redemptions.queryKey({ orgSlug: TEST_ORG_SLUG, page: 1, limit: 20, locationId: STORE_A.id });

describe("readRejectedLocationId", () => {
	it("reads the refused store from this organization's location-scoped query", () => {
		expect(readRejectedLocationId(REDEMPTIONS_KEY, locationForbidden(), TEST_ORG_SLUG)).toBe(STORE_A.id);
	});

	it("ignores other errors, other organizations and queries without a store", () => {
		expect(readRejectedLocationId(REDEMPTIONS_KEY, new ApiError({ message: "Forbidden", error: "FORBIDDEN", statusCode: HTTP_FORBIDDEN }), TEST_ORG_SLUG)).toBeUndefined();
		expect(readRejectedLocationId(REDEMPTIONS_KEY, locationForbidden(), "other-org")).toBeUndefined();
		const allStores = apiRouter.organizations.redemptions.queryKey({ orgSlug: TEST_ORG_SLUG, page: 1, limit: 20, locationId: undefined });
		expect(readRejectedLocationId(allStores, locationForbidden(), TEST_ORG_SLUG)).toBeUndefined();
	});
});

describe("subscribeToLocationRejections", () => {
	it("reports a refused store once its query fails, and stops after unsubscribe", async () => {
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		const onRejected = vi.fn();
		const unsubscribe = subscribeToLocationRejections(client.getQueryCache(), TEST_ORG_SLUG, onRejected);

		await client.query({ queryKey: REDEMPTIONS_KEY, queryFn: (): Promise<string> => Promise.reject(locationForbidden()) }).catch((): void => undefined);
		expect(onRejected).toHaveBeenCalledWith(STORE_A.id);

		unsubscribe();
		onRejected.mockClear();
		await client.query({ queryKey: REDEMPTIONS_KEY, queryFn: (): Promise<string> => Promise.reject(locationForbidden()) }).catch((): void => undefined);
		expect(onRejected).not.toHaveBeenCalled();
	});
});
