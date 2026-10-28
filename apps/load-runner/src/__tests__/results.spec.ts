import { describe, expect, it } from "vitest";

import { K6ResultsAggregator } from "../results";
import { k6Line } from "./fixtures";

const T0 = "2026-10-28T10:00:00.000Z";
const T0_MS = Date.parse(T0);

describe("K6ResultsAggregator", () => {
	it("ignores blank lines, non-measurements and malformed JSON", () => {
		const aggregator = new K6ResultsAggregator();
		aggregator.addLine("");
		aggregator.addLine("{not json");
		aggregator.addLine(JSON.stringify({ type: "Metric", metric: "http_req_duration", data: {} }));

		expect(aggregator.takeFinishedSeconds(T0_MS + 5_000, true)).toEqual([]);
		expect(aggregator.totals(null).requests).toBe(0);
	});

	it("buckets requests and failures by second, and emits each second once", () => {
		const aggregator = new K6ResultsAggregator();
		aggregator.addLine(k6Line("vus", T0, 3));
		aggregator.addLine(k6Line("http_req_duration", T0, 100));
		aggregator.addLine(k6Line("http_req_failed", T0, 1));
		aggregator.addLine(k6Line("http_req_duration", "2026-10-28T10:00:01.500Z", 300));
		aggregator.addLine(k6Line("http_req_failed", "2026-10-28T10:00:01.500Z", 0));

		const first = aggregator.takeFinishedSeconds(T0_MS + 1_200, false);
		expect(first).toEqual([{ second: 0, at: T0_MS, virtualUsers: 3, requests: 1, failures: 1, p50Ms: 100, p95Ms: 100, p99Ms: 100 }]);
		expect(aggregator.takeFinishedSeconds(T0_MS + 1_500, false)).toEqual([]);

		const rest = aggregator.takeFinishedSeconds(T0_MS + 1_600, true);
		expect(rest).toMatchObject([{ second: 1, requests: 1, failures: 0 }]);
	});

	it("totals the run and each step", () => {
		const aggregator = new K6ResultsAggregator();
		aggregator.addLine(k6Line("http_req_duration", T0, 100, "sign in"));
		aggregator.addLine(k6Line("http_req_duration", T0, 200, "list rewards"));
		aggregator.addLine(k6Line("http_req_failed", T0, 1, "sign in"));

		expect(aggregator.totals(2)).toMatchObject({ requests: 2, failures: 1, peakRps: 2 });
		expect(aggregator.stepStats()).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ step: "sign in", requests: 1, failures: 1 }),
				expect.objectContaining({ step: "list rewards", requests: 1, failures: 0 }),
			]),
		);
	});
});
