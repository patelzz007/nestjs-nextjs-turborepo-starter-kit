"use client";

import * as React from "react";
import { useId, useState } from "react";
import { TimePicker, TimePickerContent, TimePickerInput } from "@workspace/ui/components/time-picker";

import { Field, FieldDescription, FieldLabel } from "@workspace/ui/components/field";

export function TimePicker3Example(): React.JSX.Element {
	const id = useId();
	const [value, setValue] = useState<string | null>(null);

	return (
		<div className="flex w-full max-w-xs flex-col gap-3">
			<Field>
				{/* `htmlFor` alone is enough: the input speaks its own value. */}
				<FieldLabel htmlFor={id}>Pickup time</FieldLabel>
				<TimePicker id={id} minuteStep={5} value={value} onValueChange={setValue} aria-describedby={`${id}-description`}>
					{/* Typed text commits on blur or Enter; unreadable text reverts.
              The popover anchors on the clock button at the end of the
              field, so `align="end"` keeps it under the field. */}
					<TimePickerInput />
					<TimePickerContent align="end" />
				</TimePicker>
				<FieldDescription id={`${id}-description`}>Type 930, 14:30 or 2:30 pm. Times snap to 5 minutes.</FieldDescription>
			</Field>
			<p role="status" className="text-sm text-muted-foreground">
				{value ? `Pickup at ${value}` : "No pickup time yet"}
			</p>
		</div>
	);
}
