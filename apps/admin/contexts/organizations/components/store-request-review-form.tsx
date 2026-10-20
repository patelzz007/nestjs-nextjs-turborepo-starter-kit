"use client";

import { useForm } from "@tanstack/react-form";
import { AdminOrganizationLocationReviewSchema, type AdminOrganizationLocationReviewInput } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Check, X } from "lucide-react";
import * as React from "react";
import { z } from "zod";

import { TextField, useFormSubmitHandler } from "@/components/common/form-fields";
import { contractFormSchema, OptionalTextInputSchema } from "@/lib/forms/contract-form-schema";

/** Raw review form → the shared review contract (a rejection needs a reason — the contract's rule, not the form's). */
export const StoreRequestReviewFormSchema = contractFormSchema(
	z.object({ approve: z.boolean(), rejectionReason: OptionalTextInputSchema }),
	AdminOrganizationLocationReviewSchema,
);

export type StoreRequestReviewFormValues = z.input<typeof StoreRequestReviewFormSchema>;

const EMPTY_REVIEW: StoreRequestReviewFormValues = { approve: true, rejectionReason: "" };

export interface StoreRequestReviewFormProps {
	readonly isPending: boolean;
	/** Called with values parsed by the shared review contract. */
	readonly onReview: (review: AdminOrganizationLocationReviewInput) => void;
}

/**
 * Approve / reject one store request. Mount it with `key={request.id}`: the
 * draft rejection reason belongs to that request and never carries over.
 */
export function StoreRequestReviewForm({ isPending, onReview }: StoreRequestReviewFormProps): React.JSX.Element {
	const form = useForm({
		defaultValues: EMPTY_REVIEW,
		validators: { onSubmit: StoreRequestReviewFormSchema },
		onSubmit: ({ value }): void => {
			onReview(StoreRequestReviewFormSchema.parse(value));
		},
	});

	const submitAs = React.useCallback(
		(approve: boolean): Promise<void> => {
			form.setFieldValue("approve", approve);
			return form.handleSubmit();
		},
		[form],
	);
	const approve = React.useCallback((): Promise<void> => submitAs(true), [submitAs]);
	const reject = React.useCallback((): void => {
		void submitAs(false);
	}, [submitAs]);
	const handleFormSubmit = useFormSubmitHandler(approve);

	return (
		<form noValidate className="space-y-4" onSubmit={handleFormSubmit}>
			<form.Field name="rejectionReason">
				{(field) => (
					<TextField
						id="rejection-reason"
						label="Rejection reason"
						multiline
						placeholder="Required only when rejecting"
						value={field.state.value}
						onChange={field.handleChange}
						onBlur={field.handleBlur}
						errors={field.state.meta.errors}
					/>
				)}
			</form.Field>
			<div className="flex flex-wrap gap-2">
				<Button type="submit" disabled={isPending}>
					<Check className="size-4" aria-hidden="true" />
					Approve store
				</Button>
				<Button type="button" variant="destructive" onClick={reject} disabled={isPending}>
					<X className="size-4" aria-hidden="true" />
					Reject
				</Button>
			</div>
		</form>
	);
}
