"use client";

import { Button } from "@workspace/ui/components/button";
import { Calendar } from "@workspace/ui/components/calendar";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { format, startOfToday, subDays, subMonths, subWeeks, subYears } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type * as React from "react";
import { useCallback, useMemo, useState } from "react";

/** react-day-picker's `disabled` matchers, read off the kit Calendar's own props. */
type DisabledMatchers = React.ComponentProps<typeof Calendar>["disabled"];

interface DatePreset {
	readonly id: string;
	readonly label: string;
	readonly date: Date;
}

/** One step back for each preset. */
const ONE = 1;

const TRIGGER_BUTTON = <Button className="group/pick-date w-60 justify-between" variant="outline" />;

function datePresets(today: Date): readonly DatePreset[] {
	return [
		{ id: "today", label: "Today", date: today },
		{ id: "yesterday", label: "Yesterday", date: subDays(today, ONE) },
		{ id: "last-week", label: "Last week", date: subWeeks(today, ONE) },
		{ id: "last-month", label: "Last month", date: subMonths(today, ONE) },
		{ id: "last-year", label: "Last year", date: subYears(today, ONE) },
	];
}

interface DatePresetButtonProps {
	readonly preset: DatePreset;
	readonly onPick: (date: Date) => void;
}

function DatePresetButton({ preset, onPick }: DatePresetButtonProps): React.JSX.Element {
	const handleClick = useCallback((): void => {
		onPick(preset.date);
	}, [onPick, preset.date]);

	return (
		<Button className="w-full justify-start" onClick={handleClick} size="sm" variant="ghost">
			{preset.label}
		</Button>
	);
}

export function Calendar28Example(): React.JSX.Element {
	const [today] = useState<Date>(startOfToday);
	const [month, setMonth] = useState<Date>(today);
	const [date, setDate] = useState<Date>(today);
	const presets = useMemo((): readonly DatePreset[] => datePresets(today), [today]);
	const disabled = useMemo((): DisabledMatchers => [{ after: today }], [today]);

	const pickPreset = useCallback((presetDate: Date): void => {
		setDate(presetDate);
		setMonth(presetDate);
	}, []);

	const handleSelect = useCallback((newDate: Date | undefined): void => {
		if (newDate !== undefined) {
			setDate(newDate);
		}
	}, []);

	return (
		<Popover>
			<PopoverTrigger render={TRIGGER_BUTTON}>
				<span className="truncate">{format(date, "LLL dd, y")}</span>
				<CalendarIcon aria-hidden="true" className="shrink-0 text-muted-foreground/80 transition-colors group-hover:text-foreground" />
			</PopoverTrigger>
			<PopoverContent align="start" className="w-auto p-0">
				<Card className="p-0">
					<CardContent className="p-0">
						<div className="flex max-sm:flex-col">
							<div className="relative py-4 max-sm:order-1 max-sm:border-t sm:w-32">
								<div className="h-full sm:border-e">
									<div className="flex flex-col px-2">
										{presets.map((preset: DatePreset): React.JSX.Element => (
											<DatePresetButton key={preset.id} onPick={pickPreset} preset={preset} />
										))}
									</div>
								</div>
							</div>
							<Calendar disabled={disabled} mode="single" month={month} onMonthChange={setMonth} onSelect={handleSelect} selected={date} />
						</div>
					</CardContent>
				</Card>
			</PopoverContent>
		</Popover>
	);
}
