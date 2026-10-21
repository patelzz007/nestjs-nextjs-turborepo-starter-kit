"use client";

// ============================================
// lib/contexts/reporting/analytics-range-controls.tsx - the URL-backed range + interval filter of every analytics dashboard
// ============================================
// The `AnalyticsRangeControls` smart component renders the packages/ui
// `AnalyticsRangePicker` for a `useAnalyticsRange` controller
// (analytics-range-controller.ts); its only local state is the custom range
// being picked (a draft, committed to the URL by Apply — like `useUrlDraft`).
// Pages load it through `next/dynamic` with `AnalyticsRangePickerSkeleton`, so
// the calendar is its own chunk (rules/19).

import { MAX_ANALYTICS_RANGE_DAYS, PLATFORM_DISPLAY_REGION, type AnalyticsInterval } from "@workspace/shared";
import { AnalyticsRangePicker, type CustomDays } from "@workspace/ui/components/analytics-range-picker";
import * as React from "react";

import { checkCustomRange, CUSTOM_RANGE_ISSUE_MESSAGES, type AnalyticsRangePreset } from "./analytics-range";
import type { AnalyticsRangeController } from "./analytics-range-controller";
import { analyticsDisplayRegion, ANALYTICS_INTERVAL_OPTIONS, ANALYTICS_RANGE_PRESET_OPTIONS, formatAnalyticsRangeLabel, formatCustomDays } from "./analytics-presentation";

export interface AnalyticsRangeControlsProps {
	readonly controller: AnalyticsRangeController;
	readonly disabled?: boolean;
	readonly className?: string;
}

/** The dashboard's filter row: preset, custom days in a calendar (≤ 366 days, ending today at the latest), interval, and the range in effect. */
export function AnalyticsRangeControls({ controller, disabled = false, className }: AnalyticsRangeControlsProps): React.JSX.Element {
	const { range, selectPreset, applyCustomRange, selectInterval } = controller;
	// The custom days being picked, before Apply. `undefined` = not editing (the menu shows the range in effect).
	const [draft, setDraft] = React.useState<CustomDays | undefined>(undefined);

	const isEditingCustom = draft !== undefined;
	const shownPreset: AnalyticsRangePreset = isEditingCustom ? "custom" : range.preset;
	const custom: CustomDays = draft ?? { from: range.days.fromDate, to: range.days.toDate };
	const check = checkCustomRange(custom.from, custom.to);
	// Shown (and Apply blocked) while the picked days cannot be applied — e.g. only the first day is picked yet.
	const customError = !check.ok && isEditingCustom ? CUSTOM_RANGE_ISSUE_MESSAGES[check.issue] : undefined;

	const handlePresetChange = React.useCallback(
		(preset: AnalyticsRangePreset): void => {
			if (preset === "custom") {
				// Start from the days in effect; the URL changes only on Apply.
				setDraft({ from: range.days.fromDate, to: range.days.toDate });
				return;
			}
			setDraft(undefined);
			selectPreset(preset);
		},
		[range.days.fromDate, range.days.toDate, selectPreset],
	);
	const handleApply = React.useCallback((): void => {
		if (check.ok) {
			applyCustomRange(check.range);
			setDraft(undefined);
		}
	}, [applyCustomRange, check]);
	const formatDays = React.useCallback((days: CustomDays): string => formatCustomDays(days, PLATFORM_DISPLAY_REGION.locale), []);

	return (
		<AnalyticsRangePicker<AnalyticsRangePreset, AnalyticsInterval>
			className={className}
			presets={ANALYTICS_RANGE_PRESET_OPTIONS}
			preset={shownPreset}
			customPreset="custom"
			onPresetChange={handlePresetChange}
			customDays={custom}
			onCustomDaysChange={setDraft}
			onCustomApply={handleApply}
			customError={customError}
			customMax={range.today}
			customMaxDays={MAX_ANALYTICS_RANGE_DAYS}
			formatCustomDays={formatDays}
			intervals={ANALYTICS_INTERVAL_OPTIONS}
			interval={range.interval}
			onIntervalChange={selectInterval}
			rangeLabel={formatAnalyticsRangeLabel(range.fromMs, range.toMs, analyticsDisplayRegion(range.timeZone))}
			disabled={disabled}
		/>
	);
}
