"use client";

import { FieldError } from "@workspace/ui/components/form/field";
import { Input } from "@workspace/ui/components/form/input";
import { Label } from "@workspace/ui/components/form/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/form/select";
import { Switch } from "@workspace/ui/components/form/switch";
import { Textarea } from "@workspace/ui/components/form/textarea";
import * as React from "react";

// ============================================
// components/common/form-fields.tsx - the admin's controlled form fields
// ============================================
// Data-agnostic, controlled field components for TanStack Form render props:
// a form passes `field.state.value`, `field.handleChange`, `field.handleBlur`
// and `field.state.meta.errors`, and never builds an inline handler. Every
// admin form (catalog, invites, permission checker) composes these, so a
// field's markup, labelling and error display are defined once.

/** One validation message of a form field (TanStack Form's Standard Schema issues). */
export type FormFieldError = { readonly message?: string } | undefined;

interface FieldShellProps {
	readonly id: string;
	readonly label: string;
	readonly errors: readonly FormFieldError[];
	readonly children: React.ReactNode;
}

function FieldShell({ id, label, errors, children }: FieldShellProps): React.JSX.Element {
	return (
		<div className="space-y-1.5">
			<Label htmlFor={id}>{label}</Label>
			{children}
			<FieldError errors={[...errors]} />
		</div>
	);
}

export interface TextFieldProps {
	readonly id: string;
	readonly label: string;
	readonly value: string;
	readonly onChange: (value: string) => void;
	readonly onBlur: () => void;
	readonly errors: readonly FormFieldError[];
	readonly type?: "text" | "email" | "url";
	readonly inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
	readonly multiline?: boolean;
	readonly placeholder?: string;
}

/** Labelled, controlled text input (or textarea) with its validation messages. */
export function TextField({ id, label, value, onChange, onBlur, errors, type = "text", inputMode, multiline = false, placeholder }: TextFieldProps): React.JSX.Element {
	const isInvalid = errors.length > 0;
	const handleChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
			onChange(event.target.value);
		},
		[onChange],
	);
	return (
		<FieldShell id={id} label={label} errors={errors}>
			{multiline ? (
				<Textarea id={id} value={value} placeholder={placeholder} aria-invalid={isInvalid} onBlur={onBlur} onChange={handleChange} />
			) : (
				<Input id={id} type={type} value={value} inputMode={inputMode} placeholder={placeholder} aria-invalid={isInvalid} onBlur={onBlur} onChange={handleChange} />
			)}
		</FieldShell>
	);
}

export interface OptionSelectFieldProps<TOption extends string> {
	readonly id: string;
	readonly label: string;
	readonly value: TOption;
	/** The closed set to choose from — pass a shared enum's `Schema.options`, never a hand-copied list. */
	readonly options: readonly TOption[];
	readonly onChange: (value: TOption) => void;
	/** Display text of an option; the option itself when omitted. */
	readonly labelOf?: (option: TOption) => string;
	readonly errors?: readonly FormFieldError[];
}

function identityLabel(option: string): string {
	return option;
}

/** Labelled select over a closed set of string options; a value outside `options` is ignored, never forwarded. */
export function OptionSelectField<TOption extends string>({
	id,
	label,
	value,
	options,
	onChange,
	labelOf = identityLabel,
	errors = [],
}: OptionSelectFieldProps<TOption>): React.JSX.Element {
	const handleValueChange = React.useCallback(
		(next: string | null): void => {
			const option = options.find((candidate) => candidate === next);
			if (option !== undefined) {
				onChange(option);
			}
		},
		[onChange, options],
	);
	return (
		<FieldShell id={id} label={label} errors={errors}>
			<Select value={value} onValueChange={handleValueChange}>
				<SelectTrigger id={id} className="w-full">
					<SelectValue>{labelOf(value)}</SelectValue>
				</SelectTrigger>
				<SelectContent>
					{options.map((option) => (
						<SelectItem key={option} value={option}>
							{labelOf(option)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</FieldShell>
	);
}

export interface SwitchFieldProps {
	readonly id: string;
	readonly label: string;
	readonly checked: boolean;
	readonly onChange: (checked: boolean) => void;
}

/** Labelled, controlled switch. */
export function SwitchField({ id, label, checked, onChange }: SwitchFieldProps): React.JSX.Element {
	return (
		<div className="flex items-center gap-3">
			<Switch id={id} checked={checked} onCheckedChange={onChange} />
			<Label htmlFor={id}>{label}</Label>
		</div>
	);
}

/**
 * A `<form onSubmit>` handler that suppresses the browser submission and
 * hands control to the form library (`form.handleSubmit`).
 */
export function useFormSubmitHandler(submit: () => Promise<void>): (event: React.SubmitEvent<HTMLFormElement>) => void {
	return React.useCallback(
		(event: React.SubmitEvent<HTMLFormElement>): void => {
			event.preventDefault();
			void submit();
		},
		[submit],
	);
}
