"use client";

import { Button } from "@workspace/ui/components/button";
import { Calendar } from "@workspace/ui/components/calendar";
import { Card, CardContent, CardFooter } from "@workspace/ui/components/card";
import { addDays, startOfMonth, startOfToday } from "date-fns";
import type * as React from "react";
import { useCallback, useState } from "react";

interface ForwardPreset {
	readonly label: string;
	/** Days ahead of today. */
	readonly days: number;
}

const FORWARD_PRESETS: readonly ForwardPreset[] = [
	{ label: "Today", days: 0 },
	{ label: "Tomorrow", days: 1 },
	{ label: "3 days", days: 3 },
	{ label: "Week", days: 7 },
	{ label: "2 weeks", days: 14 },
];

/** The sample selection: 12 February of this year (`Date` months are 0-based). */
const FEBRUARY = 1;
const SAMPLE_DAY = 12;

function initialSelection(): Date {
	return new Date(startOfToday().getFullYear(), FEBRUARY, SAMPLE_DAY);
}

function currentMonth(): Date {
	return startOfMonth(startOfToday());
}

interface ForwardPresetButtonProps {
	readonly preset: ForwardPreset;
	readonly onPick: (days: number) => void;
}

function ForwardPresetButton({ preset, onPick }: ForwardPresetButtonProps): React.JSX.Element {
	const handleClick = useCallback((): void => {
		onPick(preset.days);
	}, [onPick, preset.days]);

	return (
		<Button className="flex-1" onClick={handleClick} size="sm" variant="outline">
			{preset.label}
		</Button>
	);
}

export function Calendar18Example(): React.JSX.Element {
	const [date, setDate] = useState<Date | undefined>(initialSelection);
	const [month, setMonth] = useState<Date>(currentMonth);

	const pickPreset = useCallback((days: number): void => {
		const newDate = addDays(startOfToday(), days);
		setDate(newDate);
		setMonth(startOfMonth(newDate));
	}, []);

	return (
		<Card className="mx-auto w-fit max-w-[300px]" size="sm">
			<CardContent>
				<Calendar className="p-0 [--cell-size:--spacing(9.5)]" fixedWeeks mode="single" month={month} onMonthChange={setMonth} onSelect={setDate} selected={date} />
			</CardContent>
			<CardFooter className="flex flex-wrap gap-2 border-t">
				{FORWARD_PRESETS.map((preset: ForwardPreset): React.JSX.Element => (
					<ForwardPresetButton key={preset.label} onPick={pickPreset} preset={preset} />
				))}
			</CardFooter>
		</Card>
	);
}
