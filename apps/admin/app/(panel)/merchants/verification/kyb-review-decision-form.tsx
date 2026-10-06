"use client";

import { useForm } from "@tanstack/react-form";
import { KybStatusSchema, type JsonObject, type KybStatus } from "@workspace/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Button } from "@workspace/ui/components/button";
import { Check, ShieldCheck, X } from "lucide-react";
import * as React from "react";

import { OptionSelectField, TextField, useFormSubmitHandler } from "@/components/common/form-fields";
import { KYB_STATUS_LABELS } from "@/lib/data-table/enum-filter-options";
import { KybReviewFormSchema, toKybReviewFormValues, type KybReviewDecision } from "@/lib/merchants/kyb-review-form";

function kybStatusLabel(status: KybStatus): string {
	return KYB_STATUS_LABELS[status];
}

export interface KybReviewDecisionFormProps {
	readonly kybStatus: KybStatus;
	readonly kybFields: JsonObject | null;
	readonly isSaving: boolean;
	readonly onSubmitReview: (decision: KybReviewDecision) => void;
}

/**
 * The KYB decision form (TanStack Form + `KybReviewFormSchema`). Mount it
 * with `key={merchant.id + version}`: the draft belongs to one merchant and
 * never carries over to another.
 */
export function KybReviewDecisionForm({ kybStatus, kybFields, isSaving, onSubmitReview }: KybReviewDecisionFormProps): React.JSX.Element {
	const form = useForm({
		defaultValues: toKybReviewFormValues(kybStatus, kybFields),
		validators: { onSubmit: KybReviewFormSchema },
		onSubmit: ({ value }): void => {
			onSubmitReview(KybReviewFormSchema.parse(value));
		},
	});

	const submit = React.useCallback((): Promise<void> => form.handleSubmit(), [form]);
	const submitAs = React.useCallback(
		(status: KybStatus): void => {
			form.setFieldValue("kybStatus", status);
			void form.handleSubmit();
		},
		[form],
	);
	const handleApprove = React.useCallback((): void => {
		submitAs(KybStatusSchema.enum.APPROVED);
	}, [submitAs]);
	const handleReject = React.useCallback((): void => {
		submitAs(KybStatusSchema.enum.REJECTED);
	}, [submitAs]);
	const handleFormSubmit = useFormSubmitHandler(submit);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Review decision</CardTitle>
				<CardDescription>Update verification fields, add notes, and approve or reject the merchant.</CardDescription>
			</CardHeader>
			<CardContent className="min-w-0">
				<form noValidate className="grid min-w-0 gap-6" onSubmit={handleFormSubmit}>
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						<form.Field name="registrationNo">
							{(field) => (
								<TextField
									id="kyb-registration-no"
									label="SSM / registration number"
									placeholder="201901012345"
									value={field.state.value}
									onChange={field.handleChange}
									onBlur={field.handleBlur}
									errors={field.state.meta.errors}
								/>
							)}
						</form.Field>
						<form.Field name="taxId">
							{(field) => (
								<TextField
									id="kyb-tax-id"
									label="Tax ID"
									placeholder="C12345678"
									value={field.state.value}
									onChange={field.handleChange}
									onBlur={field.handleBlur}
									errors={field.state.meta.errors}
								/>
							)}
						</form.Field>
						<form.Field name="documentType">
							{(field) => (
								<TextField
									id="kyb-document-type"
									label="Document type"
									placeholder="SSM certificate"
									value={field.state.value}
									onChange={field.handleChange}
									onBlur={field.handleBlur}
									errors={field.state.meta.errors}
								/>
							)}
						</form.Field>
						<form.Field name="kybStatus">
							{(field) => (
								<OptionSelectField
									id="kyb-status"
									label="KYB status"
									value={field.state.value}
									options={KybStatusSchema.options}
									labelOf={kybStatusLabel}
									onChange={field.handleChange}
									errors={field.state.meta.errors}
								/>
							)}
						</form.Field>
					</div>
					<form.Field name="reviewNotes">
						{(field) => (
							<TextField
								id="kyb-review-notes"
								label="Internal review notes"
								multiline
								placeholder="Notes for other admins (stored in KYB payload)."
								value={field.state.value}
								onChange={field.handleChange}
								onBlur={field.handleBlur}
								errors={field.state.meta.errors}
							/>
						)}
					</form.Field>
					<form.Field name="rejectionReason">
						{(field) => (
							<TextField
								id="kyb-rejection-reason"
								label="Rejection reason"
								multiline
								placeholder="Required when rejecting or asking for action — shared with the merchant team."
								value={field.state.value}
								onChange={field.handleChange}
								onBlur={field.handleBlur}
								errors={field.state.meta.errors}
							/>
						)}
					</form.Field>
					<div className="flex flex-col-reverse gap-3 sm:flex-row sm:flex-wrap sm:justify-between">
						<Button type="submit" disabled={isSaving}>
							<ShieldCheck className="mr-2 size-4" aria-hidden="true" />
							{isSaving ? "Saving…" : "Save review"}
						</Button>
						<div className="flex flex-col gap-2 sm:flex-row">
							<Button type="button" variant="outline" disabled={isSaving} onClick={handleReject}>
								<X className="mr-2 size-4" aria-hidden="true" />
								Reject
							</Button>
							<Button type="button" disabled={isSaving} onClick={handleApprove}>
								<Check className="mr-2 size-4" aria-hidden="true" />
								Approve
							</Button>
						</div>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}
