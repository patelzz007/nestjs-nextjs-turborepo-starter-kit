"use client";

import { useForm } from "@tanstack/react-form";
import { Autocomplete, AutocompleteContent, AutocompleteEmpty, AutocompleteInput, AutocompleteList } from "@workspace/ui/components/autocomplete";
import { Button } from "@workspace/ui/components/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldSet } from "@workspace/ui/components/field";
import { toastMessage } from "@workspace/ui/components/toast";
import * as React from "react";
import { z } from "zod";

import { renderSampleTagText, SAMPLE_TAGS, type SampleTag } from "@/components/component-gallery/examples/autocomplete/autocomplete-sample-data";
import { type FormFieldError, useFormSubmitHandler } from "@/components/common/form-fields";

/** The form's contract: a feature is required and must be one of the suggestions. */
const FeatureFormSchema = z.object({
	feature: z
		.string()
		.min(1, "Please select an item.")
		.refine((value: string): boolean => SAMPLE_TAGS.some((tag: SampleTag): boolean => tag.value === value), "Please select a valid item."),
});

type FeatureFormValues = z.infer<typeof FeatureFormSchema>;

const DEFAULT_VALUES: FeatureFormValues = { feature: "" };

interface FeatureAutocompleteFieldProps {
	readonly id: string;
	readonly value: string;
	readonly onChange: (value: string) => void;
	readonly onBlur: () => void;
	readonly errors: readonly FormFieldError[];
}

/** Controlled, labelled feature autocomplete with its validation messages. */
function FeatureAutocompleteField({ id, value, onChange, onBlur, errors }: FeatureAutocompleteFieldProps): React.JSX.Element {
	const isInvalid = errors.length > 0;
	const handleValueChange = React.useCallback(
		(next: string): void => {
			onChange(next);
		},
		[onChange],
	);
	return (
		<Field data-invalid={isInvalid}>
			<FieldLabel htmlFor={id}>Select Feature</FieldLabel>
			<Autocomplete items={SAMPLE_TAGS} value={value} onValueChange={handleValueChange}>
				<AutocompleteInput id={id} placeholder="e.g. feature" aria-invalid={isInvalid} onBlur={onBlur} />
				<AutocompleteContent>
					<AutocompleteEmpty>No items found.</AutocompleteEmpty>
					<AutocompleteList>{renderSampleTagText}</AutocompleteList>
				</AutocompleteContent>
			</Autocomplete>
			<FieldDescription>Search and select a component feature.</FieldDescription>
			<FieldError errors={[...errors]} />
		</Field>
	);
}

export function Autocomplete12Example(): React.JSX.Element {
	const inputId = React.useId();
	const form = useForm({
		defaultValues: DEFAULT_VALUES,
		validators: { onSubmit: FeatureFormSchema },
		onSubmit: ({ value, formApi }): void => {
			const { feature } = FeatureFormSchema.parse(value);
			toastMessage.success({ title: "Form submitted", description: `Your form has successfully submitted with feature: ${feature}` });
			formApi.reset();
		},
	});

	const submit = React.useCallback((): Promise<void> => form.handleSubmit(), [form]);
	const handleFormSubmit = useFormSubmitHandler(submit);
	const handleCancel = React.useCallback((): void => {
		form.reset();
	}, [form]);

	return (
		<div className="w-full max-w-xs">
			<form noValidate onSubmit={handleFormSubmit}>
				<FieldGroup>
					<FieldSet>
						<FieldGroup>
							<form.Field name="feature">
								{(field) => (
									<FeatureAutocompleteField id={inputId} value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur} errors={field.state.meta.errors} />
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
