import { keepPreviousData } from "@tanstack/react-query";
import { OPS_HOUR_MS, OPS_MINUTE_MS, OPS_SAMPLE_INTERVAL_MS } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { OPS_LIST_QUERY, OPS_LIVE_QUERY, opsHistoryQuery } from "../ops-queries";

describe("operations query caching", () => {
	it("keeps live data fresh for one agent interval", () => {
		expect(OPS_LIVE_QUERY).toEqual({ staleTime: OPS_SAMPLE_INTERVAL_MS, refetchInterval: OPS_SAMPLE_INTERVAL_MS });
	});

	it("refreshes lists on the same pace it treats them as fresh", () => {
		expect(OPS_LIST_QUERY.staleTime).toBe(OPS_LIST_QUERY.refetchInterval);
	});

	it("caches history for one bucket of its resolution and keeps the previous range on screen", () => {
		expect(opsHistoryQuery("1h")).toEqual({ staleTime: OPS_MINUTE_MS, refetchInterval: OPS_MINUTE_MS, placeholderData: keepPreviousData });
		expect(opsHistoryQuery("30d")).toEqual({ staleTime: OPS_HOUR_MS, refetchInterval: OPS_HOUR_MS, placeholderData: keepPreviousData });
	});
});
