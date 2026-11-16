"use client";

import { useForm } from "@tanstack/react-form";
import { Button } from "@workspace/ui/components/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldSet } from "@workspace/ui/components/field";
import { NumberField, NumberFieldDecrement, NumberFieldGroup, NumberFieldIncrement, NumberFieldInput } from "@workspace/ui/components/number-field";
import { toastMessage } from "@workspace/ui/components/toast";
import * as React from "react";
import { z } from "zod";

import { useFormSubmitHandler } from "@/components/common/form-fields";

/** The accepted amount range, enforced by the schema (the stepper itself allows 0–100). */
const MIN_AMOUNT = 10;
const MAX_AMOUNT = 100;
const STEPPER_MIN = 0;
/** Deliberately below `MIN_AMOUNT`, so the demo opens showing the validation message once edited. */
const DEFAULT_AMOUNT = 5;

const AmountSchema = z
	.number({ message: "Amount must be a number." })
	.min(MIN_AMOUNT, { message: `Amount must be at least ${String(MIN_AMOUNT)}.` })
	.max(MAX_AMOUNT, { message: `Amount must be at most ${String(MAX_AMOUNT)}.` });

/** A cleared number field reports `null`; the refinement turns that into the "must be a number" message. */
const AmountFormSchema = z.object({
	amount: AmountSchema.nullable().refine((amount: number | null): boolean => amount !== null, { message: "Amount must be a number." }),
});

type AmountFormValues = z.input<typeof AmountFormSchema>;

const DEFAULT_VALUES: AmountFormValues = { amount: DEFAULT_AMOUNT };

export function NumberField6Example(): React.JSX.Element {
	const form = useForm({
		defaultValues: DEFAULT_VALUES,
		validators: { onChange: AmountFormSchema },
		onSubmit: ({ value, formApi }): void => {
			toastMessage.success({ title: "Form submitted", description: `Your form has successfully submitted with amount: ${String(value.amount)}` });
			formApi.reset();
		},
	});

	const submit = React.useCallback((): Promise<void> => form.handleSubmit(), [form]);
	const handleFormSubmit = useFormSubmitHandler(submit);
	const handleCancel = React.useCallback((): void => {
		form.reset();
	}, [form]);

	return (
		<div className="w-full max-w-68">
			<form noValidate onSubmit={handleFormSubmit}>
				<FieldGroup>
					<FieldSet>
						<FieldGroup>
							<form.Field name="amount">
								{(field) => (
									<Field data-invalid={!field.state.meta.isValid}>
										<FieldLabel htmlFor="number-field-amount">Amount</FieldLabel>
										<NumberField id="number-field-amount" value={field.state.value} onValueChange={field.handleChange} min={STEPPER_MIN} max={MAX_AMOUNT}>
											<NumberFieldGroup aria-invalid={!field.state.meta.isValid}>
												<NumberFieldDecrement />
												<NumberFieldInput />
												<NumberFieldIncrement />
											</NumberFieldGroup>
										</NumberField>
										<FieldDescription>
											Enter an amount between {String(MIN_AMOUNT)} and {String(MAX_AMOUNT)}.
										</FieldDescription>
										<FieldError errors={field.state.meta.errors} />
									</Field>
								)}
							</form.Field>
						</FieldGroup>
					</FieldSet>
					<Field orientation="horizontal">
						<Button variant="outline" type="button" onClick={handleCancel} className="flex-1">
							Cancel
						</Button>
						<Button type="submit" className="flex-1">
							Submit
						</Button>
					</Field>
				</FieldGroup>
			</form>
		</div>
	);
}
