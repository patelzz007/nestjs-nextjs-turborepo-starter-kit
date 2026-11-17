"use client";

import { useForm } from "@tanstack/react-form";
import { AppLanguageSchema, ClientPlatformSchema, FlagAppSchema, SubjectContextSchema, type DecisionTraceStep, type SubjectContext } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { StatusBadge } from "@workspace/ui/components/status-badge";
import * as React from "react";
import { z } from "zod";

import { OptionSelectField, TextField, useFormSubmitHandler } from "@/components/common/form-fields";

import { CONDITION_ATTRIBUTE_LABELS } from "../lib/release-labels";

const NONE = "none";
const OptionalTextSchema = z
	.string()
	.trim()
	.transform((value) => (value === "" ? null : value));
/** A platform or language to check with, or none (the subject sends none). */
const PlatformChoiceSchema = z.union([ClientPlatformSchema, z.literal(NONE)]);
const LocaleChoiceSchema = z.union([AppLanguageSchema, z.literal(NONE)]);

/** The form's raw values → the subject the API checks. */
export const SubjectFormSchema = z
	.object({
		userId: OptionalTextSchema,
		tenantId: OptionalTextSchema,
		locationId: OptionalTextSchema,
		deviceId: OptionalTextSchema,
		app: FlagAppSchema,
		platform: PlatformChoiceSchema.transform((value) => (value === NONE ? null : value)),
		appVersion: OptionalTextSchema,
		locale: LocaleChoiceSchema.transform((value) => (value === NONE ? null : value)),
	})
	.pipe(SubjectContextSchema);

type SubjectFormValues = z.input<typeof SubjectFormSchema>;

const PLATFORM_OPTIONS: readonly z.output<typeof PlatformChoiceSchema>[] = [NONE, ...ClientPlatformSchema.options];
const LOCALE_OPTIONS: readonly z.output<typeof LocaleChoiceSchema>[] = [NONE, ...AppLanguageSchema.options];

function optionLabel(option: string): string {
	return option === NONE ? "Not set" : option;
}

export interface CheckOutcome {
	/** What the subject gets, in words: "On", "bold". */
	readonly value: string;
	readonly trace: readonly DecisionTraceStep[];
}

export interface SubjectCheckCardProps {
	readonly idPrefix: string;
	readonly defaultApp: SubjectContext["app"];
	readonly pending: boolean;
	readonly onCheck: (subject: SubjectContext) => Promise<CheckOutcome>;
}

/** "Check a subject": the value one person, store or device would get here, and every step that decided it. */
export function SubjectCheckCard({ idPrefix, defaultApp, pending, onCheck }: SubjectCheckCardProps): React.JSX.Element {
	const [outcome, setOutcome] = React.useState<CheckOutcome | null>(null);
	const defaults: SubjectFormValues = { userId: "", tenantId: "", locationId: "", deviceId: "", app: defaultApp, platform: NONE, appVersion: "", locale: NONE };
	const form = useForm({
		defaultValues: defaults,
		validators: { onSubmit: SubjectFormSchema },
		onSubmit: async ({ value }): Promise<void> => {
			setOutcome(await onCheck(SubjectFormSchema.parse(value)));
		},
	});
	const submit = React.useCallback((): Promise<void> => form.handleSubmit(), [form]);
	const handleSubmit = useFormSubmitHandler(submit);
	const text = (name: "userId" | "tenantId" | "locationId" | "deviceId" | "appVersion", label: string, placeholder: string): React.JSX.Element => (
		<form.Field name={name}>
			{(field) => (
				<TextField
					id={`${idPrefix}-${name}`}
					label={label}
					value={field.state.value}
					onChange={field.handleChange}
					onBlur={field.handleBlur}
					errors={field.state.meta.errors}
					placeholder={placeholder}
				/>
			)}
		</form.Field>
	);
	return (
		<Card>
			<CardHeader>
				<CardTitle>Check a subject</CardTitle>
				<CardDescription>Fill in what you know; anything left empty counts as unknown, as it would for a real visitor.</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<form noValidate className="grid gap-3 sm:grid-cols-2" onSubmit={handleSubmit}>
					{text("userId", "Person (user id)", "019b…")}
					{text("tenantId", "Merchant (tenant id)", "019b…")}
					{text("locationId", "Branch (location id)", "019b…")}
					{text("deviceId", "Device id", "019b…")}
					<form.Field name="app">
						{(field) => (
							<OptionSelectField
								id={`${idPrefix}-app`}
								label="App"
								value={field.state.value}
								options={FlagAppSchema.options}
								onChange={field.handleChange}
								labelOf={optionLabel}
							/>
						)}
					</form.Field>
					<form.Field name="platform">
						{(field) => (
							<OptionSelectField
								id={`${idPrefix}-platform`}
								label="Platform"
								value={field.state.value}
								options={PLATFORM_OPTIONS}
								onChange={field.handleChange}
								labelOf={optionLabel}
							/>
						)}
					</form.Field>
					{text("appVersion", "App version", "e.g. 1.4.2")}
					<form.Field name="locale">
						{(field) => (
							<OptionSelectField
								id={`${idPrefix}-locale`}
								label="Language"
								value={field.state.value}
								options={LOCALE_OPTIONS}
								onChange={field.handleChange}
								labelOf={optionLabel}
							/>
						)}
					</form.Field>
					<div className="sm:col-span-2">
						<Button type="submit" size="sm" variant="outline" disabled={pending}>
							Check
						</Button>
					</div>
				</form>
				{outcome === null ? null : (
					<div className="flex flex-col gap-2" aria-live="polite">
						<p className="text-sm">
							Gets <span className="font-semibold">{outcome.value}</span>
						</p>
						<ol className="flex flex-col gap-1 text-sm">
							{outcome.trace.map((step, index): React.JSX.Element => (
								<li key={`${step.step}-${String(index)}`} className="flex flex-wrap items-center gap-2">
									<StatusBadge tone={step.matched ? "success" : "muted"}>{step.matched ? "Decided" : "Skipped"}</StatusBadge>
									<span>{step.label}</span>
									{step.failedAttribute === null ? null : (
										<span className="text-muted-foreground">{`(${CONDITION_ATTRIBUTE_LABELS[step.failedAttribute]} didn't match)`}</span>
									)}
									{step.detail === null ? null : <span className="text-muted-foreground">{step.detail}</span>}
								</li>
							))}
						</ol>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
