import { epochMs, LOAD_TEST_ABORT_CPU_SECONDS, LOAD_TEST_ABORT_ERROR_SECONDS, type LoadTestCaps, type LoadTestPoint, type StartLoadTestInput } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { LoadTestOverCapError } from "../errors/operations.errors";
import { assertWithinCaps, autoAbortReason, errorPercent, loadTestPassed } from "../policies/load-test.policy";

const CAPS: LoadTestCaps = { maxVirtualUsers: 100, maxRequestsPerSecond: 500, maxMinutes: 10, maxSoakMinutes: 60 };
const RUN: Pick<StartLoadTestInput, "virtualUsers" | "requestsPerSecond" | "durationSeconds" | "shape"> = {
	virtualUsers: 50,
	requestsPerSecond: 100,
	durationSeconds: 600,
	shape: "CONSTANT",
};

function second(index: number, requests: number, failures: number): LoadTestPoint {
	return { second: index, at: epochMs(index * 1_000), virtualUsers: 1, requests, failures, p50Ms: 1, p95Ms: 1, p99Ms: 1 };
}

describe("assertWithinCaps", () => {
	it("accepts a run at the caps", () => {
		expect(() => {
			assertWithinCaps(RUN, CAPS);
		}).not.toThrow();
	});

	it("refuses a run over any cap", () => {
		expect(() => {
			assertWithinCaps({ ...RUN, virtualUsers: 101 }, CAPS);
		}).toThrow(LoadTestOverCapError);
		expect(() => {
			assertWithinCaps({ ...RUN, requestsPerSecond: 501 }, CAPS);
		}).toThrow(LoadTestOverCapError);
		expect(() => {
			assertWithinCaps({ ...RUN, durationSeconds: 601 }, CAPS);
		}).toThrow(LoadTestOverCapError);
	});

	it("gives a soak run its longer duration cap", () => {
		expect(() => {
			assertWithinCaps({ ...RUN, shape: "SOAK", durationSeconds: 3_600 }, CAPS);
		}).not.toThrow();
	});
});

describe("errorPercent", () => {
	it("is the failed share, 0 with no requests", () => {
		expect(errorPercent(200, 50)).toBe(25);
		expect(errorPercent(0, 0)).toBe(0);
	});
});

describe("autoAbortReason", () => {
	it("stops when errors stayed high for the whole window", () => {
		const failing = Array.from({ length: LOAD_TEST_ABORT_ERROR_SECONDS }, (_, index) => second(index, 10, 9));

		expect(autoAbortReason(failing, new Map(), LOAD_TEST_ABORT_ERROR_SECONDS)).toContain("Errors stayed above");
	});

	it("keeps going when one second in the window was healthy, or the window is not full yet", () => {
		const mixed = Array.from({ length: LOAD_TEST_ABORT_ERROR_SECONDS }, (_, index) => second(index, 10, index === 0 ? 0 : 9));

		expect(autoAbortReason(mixed, new Map(), LOAD_TEST_ABORT_ERROR_SECONDS)).toBeNull();
		expect(autoAbortReason(mixed.slice(1), new Map(), LOAD_TEST_ABORT_ERROR_SECONDS)).toBeNull();
	});

	it("stops when a server stayed over the CPU limit long enough", () => {
		expect(autoAbortReason([], new Map([["web-01", 0]]), LOAD_TEST_ABORT_CPU_SECONDS)).toContain("web-01 stayed above");
		expect(autoAbortReason([], new Map([["web-01", 1]]), LOAD_TEST_ABORT_CPU_SECONDS)).toBeNull();
	});
});

describe("loadTestPassed", () => {
	const thresholds = { p95Ms: 300, errorPercent: 1 };

	it("passes within both thresholds", () => {
		expect(loadTestPassed({ requests: 1_000, failures: 10, p95Ms: 300 }, thresholds)).toBe(true);
	});

	it("fails over either threshold, or with nothing measured", () => {
		expect(loadTestPassed({ requests: 1_000, failures: 11, p95Ms: 100 }, thresholds)).toBe(false);
		expect(loadTestPassed({ requests: 1_000, failures: 0, p95Ms: 301 }, thresholds)).toBe(false);
		expect(loadTestPassed({ requests: 0, failures: 0, p95Ms: null }, thresholds)).toBe(false);
	});
});
