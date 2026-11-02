import { CityListQuerySchema } from "@workspace/shared";
import { describe, expect, it, vi } from "vitest";

import { localAppCache } from "../../../../../../test/support/local-app-cache";
import type { ActorContext } from "../../../../../platform/application/actor-context";
import { InMemoryGeographyRead } from "../../../application/__tests__/fakes/in-memory-geography-read";
import { CachedGeographyRead } from "../cached-geography-read";

const REGION_ID = 1;
const READER: ActorContext = {
	kind: "anonymous",
	tenantId: null,
	request: { requestId: "req-1", ip: "203.0.113.7", userAgent: null, deviceLabel: null, endpoint: "/api/v1/geo/regions/1" },
};

describe("CachedGeographyRead", () => {
	it("answers a repeated read from the cache, and reads again after invalidateAll", async () => {
		const source = new InMemoryGeographyRead();
		const getRegion = vi.spyOn(source, "getRegion");
		const cached = new CachedGeographyRead(source, localAppCache());
		const actor = READER;

		await cached.getRegion(actor, REGION_ID);
		await cached.getRegion(actor, REGION_ID);
		expect(getRegion).toHaveBeenCalledTimes(1);

		await cached.invalidateAll();
		await cached.getRegion(actor, REGION_ID);
		expect(getRegion).toHaveBeenCalledTimes(2);
	});

	it("passes list reads straight through", async () => {
		const source = new InMemoryGeographyRead();
		const listCities = vi.spyOn(source, "listCities");
		const cached = new CachedGeographyRead(source, localAppCache());

		await cached.listCities(READER, CityListQuerySchema.parse({}));
		await cached.listCities(READER, CityListQuerySchema.parse({}));
		expect(listCities).toHaveBeenCalledTimes(2);
	});
});
