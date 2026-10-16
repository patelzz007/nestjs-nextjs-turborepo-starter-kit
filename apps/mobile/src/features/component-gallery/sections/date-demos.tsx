// The Components screen's date pickers and glyph buttons: DateField,
// MultiDateField, DateRangePicker, the inline CalendarNavigator +
// CalendarMonthGrid, and IconButton. Each example owns its demo state here
// (the kit components stay controlled); nothing is sent to the API or stored.
// "Today" is read from the clock in the platform's display zone, so the
// calendars ring the real day.

import { addLocalDays, inclusiveLocalDayCount, localDateInTimeZone, PLATFORM_DISPLAY_REGION, UTC_TIME_ZONE, type LocalDate } from "@workspace/shared";
import HeartIcon from "lucide-react-native/icons/heart";
import Share2Icon from "lucide-react-native/icons/share-2";
import TrashIcon from "lucide-react-native/icons/trash";
import * as React from "react";
import { View } from "react-native";

import { Button } from "@workspace/ui-native/components/button";
import { CalendarMonthGrid } from "@workspace/ui-native/components/calendar-month-grid";
import { CalendarNavigator } from "@workspace/ui-native/components/calendar-navigator";
import { DateField } from "@workspace/ui-native/components/date-field";
import { DateRangePicker, type LocalDateRange } from "@workspace/ui-native/components/date-range-picker";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { MultiDateField } from "@workspace/ui-native/components/multi-date-field";
import { MutedText } from "@workspace/ui-native/components/text";
import { calendarDayMsOf, calendarMonthOf, firstDayOf, type CalendarMonth, type RangeDayRole } from "@workspace/ui-native/lib/calendar";
import { useNow } from "../../../lib/use-now";
import { DemoBlock } from "../demo-block";

/** How often "today" is re-read, so the bounds move on at midnight while the screen stays open. */
const TODAY_REFRESH_MS = 60_000;
/** A date of birth may be up to this many years back (from 1 January of that year). */
const BIRTH_YEARS_BACK = 100;
/** Separate days and the inline calendar run from today to the end of the year this many years ahead. */
const YEARS_AHEAD = 1;
/** The range picker reaches this many days back from today (today included). */
const RANGE_DAYS_BACK = 365;
/** The longest range the demo's rule allows. */
const MAX_RANGE_DAYS = 31;
/** The most separate days the demo lets you pick. */
const MAX_PICKED_DAYS = 5;
/** The demo range ends this many days before today… */
const DEMO_RANGE_END_DAYS_BACK = 1;
/** …and spans this many days. */
const DEMO_RANGE_LENGTH_DAYS = 7;

interface GalleryDateBounds {
	/** The earliest date of birth. */
	readonly birthMin: LocalDate;
	/** The earliest day the range picker offers. */
	readonly rangeMin: LocalDate;
	/** The last day the forward-looking pickers offer. */
	readonly aheadMax: LocalDate;
}

function galleryDateBoundsOf(today: LocalDate): GalleryDateBounds {
	const { year } = calendarMonthOf(today);
	return {
		birthMin: firstDayOf({ year: year - BIRTH_YEARS_BACK, month: 1 }),
		rangeMin: addLocalDays(today, 1 - RANGE_DAYS_BACK),
		aheadMax: addLocalDays(firstDayOf({ year: year + YEARS_AHEAD + 1, month: 1 }), -1),
	};
}

/** The demo's rule for a range: at most MAX_RANGE_DAYS days. */
function validateRange(range: LocalDateRange): string | null {
	return inclusiveLocalDayCount(range.from, range.to) > MAX_RANGE_DAYS ? `Pick at most ${String(MAX_RANGE_DAYS)} days.` : null;
}

const NO_DAYS: readonly LocalDate[] = [];

export function DateDemos(): React.JSX.Element {
	const nowMs = useNow({ intervalMs: TODAY_REFRESH_MS, running: true });
	const today = localDateInTimeZone(nowMs, PLATFORM_DISPLAY_REGION.timeZone);
	const bounds = React.useMemo(() => galleryDateBoundsOf(today), [today]);
	const { locale } = PLATFORM_DISPLAY_REGION;

	return (
		<View className="gap-4">
			<DateFieldDemo today={today} bounds={bounds} locale={locale} />
			<MultiDateFieldDemo today={today} bounds={bounds} locale={locale} />
			<DateRangePickerDemo today={today} bounds={bounds} locale={locale} />
			<InlineCalendarDemo today={today} bounds={bounds} locale={locale} />
			<IconButtonDemo />
		</View>
	);
}

interface DateDemoProps {
	readonly today: LocalDate;
	readonly bounds: GalleryDateBounds;
	readonly locale: string;
}

function DateFieldDemo({ today, bounds, locale }: DateDemoProps): React.JSX.Element {
	const [birthDate, setBirthDate] = React.useState<LocalDate | null>(null);
	const [touched, setTouched] = React.useState(false);
	const markTouched = React.useCallback((): void => {
		setTouched(true);
	}, []);
	const error = touched && birthDate === null ? "Pick your date of birth." : undefined;
	return (
		<DemoBlock title="DateField" description="One calendar day in a bottom sheet; the header's month and year jump anywhere.">
			<DateField
				label="Date of birth"
				value={birthDate}
				onChange={setBirthDate}
				onBlur={markTouched}
				placeholder="Pick your date of birth"
				minDate={bounds.birthMin}
				maxDate={today}
				today={today}
				locale={locale}
				error={error}
				hint="Close the calendar without picking to see the error."
				testID="gallery-date-field"
			/>
			<DateField
				label="Start date (disabled)"
				value={today}
				onChange={setBirthDate}
				placeholder="Pick a day"
				minDate={today}
				maxDate={bounds.aheadMax}
				today={today}
				locale={locale}
				disabled
			/>
		</DemoBlock>
	);
}

