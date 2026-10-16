"use client";

import * as React from "react";
import { useCallback, useId, useState } from "react";
import { z } from "zod";
import { TimePicker } from "@workspace/ui/components/time-picker";

import { Button } from "@workspace/ui/components/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@workspace/ui/components/field";

/** The picker's field, as submitted with the form. */
const DeliveryFormSchema = z.object({ deliveryTime: z.string() });
const SLOT_MINUTES = 30;

export function TimePicker12Example(): React.JSX.Element {
	const id = useId();
	const [invalid, setInvalid] = useState(false);
	const [booked, setBooked] = useState<string | null>(null);

	const handleSubmit = useCallback((event: React.SubmitEvent<HTMLFormElement>): void => {
		event.preventDefault();
		/* The picker submits `HH:mm` under its `name`, or "" while empty. */
		const parsed = DeliveryFormSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
		const time = parsed.success ? parsed.data.deliveryTime : "";
		setInvalid(time === "");
		setBooked(time === "" ? null : time);
	}, []);
	const handleReset = useCallback((): void => {
		/* The picker returns to its default (empty) on the same reset. */
		setInvalid(false);
		setBooked(null);
	}, []);
	const handleValueChange = useCallback((next: string | null): void => {
		/* A pick clears the error; emptying the field waits for Submit. */
		if (next !== null && next !== "") {
			setInvalid(false);
		}
	}, []);

	return (
		/* `noValidate`: the Field draws the error, not the browser bubble. */
		<form noValidate className="mx-auto w-full max-w-sm" onSubmit={handleSubmit} onReset={handleReset}>
			<FieldGroup>
				<Field data-invalid={invalid || undefined}>
					<FieldLabel id={`${id}-label`} htmlFor={id}>
						Delivery time
					</FieldLabel>
					<TimePicker
						id={id}
						name="deliveryTime"
						required
						/* Sets aria-invalid on the trigger; the Field colors the label. */
						invalid={invalid}
						minuteStep={SLOT_MINUTES}
						min="08:00"
						max="20:00"
						aria-labelledby={`${id}-label`}
						aria-describedby={`${id}-hint`}
						onValueChange={handleValueChange}
					/>
					{/* One id for both, so aria-describedby follows whichever is shown. */}
					{invalid ? (
						<FieldError id={`${id}-hint`}>Choose a delivery time to continue.</FieldError>
					) : (
						<FieldDescription id={`${id}-hint`}>30-minute slots between 08:00 and 20:00.</FieldDescription>
					)}
				</Field>
				<div className="flex items-center gap-2">
					<Button type="submit">Submit</Button>
					<Button type="reset" variant="outline">
						Reset
					</Button>
					<p role="status" className="ms-auto min-w-0 truncate text-sm text-muted-foreground">
						{booked ? `Delivery booked for ${booked}` : null}
					</p>
				</div>
			</FieldGroup>
		</form>
	);
}
