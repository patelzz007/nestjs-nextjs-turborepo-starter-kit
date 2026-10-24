// A start and end date, picked on a month calendar in a bottom sheet: tap the
// first day, then the last (twice on one day for a single day); the days
// between are banded. Tapping the month or year in the header lists the
// months or years to jump to (CalendarNavigator). The selected ends and the day count show above the
// calendar, and the caller's rule (a longest range, say) is checked before
// Apply is offered. Days outside `minDate`…`maxDate` cannot be picked, and
// the months beyond them are not offered. Each day is a button named by its
// full date and its place in the range.
//
// Presentational and controlled at the edges: the caller passes the range
// to start from and gets the new one from `onApply`; the draft in between is
// the sheet's own, and starts afresh each time it opens. Dates are calendar
// days (`YYYY-MM-DD`). The ref reaches the modal's root view (mounted while
// visible); `className` is merged last onto the sheet panel.

import { inclusiveLocalDayCount, UTC_TIME_ZONE, type LocalDate } from "@workspace/shared";
import XIcon from "lucide-react-native/icons/x";
import { cva } from "class-variance-authority";
import * as React from "react";
import { Modal, Pressable, Text, View, type ViewInstance } from "react-native";

import { calendarDayMsOf, calendarMonthOf, pickRangeDay, rangeDayRoleOf, type CalendarMonth, type DateRangeDraft, type RangeDayRole } from "../lib/calendar";
import { cn } from "../lib/cn";
import { playSelectionFeedback } from "../lib/haptics";
import { Button } from "./button";
import { CalendarMonthGrid } from "./calendar-month-grid";
import { CalendarNavigator } from "./calendar-navigator";
import { Icon } from "./icon";
import { Subheading } from "./text";

export interface LocalDateRange {
	readonly from: LocalDate;
	readonly to: LocalDate;
}

export interface DateRangePickerProps {
	readonly visible: boolean;
	/** The sheet's heading ("Date range"). */
	readonly title: string;
	/** The range the sheet opens on, or none. */
	readonly initialRange: LocalDateRange | null;
	readonly minDate: LocalDate;
	readonly maxDate: LocalDate;
	/** Marked on the calendar. */
	readonly today: LocalDate;
	/** The locale of the month and day names. */
	readonly locale: string;
	/** Why a complete range cannot be applied, or `null` when it can. */
	readonly validate: (range: LocalDateRange) => string | null;
	readonly onApply: (range: LocalDateRange) => void;
	readonly onClose: () => void;
	/** Extra classes for the sheet panel, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string;
}

/** The start / end boxes above the calendar: outlined on the end the next tap sets. */
export const dateRangeEndVariants = cva("flex-1 gap-0.5 rounded-xl border px-3 py-2", {
	variants: {
		active: { true: "border-primary bg-card", false: "border-border bg-muted" },
	},
	defaultVariants: { active: false },
});

/** The line under the calendar: guidance, the day count, or why the range cannot be applied. */
export const dateRangeStatusVariants = cva("font-sans text-sm", {
	variants: {
		state: { default: "text-muted-foreground", error: "text-destructive-foreground" },
	},
	defaultVariants: { state: "default" },
});

/** The close button's glyph is 24 pt in a 44 pt circle; 8 pt more on each side eases the corner reach. */
const CLOSE_HIT_SLOP = 8;

export const DateRangePicker = React.memo(
	React.forwardRef<ViewInstance, DateRangePickerProps>(function DateRangePicker({ visible, onClose, ...props }, ref): React.JSX.Element {
		return (
			<Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
				<View ref={ref} className="flex-1 justify-end">
					<Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} className="absolute inset-0 bg-scrim opacity-50" />
					{/* Mounted only while open, so every opening starts from `initialRange`. */}
					{visible ? <PickerSheet {...props} onClose={onClose} /> : null}
				</View>
			</Modal>
		);
	}),
);

type PickerSheetProps = Omit<DateRangePickerProps, "visible">;

/** No end picked yet. */
const EMPTY_DRAFT: DateRangeDraft = { from: null, to: null };

