"use client";

import * as React from "react";
import { useCallback, useId, useState } from "react";
import { z } from "zod";
import { ColorPicker, ColorPickerContent, ColorPickerInput } from "@workspace/ui/components/color-picker";

import { Button } from "@workspace/ui/components/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@workspace/ui/components/field";

/** The picker's field, as submitted with the form. */
const BrandFormSchema = z.object({ brandColor: z.string() });

export function ColorPicker15Example(): React.JSX.Element {
	const id = useId();
	const [invalid, setInvalid] = useState(false);
	const [saved, setSaved] = useState<string | null>(null);

	const handleSubmit = useCallback((event: React.SubmitEvent<HTMLFormElement>): void => {
		event.preventDefault();
		/* The picker submits its value under `name`, or "" while empty. */
		const parsed = BrandFormSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
		const color = parsed.success ? parsed.data.brandColor : "";
		setInvalid(color === "");
		setSaved(color === "" ? null : color);
	}, []);
	const handleReset = useCallback((): void => {
		/* The picker returns to its default (empty) on the same reset. */
		setInvalid(false);
		setSaved(null);
	}, []);
	const handleValueChange = useCallback((next: string | null): void => {
		if (next !== null && next !== "") {
			setInvalid(false);
		}
	}, []);

	return (
		/* `noValidate`: the Field draws the error, not the browser bubble. */
		<form noValidate className="mx-auto w-full max-w-sm" onSubmit={handleSubmit} onReset={handleReset}>
			<FieldGroup>
				<Field data-invalid={invalid || undefined}>
					<FieldLabel htmlFor={id}>Brand color</FieldLabel>
					<ColorPicker id={id} name="brandColor" required invalid={invalid} aria-describedby={`${id}-hint`} onValueChange={handleValueChange}>
						<ColorPickerInput placeholder="Type or pick a color" />
						<ColorPickerContent />
					</ColorPicker>
					{/* One id for both, so aria-describedby follows whichever shows. */}
					{invalid ? (
						<FieldError id={`${id}-hint`}>Choose a brand color to continue.</FieldError>
					) : (
						<FieldDescription id={`${id}-hint`}>Used on the login page, emails and invoices.</FieldDescription>
					)}
				</Field>
				<div className="flex items-center gap-2">
					<Button type="submit">Save</Button>
					<Button type="reset" variant="outline">
						Reset
					</Button>
					<p role="status" className="ms-auto min-w-0 truncate text-sm text-muted-foreground">
						{saved ? `Saved ${saved.toUpperCase()}` : null}
					</p>
				</div>
			</FieldGroup>
		</form>
	);
}