function MultiDateFieldDemo({ today, bounds, locale }: DateDemoProps): React.JSX.Element {
	const [days, setDays] = React.useState<readonly LocalDate[]>(NO_DAYS);
	return (
		<DemoBlock title="MultiDateField" description="Several separate days, picked as a draft and applied together.">
			<MultiDateField
				label="Available days"
				value={days}
				onChange={setDays}
				placeholder="Pick the days you are free"
				minDate={today}
				maxDate={bounds.aheadMax}
				today={today}
				locale={locale}
				maxDates={MAX_PICKED_DAYS}
				hint={`Up to ${String(MAX_PICKED_DAYS)} days, in any months.`}
				testID="gallery-multi-date-field"
			/>
			<MultiDateField
				label="Delivery days"
				value={NO_DAYS}
				onChange={setDays}
				placeholder="Pick the delivery days"
				minDate={today}
				maxDate={bounds.aheadMax}
				today={today}
				locale={locale}
				error="Pick at least one day."
			/>
		</DemoBlock>
	);
}

/** A short range ending just before today, so the picker opens with its band drawn. */
function demoRangeOf(today: LocalDate): LocalDateRange {
	const to = addLocalDays(today, -DEMO_RANGE_END_DAYS_BACK);
	return { from: addLocalDays(to, 1 - DEMO_RANGE_LENGTH_DAYS), to };
}

function DateRangePickerDemo({ today, bounds, locale }: DateDemoProps): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const [range, setRange] = React.useState<LocalDateRange>(() => demoRangeOf(today));
	const summaryFormat = React.useMemo(() => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: UTC_TIME_ZONE }), [locale]);
	const openPicker = React.useCallback((): void => {
		setOpen(true);
	}, []);
	const closePicker = React.useCallback((): void => {
		setOpen(false);
	}, []);
	const apply = React.useCallback((applied: LocalDateRange): void => {
		setRange(applied);
		setOpen(false);
	}, []);
	return (
		<DemoBlock title="DateRangePicker" description="A start and an end in a sheet, checked against the caller's rule before Apply.">
			<MutedText>{`${summaryFormat.format(calendarDayMsOf(range.from))} – ${summaryFormat.format(calendarDayMsOf(range.to))}`}</MutedText>
			<Button label="Choose dates" variant="secondary" onPress={openPicker} className="self-start" testID="gallery-range-open" />
			<DateRangePicker
				visible={open}
				title="Choose dates"
				initialRange={range}
				minDate={bounds.rangeMin}
				maxDate={today}
				today={today}
				locale={locale}
				validate={validateRange}
				onApply={apply}
				onClose={closePicker}
				testID="gallery-range-picker"
			/>
		</DemoBlock>
	);
}

function InlineCalendarDemo({ today, bounds, locale }: DateDemoProps): React.JSX.Element {
	const [picked, setPicked] = React.useState<LocalDate | null>(null);
	const [month, setMonth] = React.useState<CalendarMonth>(() => calendarMonthOf(today));
	const minMonth = React.useMemo(() => calendarMonthOf(today), [today]);
	const maxMonth = React.useMemo(() => calendarMonthOf(bounds.aheadMax), [bounds.aheadMax]);
	const fullFormat = React.useMemo(() => new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: UTC_TIME_ZONE }), [locale]);
	const roleOf = React.useCallback((day: LocalDate): RangeDayRole => (day === picked ? "single" : "none"), [picked]);
	return (
		<DemoBlock title="CalendarNavigator" description="The building blocks: a month/year header around CalendarMonthGrid, drawn inline.">
			<CalendarNavigator month={month} minMonth={minMonth} maxMonth={maxMonth} locale={locale} onMonthChange={setMonth} testID="gallery-inline-calendar">
				<CalendarMonthGrid month={month} today={today} minDate={today} maxDate={bounds.aheadMax} locale={locale} roleOf={roleOf} onPick={setPicked} />
			</CalendarNavigator>
			<MutedText accessibilityLiveRegion="polite">{picked === null ? "No day picked yet." : `Picked: ${fullFormat.format(calendarDayMsOf(picked))}`}</MutedText>
		</DemoBlock>
	);
}

function IconButtonDemo(): React.JSX.Element {
	const [liked, setLiked] = React.useState(false);
	const toggleLiked = React.useCallback((): void => {
		setLiked((current: boolean): boolean => !current);
	}, []);
	const noop = React.useCallback((): void => {
		// The disabled and busy examples never fire.
	}, []);
	return (
		<DemoBlock title="IconButton" description="A glyph-only button; its name is spoken, never shown.">
			<View className="flex-row flex-wrap items-center gap-3">
				<IconButton icon={HeartIcon} label={liked ? "Unlike" : "Like"} variant={liked ? "primary" : "secondary"} onPress={toggleLiked} testID="gallery-icon-like" />
				<IconButton icon={Share2Icon} label="Share" variant="ghost" onPress={noop} />
				<IconButton icon={Share2Icon} label="Share (compact)" size="sm" onPress={noop} />
				<IconButton icon={TrashIcon} label="Delete (busy)" loading onPress={noop} />
				<IconButton icon={TrashIcon} label="Delete (disabled)" disabled onPress={noop} />
			</View>
		</DemoBlock>
	);
}
