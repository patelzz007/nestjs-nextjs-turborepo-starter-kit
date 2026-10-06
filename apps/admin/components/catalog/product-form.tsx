"use client";

import { useForm } from "@tanstack/react-form";
import type { CreateProductInput } from "@workspace/shared";
import { FieldError } from "@workspace/ui/components/field";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import Link from "next/link";
import * as React from "react";

import { CategoryPicker } from "@/components/catalog/category-picker";
import { SwitchField, TextField, useFormSubmitHandler } from "@/components/common/form-fields";
import { ProductFormSchema, type ProductFormValues } from "@/lib/catalog/form-values";

export interface ProductFormProps {
	readonly initialValues: ProductFormValues;
	readonly submitLabel: string;
	readonly isPending: boolean;
	/** Called with values parsed by the shared create contract. */
	readonly onSubmit: (input: CreateProductInput) => void;
	readonly cancelHref: string;
}

/**
 * Product create/edit form — TanStack Form validated with `ProductFormSchema`,
 * which converts the raw inputs and pipes into the shared `CreateProductSchema`.
 * Owns only the field state; the caller owns the mutation and navigation.
 */
export function ProductForm({ initialValues, submitLabel, isPending, onSubmit, cancelHref }: ProductFormProps): React.JSX.Element {
	const form = useForm({
		defaultValues: initialValues,
		validators: { onSubmit: ProductFormSchema },
		onSubmit: ({ value }): void => {
			onSubmit(ProductFormSchema.parse(value));
		},
	});

	const submit = React.useCallback((): Promise<void> => form.handleSubmit(), [form]);
	const handleFormSubmit = useFormSubmitHandler(submit);

	return (
		<form noValidate className="space-y-6" onSubmit={handleFormSubmit}>
			<div className="grid gap-4 sm:grid-cols-2">
				<form.Field name="name">
					{(field) => (
						<TextField id="product-name" label="Name" value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur} errors={field.state.meta.errors} />
					)}
				</form.Field>
				<form.Field name="slug">
					{(field) => (
						<TextField id="product-slug" label="Slug" value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur} errors={field.state.meta.errors} />
					)}
				</form.Field>
				<form.Field name="sku">
					{(field) => (
						<TextField id="product-sku" label="SKU" value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur} errors={field.state.meta.errors} />
					)}
				</form.Field>
				<form.Field name="categoryId">
					{(field) => (
						<div className="space-y-1.5">
							<Label htmlFor="product-category">Category</Label>
							<CategoryPicker id="product-category" value={field.state.value} onChange={field.handleChange} invalid={field.state.meta.errors.length > 0} />
							<FieldError errors={field.state.meta.errors} />
						</div>
					)}
				</form.Field>
				<form.Field name="price">
					{(field) => (
						<TextField
							id="product-price"
							label="Price"
							inputMode="decimal"
							value={field.state.value}
							onChange={field.handleChange}
							onBlur={field.handleBlur}
							errors={field.state.meta.errors}
						/>
					)}
				</form.Field>
				<form.Field name="compareAtPrice">
					{(field) => (
						<TextField
							id="product-compare-at-price"
							label="Compare-at price (optional)"
							inputMode="decimal"
							value={field.state.value}
							onChange={field.handleChange}
							onBlur={field.handleBlur}
							errors={field.state.meta.errors}
						/>
					)}
				</form.Field>
				<form.Field name="stockQuantity">
					{(field) => (
						<TextField
							id="product-stock"
							label="Stock quantity (optional)"
							inputMode="numeric"
							value={field.state.value}
							onChange={field.handleChange}
							onBlur={field.handleBlur}
							errors={field.state.meta.errors}
						/>
					)}
				</form.Field>
				<form.Field name="weightGrams">
					{(field) => (
						<TextField
							id="product-weight"
							label="Weight in grams (optional)"
							inputMode="numeric"
							value={field.state.value}
							onChange={field.handleChange}
							onBlur={field.handleBlur}
							errors={field.state.meta.errors}
						/>
					)}
				</form.Field>
				<form.Field name="brand">
					{(field) => (
						<TextField
							id="product-brand"
							label="Brand (optional)"
							value={field.state.value}
							onChange={field.handleChange}
							onBlur={field.handleBlur}
							errors={field.state.meta.errors}
						/>
					)}
				</form.Field>
				<form.Field name="imageUrl">
					{(field) => (
						<TextField
							id="product-image-url"
							label="Image URL (optional)"
							inputMode="url"
							value={field.state.value}
							onChange={field.handleChange}
							onBlur={field.handleBlur}
							errors={field.state.meta.errors}
						/>
					)}
				</form.Field>
			</div>
			<form.Field name="shortDescription">
				{(field) => (
					<TextField
						id="product-short-description"
						label="Short description (optional)"
						value={field.state.value}
						onChange={field.handleChange}
						onBlur={field.handleBlur}
						errors={field.state.meta.errors}
					/>
				)}
			</form.Field>
			<form.Field name="description">
				{(field) => (
					<TextField
						id="product-description"
						label="Description (optional)"
						multiline
						value={field.state.value}
						onChange={field.handleChange}
						onBlur={field.handleBlur}
						errors={field.state.meta.errors}
					/>
				)}
			</form.Field>
			<div className="flex flex-wrap gap-6">
				<form.Field name="isActive">{(field) => <SwitchField id="product-active" label="Active" checked={field.state.value} onChange={field.handleChange} />}</form.Field>
				<form.Field name="isFeatured">
					{(field) => <SwitchField id="product-featured" label="Featured" checked={field.state.value} onChange={field.handleChange} />}
				</form.Field>
			</div>
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
