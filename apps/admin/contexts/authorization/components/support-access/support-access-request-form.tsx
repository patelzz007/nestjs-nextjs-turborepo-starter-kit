"use client";

import { useForm } from "@tanstack/react-form";
import { SupportAccessGrantModeSchema, SupportAccessGrantRequestSchema, type SupportAccessGrantMode, type SupportAccessGrantRequestInput } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import * as React from "react";
import { z } from "zod";

import { OptionSelectField, TextField, useFormSubmitHandler } from "@/components/common/form-fields";
import { MerchantPicker } from "@/contexts/tenancy";
import { contractFormSchema, OptionalTextInputSchema } from "@workspace/client/lib/forms/contract-form-schema";

/** Grant lengths the form offers, in minutes (the contract allows 15–480). */
const DURATION_OPTIONS: readonly ["30", "60", "120", "240", "480"] = ["30", "60", "120", "240", "480"];
type DurationOption = (typeof DURATION_OPTIONS)[number];

const MODE_LABELS: Readonly<Record<SupportAccessGrantMode, string>> = {
	READ_ONLY: "Read only",
	WRITE_ELEVATED: "Read and write (elevated)",
};

function durationLabel(option: DurationOption): string {
	const minutes = Number(option);
	return minutes < 60 ? `${option} minutes` : `${String(minutes / 60)} hour${minutes === 60 ? "" : "s"}`;
}

function modeLabel(mode: SupportAccessGrantMode): string {
	return MODE_LABELS[mode];
}

/** Raw request form → the shared support access request contract (same rules as the API). */
export const SupportAccessRequestFormSchema = contractFormSchema(
	z.object({
		tenantId: z.string(),
		mode: SupportAccessGrantModeSchema,
		durationMinutes: z.enum(DURATION_OPTIONS).transform(Number),
		reason: z.string().trim(),
		ticketRef: OptionalTextInputSchema,
	}),
	SupportAccessGrantRequestSchema,
);

export type SupportAccessRequestFormValues = z.input<typeof SupportAccessRequestFormSchema>;

const EMPTY_REQUEST: SupportAccessRequestFormValues = { tenantId: "", mode: "READ_ONLY", durationMinutes: "60", reason: "", ticketRef: "" };

export interface SupportAccessRequestFormProps {
	readonly isPending: boolean;
	/** Called with values parsed by the shared request contract; resolves once the grant was requested. */
	readonly onRequest: (request: SupportAccessGrantRequestInput) => Promise<void>;
}

/** Request just-in-time access to one tenant: the tenant's owner must approve it before it works. */
export function SupportAccessRequestForm({ isPending, onRequest }: SupportAccessRequestFormProps): React.JSX.Element {
	const form = useForm({
		defaultValues: EMPTY_REQUEST,
		validators: { onSubmit: SupportAccessRequestFormSchema },
		onSubmit: async ({ value, formApi }): Promise<void> => {
			await onRequest(SupportAccessRequestFormSchema.parse(value));
			formApi.reset();
		},
	});
	const submit = React.useCallback((): Promise<void> => form.handleSubmit(), [form]);
	const handleFormSubmit = useFormSubmitHandler(submit);

	return (
		<form noValidate className="space-y-4" onSubmit={handleFormSubmit}>
			<form.Field name="tenantId">
				{(field) => (
					<div className="space-y-2">
						<Label htmlFor="support-access-tenant">Merchant</Label>
						<MerchantPicker id="support-access-tenant" value={field.state.value} onChange={field.handleChange} selectedName={undefined} />
						{field.state.meta.errors.length > 0 ? (
							<p role="alert" className="text-sm text-destructive">
								Choose a merchant.
							</p>
						) : null}
					</div>
				)}
			</form.Field>
			<div className="grid gap-4 sm:grid-cols-2">
				<form.Field name="mode">
					{(field) => (
						<OptionSelectField
							id="support-access-mode"
							label="Access"
							value={field.state.value}
							options={SupportAccessGrantModeSchema.options}
							onChange={field.handleChange}
							labelOf={modeLabel}
							errors={field.state.meta.errors}
						/>
					)}
				</form.Field>
				<form.Field name="durationMinutes">
					{(field) => (
						<OptionSelectField
							id="support-access-duration"
							label="For"
							value={field.state.value}
							options={DURATION_OPTIONS}
							onChange={field.handleChange}
							labelOf={durationLabel}
							errors={field.state.meta.errors}
						/>
					)}
				</form.Field>
			</div>
			<form.Field name="reason">
				{(field) => (
					<TextField
						id="support-access-reason"
						label="Reason (the owner sees it)"
						multiline
						value={field.state.value}
						onChange={field.handleChange}
						onBlur={field.handleBlur}
						errors={field.state.meta.errors}
					/>
				)}
			</form.Field>
			<form.Field name="ticketRef">
				{(field) => (
					<TextField
						id="support-access-ticket"
						label="Support ticket (optional)"
						value={field.state.value}
						onChange={field.handleChange}
						onBlur={field.handleBlur}
						errors={field.state.meta.errors}
					/>
				)}
			</form.Field>
			<Button type="submit" disabled={isPending}>
				Request access
			</Button>
		</form>
	);
}
