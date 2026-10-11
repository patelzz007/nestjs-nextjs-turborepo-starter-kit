// ============================================
// Analytics — the signed-in customer's activity over a date range
// ============================================
// What they spent, where and when, and the rewards, stamps and referrals that
// came of it, for the last 7, 30 or 90 days or any start and end date — the
// mobile counterpart of the web's "My Activity" page, with more beside it.
// UI only for now: the numbers are sample data built on the device
// (features/analytics) and the screen says so; no request is made. The range
// is screen state: it is not shared, and it starts at the default every time
// the tab is opened afresh.

import { PLATFORM_DISPLAY_REGION } from "@workspace/shared";
import CalendarRangeIcon from "lucide-react-native/icons/calendar-range";
import ChevronDownIcon from "lucide-react-native/icons/chevron-down";
import * as React from "react";
import { Pressable, Text, View } from "react-native";

import { Badge } from "../../components/badge";
import { DateRangePicker, type LocalDateRange } from "../../components/date-range-picker";
import { Icon } from "../../components/icon";
import { Screen } from "../../components/screen";
import { SegmentedControl } from "../../components/segmented-control";
import { MutedText } from "../../components/text";
import { ActivityDashboard } from "../../features/analytics/activity-dashboard";
import {
	ACTIVITY_RANGE_OPTIONS,
	choiceOf,
	CUSTOM_RANGE_ISSUE_MESSAGES,
	customRangeIssueOf,
	DEFAULT_ACTIVITY_SELECTION,
	earliestActivityDate,
	selectedActivityDays,
	selectedActivityRange,
	type ActivityRangeChoice,
	type ActivitySelection,
} from "../../features/analytics/activity-range";
import { rangeLabelOf } from "../../features/analytics/presentation";
import { useActivityDashboard, useActivityInsights, useActivityToday } from "../../features/analytics/use-activity-dashboard";

export default function AnalyticsScreen(): React.JSX.Element {
	const [selection, setSelection] = React.useState<ActivitySelection>(DEFAULT_ACTIVITY_SELECTION);
	const [pickerOpen, setPickerOpen] = React.useState(false);
	const today = useActivityToday();
	const range = React.useMemo(() => selectedActivityRange(selection, today), [selection, today]);
	const dashboard = useActivityDashboard(range);
	const insights = useActivityInsights(range);
	const rangeLabel = `${rangeLabelOf(range)} · ${range.timeZone}`;

	const openPicker = React.useCallback((): void => {
		setPickerOpen(true);
	}, []);
	const closePicker = React.useCallback((): void => {
		setPickerOpen(false);
	}, []);
	// "Custom" opens the calendar; the selection changes only when a range is applied.
	const choose = React.useCallback((choice: ActivityRangeChoice): void => {
		if (choice === "custom") {
			setPickerOpen(true);
			return;
		}
		setSelection({ kind: "preset", preset: choice });
	}, []);
	const applyCustom = React.useCallback((days: LocalDateRange): void => {
		setSelection({ kind: "custom", fromDate: days.from, toDate: days.to });
		setPickerOpen(false);
	}, []);
	const validate = React.useCallback(
		(days: LocalDateRange): string | null => {
			const issue = customRangeIssueOf(days.from, days.to, today);
			return issue === null ? null : CUSTOM_RANGE_ISSUE_MESSAGES[issue];
		},
		[today],
	);

	return (
		<Screen testID="analytics-screen">
			<View className="gap-3">
				<SegmentedControl label="Date range" options={ACTIVITY_RANGE_OPTIONS} value={choiceOf(selection)} onChange={choose} testID="analytics-range" />
				<View className="flex-row flex-wrap items-center justify-between gap-2">
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={`Dates, ${rangeLabel}`}
						accessibilityHint="Choose a start and an end date"
						onPress={openPicker}
						testID="analytics-range-button"
						className="min-h-11 flex-row items-center gap-2 rounded-xl border border-border bg-card px-3 active:opacity-70">
						<Icon icon={CalendarRangeIcon} size="sm" colorClassName="accent-muted-foreground" />
						<Text className="font-sans-medium text-sm text-foreground" testID="analytics-range-label">
							{rangeLabel}
						</Text>
						<Icon icon={ChevronDownIcon} size="sm" colorClassName="accent-muted-foreground" />
					</Pressable>
					<Badge label="Sample data" />
				</View>
			</View>
			<ActivityDashboard dashboard={dashboard} insights={insights} selection={selection} />
			<MutedText className="text-center">Sample numbers made on this device. Your real activity will appear here once this screen reads your account.</MutedText>
			<DateRangePicker
				visible={pickerOpen}
				title="Choose dates"
				initialRange={selectedActivityDays(selection, today)}
				minDate={earliestActivityDate(today)}
				maxDate={today}
				today={today}
				locale={PLATFORM_DISPLAY_REGION.locale}
				validate={validate}
				onApply={applyCustom}
				onClose={closePicker}
				testID="analytics-date-picker"
			/>
		</Screen>
	);
}
