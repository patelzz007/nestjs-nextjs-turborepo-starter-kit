"use client";

import * as React from "react";
import { useId, useState } from "react";
import { TimePicker } from "@workspace/ui/components/time-picker";

import { Field, FieldDescription, FieldLabel } from "@workspace/ui/components/field";

export function TimePicker10Example(): React.JSX.Element {
	const id = useId();
	/* Only a committed value reaches this state. Column picks, Now and Clear
     stay a draft in the popover until OK, and closing it discards them, so
     the roster never sees a half-made change. */
	const [shiftStart, setShiftStart] = useState<string | null>("08:00");

	return (
		<div className="mx-auto flex w-full max-w-xs flex-col gap-3">
			<Field>
				<FieldLabel id={`${id}-label`} htmlFor={id}>
					Shift start
				</FieldLabel>
				<TimePicker
					id={id}
					aria-labelledby={`${id}-label`}
					aria-describedby={`${id}-hint`}
					value={shiftStart}
					onValueChange={setShiftStart}
					minuteStep={15}
					/* Also adds OK to the footer, drawn as the primary button. */
					requireConfirm
				/>
				<FieldDescription id={`${id}-hint`}>Changes apply when you press OK.</FieldDescription>
			</Field>
			{/* Announced once per applied change, not on every pick in the
          columns. */}
			<p role="status" className="text-sm text-muted-foreground">
				{shiftStart ? `Shift starts at ${shiftStart}` : "No shift start set"}
			</p>
		</div>
	);
}
