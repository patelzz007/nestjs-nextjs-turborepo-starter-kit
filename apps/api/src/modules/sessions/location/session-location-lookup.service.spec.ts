import { Logger } from "@nestjs/common";
import type { SessionLocation } from "@workspace/shared";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { createTestApiConfig } from "../../../../test/support/test-api-env";
import { TypedConfigService } from "../../../config/typed-config.service";
import { NoneSessionLocationResolver } from "./none-session-location.resolver";
import { createSessionLocationResolver } from "./session-location.factory";
import { SessionLocationLookupService } from "./session-location-lookup.service";
import type { SessionLocationResolver } from "./session-location.port";

const TIMEOUT_MS = 300;
const KUALA_LUMPUR: SessionLocation = { country: "MY", region: "Kuala Lumpur", city: "Kuala Lumpur" };

function config(): TypedConfigService {
	const base = createTestApiConfig();
	return new TypedConfigService({ ...base, sessions: { locationProvider: "none", locationTimeoutMs: TIMEOUT_MS } });
}

function lookupWith(resolve: SessionLocationResolver["resolve"]): SessionLocationLookupService {
	return new SessionLocationLookupService({ resolve }, config());
}

describe("SessionLocationLookupService", () => {
	let warn: MockInstance<Logger["warn"]>;

	beforeEach(() => {
		warn = vi.spyOn(Logger.prototype, "warn").mockImplementation((): void => undefined);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("answers the resolver's location", async () => {
		await expect(lookupWith(() => Promise.resolve(KUALA_LUMPUR)).lookup("203.0.113.24")).resolves.toEqual(KUALA_LUMPUR);
	});

	it("does not look up an unknown IP", async () => {
		const resolve = vi.fn<SessionLocationResolver["resolve"]>();

		await expect(lookupWith(resolve).lookup(null)).resolves.toBeNull();
		expect(resolve).not.toHaveBeenCalled();
	});

	it("answers no location (and logs) when the resolver fails — never an error", async () => {
		await expect(lookupWith(() => Promise.reject(new Error("GeoIP database missing"))).lookup("203.0.113.24")).resolves.toBeNull();
		expect(warn).toHaveBeenCalledWith(expect.stringContaining("GeoIP database missing"));
	});

	it("answers no location when the resolver is slower than SESSION_LOCATION_TIMEOUT_MS", async () => {
		vi.useFakeTimers();
		const pending = lookupWith(() => new Promise<SessionLocation | null>(() => undefined)).lookup("203.0.113.24");

		await vi.advanceTimersByTimeAsync(TIMEOUT_MS);

		await expect(pending).resolves.toBeNull();
		expect(warn).toHaveBeenCalledWith(expect.stringContaining("timed out"));
	});

	it("drops an invalid location answered by the provider (a third-party boundary)", async () => {
		const invalid: SessionLocation = { country: "Malaysia", region: null, city: null };

		await expect(lookupWith(() => Promise.resolve(invalid)).lookup("203.0.113.24")).resolves.toBeNull();
	});
});

describe("the none provider", () => {
	it("is what SESSION_LOCATION_PROVIDER=none builds, and resolves nothing", async () => {
		const resolver = createSessionLocationResolver(config());

		expect(resolver).toBeInstanceOf(NoneSessionLocationResolver);
		await expect(resolver.resolve("203.0.113.24")).resolves.toBeNull();
	});
});
