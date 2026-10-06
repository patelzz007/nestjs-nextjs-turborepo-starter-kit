"use client";

import { useForm } from "@tanstack/react-form";
import type { CreateSampleCategoryInput } from "@workspace/shared";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import Link from "next/link";
import * as React from "react";

import { SwitchField, TextField, useFormSubmitHandler } from "@/components/common/form-fields";
import { CategoryFormSchema, type CategoryFormValues } from "@/lib/catalog/form-values";

export interface CategoryFormProps {
	readonly initialValues: CategoryFormValues;
	readonly submitLabel: string;
	readonly isPending: boolean;
	/** Called with values parsed by the shared create contract. */
	readonly onSubmit: (input: CreateSampleCategoryInput) => void;
	readonly cancelHref: string;
}

/**
 * Category create/edit form — TanStack Form validated with `CategoryFormSchema`,
 * which converts the raw inputs and pipes into the shared
 * `CreateSampleCategorySchema`. The caller owns the mutation and navigation.
 */
export function CategoryForm({ initialValues, submitLabel, isPending, onSubmit, cancelHref }: CategoryFormProps): React.JSX.Element {
	const form = useForm({
		defaultValues: initialValues,
		validators: { onSubmit: CategoryFormSchema },
		onSubmit: ({ value }): void => {
			onSubmit(CategoryFormSchema.parse(value));
		},
	});

	const submit = React.useCallback((): Promise<void> => form.handleSubmit(), [form]);
	const handleFormSubmit = useFormSubmitHandler(submit);

	return (
		<form noValidate className="space-y-6" onSubmit={handleFormSubmit}>
			<div className="grid gap-4 sm:grid-cols-2">
				<form.Field name="name">
					{(field) => (
						<TextField id="category-name" label="Name" value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur} errors={field.state.meta.errors} />
					)}
				</form.Field>
				<form.Field name="slug">
					{(field) => (
						<TextField id="category-slug" label="Slug" value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur} errors={field.state.meta.errors} />
					)}
				</form.Field>
				<form.Field name="sortOrder">
					{(field) => (
						<TextField
							id="category-sort-order"
							label="Sort order (optional)"
							inputMode="numeric"
							value={field.state.value}
							onChange={field.handleChange}
							onBlur={field.handleBlur}
							errors={field.state.meta.errors}
						/>
					)}
				</form.Field>
			</div>
			<form.Field name="description">
				{(field) => (
					<TextField
						id="category-description"
						label="Description (optional)"
						multiline
						value={field.state.value}
						onChange={field.handleChange}
						onBlur={field.handleBlur}
						errors={field.state.meta.errors}
					/>
				)}
			</form.Field>
			<form.Field name="isActive">{(field) => <SwitchField id="category-active" label="Active" checked={field.state.value} onChange={field.handleChange} />}</form.Field>
			<div className="flex gap-2">
				<Button type="submit" disabled={isPending}>
					{isPending ? "Saving…" : submitLabel}
				</Button>
				<Link href={cancelHref} className={buttonVariants({ variant: "outline" })}>
					Cancel
				</Link>
			</div>
		</form>
	);
}
