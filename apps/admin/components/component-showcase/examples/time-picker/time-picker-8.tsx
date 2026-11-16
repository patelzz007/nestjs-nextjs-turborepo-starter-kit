"use client";

import * as React from "react";
import { useCallback, useId, useState } from "react";
import { formatTimeValue, parseTimeValue, TimePicker } from "@workspace/ui/components/time-picker";

import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field";

/* The range cannot cross midnight: the start stops at 23:30, so the shortest
   meeting still ends by 23:45, the last 15-minute slot of the day. */
const STEP = 15;
const MINUTES_PER_HOUR = 60;
const LATEST_END = 23 * MINUTES_PER_HOUR + 45;

/* Minutes since midnight, both ways, through the picker's own value format. */
function toMinutes(value: string): number {
	const time = parseTimeValue(value);
	return time ? time.hour * MINUTES_PER_HOUR + time.minute : 0;
}

function fromMinutes(minutes: number): string {
	return formatTimeValue({
		hour: Math.floor(minutes / MINUTES_PER_HOUR),
		minute: minutes % MINUTES_PER_HOUR,
		second: 0,
	});
}

/* Plain text rather than Intl, so the server and the browser agree. */
function formatDuration(minutes: number): string {
	const hours = Math.floor(minutes / MINUTES_PER_HOUR);
	const rest = minutes % MINUTES_PER_HOUR;
	if (hours === 0) {
		return `${String(rest)} min`;
	}
	return rest === 0 ? `${String(hours)} h` : `${String(hours)} h ${String(rest)} min`;
}

export function TimePicker8Example(): React.JSX.Element {
	const id = useId();
	const [start, setStart] = useState<string | null>("09:00");
	const [end, setEnd] = useState<string | null>("10:00");

	const changeStart = useCallback(
		(next: string | null): void => {
			setStart(next);
			if (next === null || end === null) {
				return;
			}
			/* The end moves by the same amount, so the meeting keeps its length.
       After a Clear there is no old start to shift from, so the end is only
       pushed past the new start when it would otherwise sit before it. */
			const shift = start ? toMinutes(next) - toMinutes(start) : 0;
			const shifted = Math.max(toMinutes(end) + shift, toMinutes(next) + STEP);
			setEnd(fromMinutes(Math.min(shifted, LATEST_END)));
		},
		[end, start],
	);

	return (
		<div className="flex w-full max-w-sm flex-col gap-3">
			<FieldGroup className="grid grid-cols-2">
				<Field>
					<FieldLabel id={`${id}-start-label`} htmlFor={`${id}-start`}>
						Start
					</FieldLabel>
					<TimePicker id={`${id}-start`} minuteStep={STEP} max="23:30" value={start} onValueChange={changeStart} aria-labelledby={`${id}-start-label`} />
				</Field>
				<Field>
					<FieldLabel id={`${id}-end-label`} htmlFor={`${id}-end`}>
						End
					</FieldLabel>
					{/* A `min` that follows the start disables every earlier slot, so
              the duration can never reach zero or go negative. */}
					<TimePicker
						id={`${id}-end`}
						minuteStep={STEP}
						min={start ? fromMinutes(toMinutes(start) + STEP) : undefined}
						value={end}
						onValueChange={setEnd}
						aria-labelledby={`${id}-end-label`}
					/>
				</Field>
			</FieldGroup>
			<p role="status" className="text-sm text-muted-foreground">
				{start && end ? `Duration: ${formatDuration(toMinutes(end) - toMinutes(start))}` : "Pick a start and an end time"}
			</p>
		</div>
	);
}
