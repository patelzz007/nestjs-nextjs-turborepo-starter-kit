import { describe, expect, it } from "vitest";

import { loadTestAvailability } from "../policies/load-test-availability.policy";

const READY = { enabled: true, allowProduction: false, isProduction: false, queueAvailable: true };

/** Why load testing is off for `input` ("" when it is on). */
function reasonOf(input: typeof READY): string {
	const availability = loadTestAvailability(input);
	return availability.enabled ? "" : availability.reason;
}

describe("loadTestAvailability", () => {
	it("is enabled when switched on, outside production, with a queue", () => {
		expect(loadTestAvailability(READY)).toEqual({ enabled: true });
	});

	it("explains each reason it is off", () => {
		expect(reasonOf({ ...READY, enabled: false })).toContain("LOAD_TESTING_ENABLED");
		expect(reasonOf({ ...READY, isProduction: true })).toContain("LOAD_TESTING_ALLOW_PRODUCTION");
		expect(reasonOf({ ...READY, queueAvailable: false })).toContain("REDIS_URL");
	});

	it("allows production only when explicitly allowed", () => {
		expect(loadTestAvailability({ ...READY, isProduction: true, allowProduction: true })).toEqual({ enabled: true });
	});
});