const PickerSheet = React.memo(function PickerSheet({
	title,
	initialRange,
	minDate,
	maxDate,
	today,
	locale,
	validate,
	onApply,
	onClose,
	className,
	testID,
}: PickerSheetProps): React.JSX.Element {
	const [draft, setDraft] = React.useState<DateRangeDraft>(initialRange ?? EMPTY_DRAFT);
	const [month, setMonth] = React.useState<CalendarMonth>(() => calendarMonthOf(initialRange?.to ?? maxDate));
	const summaryFormat = React.useMemo(() => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: UTC_TIME_ZONE }), [locale]);

	const pick = React.useCallback((day: LocalDate): void => {
		playSelectionFeedback();
		setDraft((current: DateRangeDraft): DateRangeDraft => pickRangeDay(current, day));
	}, []);
	const roleOf = React.useCallback((day: LocalDate): RangeDayRole => rangeDayRoleOf(draft, day), [draft]);
	const minMonth = React.useMemo(() => calendarMonthOf(minDate), [minDate]);
	const maxMonth = React.useMemo(() => calendarMonthOf(maxDate), [maxDate]);

	const complete = React.useMemo((): LocalDateRange | null => (draft.from !== null && draft.to !== null ? { from: draft.from, to: draft.to } : null), [draft]);
	/** The next tap sets the end (a start is picked, no end yet); otherwise it sets the start. */
	const pickingEnd = draft.from !== null && draft.to === null;
	const problem = complete === null ? null : validate(complete);
	const apply = React.useCallback((): void => {
		if (complete !== null && problem === null) {
			onApply(complete);
		}
	}, [complete, onApply, problem]);

	const status = complete === null ? "Tap a start date, then an end date. Tap a date twice for a single day." : (problem ?? dayCountLabel(complete));

	return (
		<View accessibilityViewIsModal className={cn("gap-4 rounded-t-2xl border border-border bg-popover px-4 pt-4 pb-8", className)} testID={testID}>
			<View className="flex-row items-center justify-between">
				<Subheading>{title}</Subheading>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={`Close ${title.toLowerCase()}`}
					onPress={onClose}
					hitSlop={CLOSE_HIT_SLOP}
					className="size-11 items-center justify-center rounded-full active:opacity-60">
					<Icon icon={XIcon} size="md" colorClassName="accent-muted-foreground" />
				</Pressable>
			</View>
			<View className="flex-row gap-2">
				<RangeEnd label="Start" value={draft.from === null ? null : summaryFormat.format(calendarDayMsOf(draft.from))} active={!pickingEnd} />
				<RangeEnd label="End" value={draft.to === null ? null : summaryFormat.format(calendarDayMsOf(draft.to))} active={pickingEnd} />
			</View>
			<CalendarNavigator month={month} minMonth={minMonth} maxMonth={maxMonth} locale={locale} onMonthChange={setMonth}>
				<CalendarMonthGrid month={month} today={today} minDate={minDate} maxDate={maxDate} locale={locale} roleOf={roleOf} onPick={pick} />
			</CalendarNavigator>
			<Text accessibilityLiveRegion="polite" className={dateRangeStatusVariants({ state: problem === null ? "default" : "error" })}>
				{status}
			</Text>
			<View className="flex-row justify-end gap-2">
				<Button label="Cancel" variant="ghost" onPress={onClose} />
				<Button label="Apply" onPress={apply} disabled={complete === null || problem !== null} {...(testID === undefined ? {} : { testID: `${testID}-apply` })} />
			</View>
		</View>
	);
});

/** "30 days", "1 day". */
function dayCountLabel(range: LocalDateRange): string {
	const days = inclusiveLocalDayCount(range.from, range.to);
	return days === 1 ? "1 day" : `${String(days)} days`;
}

interface RangeEndProps {
	readonly label: string;
	readonly value: string | null;
	/** The end the next tap sets. */
	readonly active: boolean;
}

const RangeEnd = React.memo(function RangeEnd({ label, value, active }: RangeEndProps): React.JSX.Element {
	return (
		<View className={dateRangeEndVariants({ active })} accessible accessibilityLabel={`${label}: ${value ?? "not chosen"}`}>
			<Text className="font-sans-medium text-xs text-muted-foreground">{label}</Text>
			<Text className={`font-sans-semibold text-sm ${value === null ? "text-muted-foreground" : "text-foreground"}`}>{value ?? "—"}</Text>
		</View>
	);
});
