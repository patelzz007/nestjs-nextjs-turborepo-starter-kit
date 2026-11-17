import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readTierAvailability } from "@/contexts/tiers/lib/server-tier-availability";
import { testEnvelope } from "@/testing/envelope";

const { availabilityQuery, logError } = vi.hoisted(() => ({ availabilityQuery: vi.fn(), logError: vi.fn() }));

vi.mock("@/lib/web-server-api", () => ({ createWebServerCaller: (): object => ({ tiers: { availability: { query: availabilityQuery } } }) }));

beforeEach((): void => {
	vi.spyOn(console, "error").mockImplementation(logError);
});

afterEach((): void => {
	vi.resetAllMocks();
	vi.restoreAllMocks();
});

describe("readTierAvailability", () => {
	it("returns whether tiers are on and the viewer's tier", async () => {
		availabilityQuery.mockResolvedValue(testEnvelope({ enabled: true, viewerTier: "SILVER" }));

		await expect(readTierAvailability()).resolves.toStrictEqual({ enabled: true, viewerTier: "SILVER" });
		expect(availabilityQuery).toHaveBeenCalledWith(undefined);
		expect(logError).not.toHaveBeenCalled();
	});

	it("renders as with tiers off when the read fails, and logs the failure", async () => {
		const failure = new Error("api down");
		availabilityQuery.mockRejectedValue(failure);

		await expect(readTierAvailability()).resolves.toBeUndefined();
		expect(logError).toHaveBeenCalledWith(expect.stringContaining("tiers.availability"), failure);
	});
});
