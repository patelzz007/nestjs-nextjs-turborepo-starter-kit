"use client";

// ============================================
// lib/contexts/reporting/analytics-range-controller.ts - the URL-backed range + interval of every analytics dashboard
// ============================================
// `useAnalyticsRange` reads and writes `ANALYTICS_URL_STATE` (shallow History
// API updates — the dashboard queries refetch for the new key, the server page
// does not re-render) and resolves it against the request time. It imports no
// UI, so a dashboard reads its range without loading the picker's calendar:
// `AnalyticsRangeControls` (analytics-range-controls.tsx) is its own chunk.

import type { AnalyticsInterval } from "@workspace/shared";
import * as React from "react";

import { useUrlState } from "../../url-state/use-url-state";
import { ANALYTICS_URL_STATE, resolveAnalyticsRange, type AnalyticsRangePreset, type LocalDateRange, type ResolvedAnalyticsRange } from "./analytics-range";

/** The dashboard's range and the commands that change it (each writes the URL). */
export interface AnalyticsRangeController {
	readonly range: ResolvedAnalyticsRange;
	/** A relative preset; resets any custom days and the interval (back to the length's default). */
	readonly selectPreset: (preset: Exclude<AnalyticsRangePreset, "custom">) => void;
	/** A validated custom range; resets the interval to the length's default. */
	readonly applyCustomRange: (days: LocalDateRange) => void;
	readonly selectInterval: (interval: AnalyticsInterval) => void;
}

/**
 * The analytics range of the current URL, resolved against `nowMs` (the
 * request time the server page rendered with) in the report's `timeZone`.
 */
export function useAnalyticsRange(nowMs: number, timeZone: string): AnalyticsRangeController {
	const [state, update] = useUrlState(ANALYTICS_URL_STATE);
	const range = React.useMemo((): ResolvedAnalyticsRange => resolveAnalyticsRange(state, nowMs, timeZone), [state, nowMs, timeZone]);

	const selectPreset = React.useCallback(
		(preset: Exclude<AnalyticsRangePreset, "custom">): void => {
			update({ range: preset, from: undefined, to: undefined, interval: undefined });
		},
		[update],
	);
	const applyCustomRange = React.useCallback(
		(days: LocalDateRange): void => {
			update({ range: "custom", from: days.fromDate, to: days.toDate, interval: undefined });
		},
		[update],
	);
	const selectInterval = React.useCallback(
		(interval: AnalyticsInterval): void => {
			update({ interval });
		},
		[update],
	);

	return React.useMemo((): AnalyticsRangeController => ({ range, selectPreset, applyCustomRange, selectInterval }), [range, selectPreset, applyCustomRange, selectInterval]);
}
