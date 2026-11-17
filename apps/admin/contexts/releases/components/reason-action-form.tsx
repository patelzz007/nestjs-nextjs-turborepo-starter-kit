"use client";

import { useForm } from "@tanstack/react-form";
import { ChangeReasonSchema } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import * as React from "react";
import { z } from "zod";

import { TextField, useFormSubmitHandler } from "@/components/common/form-fields";

const ReasonFormSchema = z.object({ reason: ChangeReasonSchema });

export interface ReasonActionFormProps {
	readonly id: string;
	/** What the reason is for, as the field's label. */
	readonly label: string;
	readonly submitLabel: string;
	readonly placeholder: string;
	readonly destructive?: boolean;
	readonly pending: boolean;
	readonly onSubmit: (reason: string) => Promise<void>;
}

/**
 * One action that needs a reason (a kill switch, an approval, removing an override): every change to a flag is
 * kept with why it was made. Clears itself once the action succeeds.
 */
export function ReasonActionForm({ id, label, submitLabel, placeholder, destructive = false, pending, onSubmit }: ReasonActionFormProps): React.JSX.Element {
	const form = useForm({
		defaultValues: { reason: "" },
		validators: { onSubmit: ReasonFormSchema },
		onSubmit: async ({ value, formApi }): Promise<void> => {
			await onSubmit(ReasonFormSchema.parse(value).reason);
			formApi.reset();
		},
	});
	const submit = React.useCallback((): Promise<void> => form.handleSubmit(), [form]);
	const handleSubmit = useFormSubmitHandler(submit);
	return (
		<form noValidate className="flex flex-col gap-3" onSubmit={handleSubmit}>
			<form.Field name="reason">
				{(field) => (
					<TextField
						id={id}
						label={label}
						value={field.state.value}
						onChange={field.handleChange}
						onBlur={field.handleBlur}
						errors={field.state.meta.errors}
						placeholder={placeholder}
					/>
				)}
			</form.Field>
			<div>
				<Button type="submit" size="sm" variant={destructive ? "destructive" : "default"} disabled={pending}>
					{submitLabel}
				</Button>
			</div>
		</form>
	);
}
