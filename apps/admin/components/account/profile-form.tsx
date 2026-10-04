"use client";

import { useForm } from "@tanstack/react-form";
import { OwnProfileEditableFieldsSchema, type OwnProfileEditableFields } from "@workspace/shared";
import { Button } from "@workspace/ui/components/form/button";
import * as React from "react";

import { TextField, useFormSubmitHandler } from "@/components/common/form-fields";

export interface ProfileFormProps {
	/** The profile's current editable values (the form resets when the caller remounts it with a new version). */
	readonly initialValues: OwnProfileEditableFields;
	readonly isPending: boolean;
	/** Read-only (e.g. during impersonation): the fields are shown, nothing can be submitted. */
	readonly isReadOnly: boolean;
	/** Called with values parsed by the shared `OwnProfileEditableFieldsSchema` (trimmed). */
	readonly onSubmit: (values: OwnProfileEditableFields) => void;
}

/**
 * Own-profile form — TanStack Form validated with the SAME shared schema the
 * API validates `PATCH /auth/profile` with. Data-agnostic: the caller owns the
 * query, the mutation, the optimistic-lock `version` and the toasts.
 */
export function ProfileForm({ initialValues, isPending, isReadOnly, onSubmit }: ProfileFormProps): React.JSX.Element {
	const form = useForm({
		defaultValues: initialValues,
		validators: { onChange: OwnProfileEditableFieldsSchema },
		onSubmit: ({ value }): void => {
			onSubmit(OwnProfileEditableFieldsSchema.parse(value));
		},
	});

	const submit = React.useCallback((): Promise<void> => form.handleSubmit(), [form]);
	const handleFormSubmit = useFormSubmitHandler(submit);

	return (
		<form noValidate className="space-y-5" onSubmit={handleFormSubmit}>
			<fieldset disabled={isReadOnly} className="space-y-5">
				<form.Field name="fullName">
					{(field) => (
						<TextField
							id="profile-full-name"
							label="Full name"
							value={field.state.value}
							onChange={field.handleChange}
							onBlur={field.handleBlur}
							errors={field.state.meta.errors}
						/>
					)}
				</form.Field>
			</fieldset>
			<Button type="submit" disabled={isPending || isReadOnly}>
				{isPending ? "Saving…" : "Save changes"}
			</Button>
		</form>
	);
}
