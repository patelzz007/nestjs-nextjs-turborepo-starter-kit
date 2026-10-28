import { epochMs, OPS_HOUR_MS, OPS_MINUTE_MS } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { bucketMs, bucketStartOf, historyWindow } from "../policies/history-window.policy";

describe("history windows", () => {
	it("sizes buckets by resolution", () => {
		expect(bucketMs("MINUTE")).toBe(OPS_MINUTE_MS);
		expect(bucketMs("HOUR")).toBe(OPS_HOUR_MS);
	});

	it("finds the bucket a time falls in", () => {
		expect(bucketStartOf(OPS_HOUR_MS + 61_000, "MINUTE")).toBe(OPS_HOUR_MS + OPS_MINUTE_MS);
		expect(bucketStartOf(OPS_HOUR_MS + 61_000, "HOUR")).toBe(OPS_HOUR_MS);
	});

	it("ends a range with the bucket now is in and starts it one span earlier", () => {
		const now = epochMs(10 * OPS_HOUR_MS + 30_000);

		expect(historyWindow("1h", now)).toEqual({ range: "1h", resolution: "MINUTE", from: 9 * OPS_HOUR_MS, to: 10 * OPS_HOUR_MS });
		expect(historyWindow("7d", now)).toMatchObject({ resolution: "HOUR", to: 10 * OPS_HOUR_MS, from: 0 });
	});
});
