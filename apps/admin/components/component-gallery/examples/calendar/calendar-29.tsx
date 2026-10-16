"use client";

import { Button } from "@workspace/ui/components/button";
import { Calendar } from "@workspace/ui/components/calendar";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { cn } from "@workspace/ui/lib/core/utils";
import { endOfMonth, endOfYear, format, startOfMonth, startOfToday, startOfYear, subDays, subMonths, subYears } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type * as React from "react";
import { useCallback, useMemo, useState } from "react";

/** react-day-picker's range value and `disabled` matchers, read off the kit Calendar's own props. */
type DateRange = NonNullable<Extract<React.ComponentProps<typeof Calendar>, { mode: "range" }>["selected"]>;
type DisabledMatchers = React.ComponentProps<typeof Calendar>["disabled"];

/** A preset range: both ends are always set. */
interface RangePreset {
	readonly id: string;
	readonly label: string;
	readonly from: Date;
	readonly to: Date;
}

/** One step back for "yesterday", "last month" and "last year". */
const ONE = 1;
/** "Last 7 days" / "last 30 days" include today, so they reach back one day fewer. */
const LAST_7_DAYS_BACK = 6;
const LAST_30_DAYS_BACK = 29;
const RANGE_END_FORMAT = "LLL dd, y";

const TRIGGER_BUTTON = <Button className="group/pick-date w-60 justify-between" variant="outline" />;

function rangePresets(today: Date): readonly RangePreset[] {
	const yesterday = subDays(today, ONE);
	const previousMonth = subMonths(today, ONE);
	const previousYear = subYears(today, ONE);
	return [
		{ id: "today", label: "Today", from: today, to: today },
		{ id: "yesterday", label: "Yesterday", from: yesterday, to: yesterday },
		{ id: "last-7-days", label: "Last 7 days", from: subDays(today, LAST_7_DAYS_BACK), to: today },
		{ id: "last-30-days", label: "Last 30 days", from: subDays(today, LAST_30_DAYS_BACK), to: today },
		{ id: "month-to-date", label: "Month to date", from: startOfMonth(today), to: today },
		{ id: "last-month", label: "Last month", from: startOfMonth(previousMonth), to: endOfMonth(previousMonth) },
		{ id: "year-to-date", label: "Year to date", from: startOfYear(today), to: today },
		{ id: "last-year", label: "Last year", from: startOfYear(previousYear), to: endOfYear(previousYear) },
	];
}

/** The trigger's text: both ends, the start alone while picking, or a prompt. */
function rangeLabel(range: DateRange | undefined): string {
	if (range?.from === undefined) {
		return "Pick a date range";
	}
	const start = format(range.from, RANGE_END_FORMAT);
	return range.to === undefined ? start : `${start} - ${format(range.to, RANGE_END_FORMAT)}`;
}

interface RangePresetButtonProps {
	readonly preset: RangePreset;
	readonly onPick: (preset: RangePreset) => void;
}

function RangePresetButton({ preset, onPick }: RangePresetButtonProps): React.JSX.Element {
	const handleClick = useCallback((): void => {
		onPick(preset);
	}, [onPick, preset]);

	return (
		<Button className="w-full justify-start" onClick={handleClick} size="sm" variant="ghost">
			{preset.label}
		</Button>
	);
}

function initialRange(): DateRange {
	const today = startOfToday();
	return { from: subDays(today, LAST_7_DAYS_BACK), to: today };
}

export function Calendar29Example(): React.JSX.Element {
	const [today] = useState<Date>(startOfToday);
	const [month, setMonth] = useState<Date>(today);
	const [date, setDate] = useState<DateRange | undefined>(initialRange);
	const presets = useMemo((): readonly RangePreset[] => rangePresets(today), [today]);
	const disabled = useMemo((): DisabledMatchers => [{ after: today }], [today]);

	const pickPreset = useCallback((preset: RangePreset): void => {
		setDate({ from: preset.from, to: preset.to });
		setMonth(preset.to);
	}, []);

	const handleSelect = useCallback((newDate: DateRange | undefined): void => {
		if (newDate !== undefined) {
			setDate(newDate);
		}
	}, []);

	return (
		<Popover>
			<PopoverTrigger render={TRIGGER_BUTTON}>
				<span className={cn("truncate", date === undefined && "text-muted-foreground")}>{rangeLabel(date)}</span>
				<CalendarIcon aria-hidden="true" className="shrink-0 text-muted-foreground/80 transition-colors group-hover:text-foreground" />
			</PopoverTrigger>
			<PopoverContent align="start" className="w-auto p-0">
				<Card className="p-0">
					<CardContent className="p-0">
						<div className="flex max-sm:flex-col">
							<div className="relative py-4 max-sm:order-1 max-sm:border-t sm:w-32">
								<div className="h-full sm:border-e">
									<div className="flex flex-col px-2">
										{presets.map((preset: RangePreset): React.JSX.Element => (
											<RangePresetButton key={preset.id} onPick={pickPreset} preset={preset} />
										))}
									</div>
								</div>
							</div>
							<Calendar disabled={disabled} mode="range" month={month} onMonthChange={setMonth} onSelect={handleSelect} selected={date} />
						</div>
					</CardContent>
				</Card>
			</PopoverContent>
		</Popover>
	);
}
