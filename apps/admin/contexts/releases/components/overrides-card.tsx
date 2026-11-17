"use client";

import { useForm } from "@tanstack/react-form";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { ChangeReasonSchema, FlagOverrideUnitSchema, type FlagOverride, type FlagOverrideUnit } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { StatusBadge } from "@workspace/ui/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
import * as React from "react";
import { z } from "zod";

import { OptionSelectField, SwitchField, TextField, useFormSubmitHandler, type FormFieldError } from "@/components/common/form-fields";

import { formatWhen, OVERRIDE_UNIT_LABELS } from "../lib/release-labels";
import { ReasonActionForm } from "./reason-action-form";

const NO_SUBJECT = "";
const NO_ERRORS: readonly FormFieldError[] = [];

function noop(): void {
	// The search box only narrows the picker; leaving it changes nothing.
}

const OverrideFormSchema = z.object({ unit: FlagOverrideUnitSchema, subjectId: z.uuid({ error: "Pick who it's for" }), on: z.boolean(), reason: ChangeReasonSchema });
/** A new override as the card hands it over: who, on or off, and why. */
export type OverrideInput = z.output<typeof OverrideFormSchema>;
interface OverrideFormValues {
	unit: FlagOverrideUnit;
	subjectId: string;
	on: boolean;
	reason: string;
}

function unitLabel(unit: FlagOverrideUnit): string {
	return OVERRIDE_UNIT_LABELS[unit];
}

export interface OverridesCardProps {
	readonly flagTitle: string;
	readonly overrides: readonly FlagOverride[];
	readonly canChange: boolean;
	readonly pending: boolean;
	readonly onSet: (override: OverrideInput) => Promise<void>;
	readonly onRemove: (overrideId: string, reason: string) => Promise<void>;
}

/** Overrides: one person, branch or merchant forced on or off, ahead of every rule (a branch's before its merchant's). */
export function OverridesCard({ flagTitle, overrides, canChange, pending, onSet, onRemove }: OverridesCardProps): React.JSX.Element {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Overrides</CardTitle>
				<CardDescription>{`Force ${flagTitle} on or off for one person, branch or merchant: QA accounts, a store with a problem. The kill switch still beats them.`}</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-6">
				{overrides.length === 0 ? (
					<p className="text-sm text-muted-foreground">No overrides.</p>
				) : (
					<Table aria-label="Overrides">
						<TableHeader>
							<TableRow>
								<TableHead>For</TableHead>
								<TableHead>Forced</TableHead>
								<TableHead>Why</TableHead>
								<TableHead>Set</TableHead>
								{canChange ? <TableHead>Remove</TableHead> : null}
							</TableRow>
						</TableHeader>
						<TableBody>
							{overrides.map((override): React.JSX.Element => (
								<OverrideRow key={override.id} override={override} canChange={canChange} pending={pending} onRemove={onRemove} />
							))}
						</TableBody>
					</Table>
				)}
				{canChange ? <AddOverrideForm pending={pending} onSet={onSet} /> : null}
			</CardContent>
		</Card>
	);
}

interface OverrideRowProps {
	readonly override: FlagOverride;
	readonly canChange: boolean;
	readonly pending: boolean;
	readonly onRemove: (overrideId: string, reason: string) => Promise<void>;
}

/** One override: who, forced to what, why, when — and removing it. */
function OverrideRow({ override, canChange, pending, onRemove }: OverrideRowProps): React.JSX.Element {
	const remove = React.useCallback((reason: string): Promise<void> => onRemove(override.id, reason), [onRemove, override.id]);
	return (
		<TableRow>
			<TableCell>
				<span className="font-medium">{override.subjectName ?? override.subjectId}</span>
				<p className="text-xs text-muted-foreground">
					{OVERRIDE_UNIT_LABELS[override.unit]}
					{override.tenantName === null ? "" : ` · ${override.tenantName}`}
				</p>
			</TableCell>
			<TableCell>
				<StatusBadge tone={override.on ? "success" : "neutral"}>{override.on ? "On" : "Off"}</StatusBadge>
			</TableCell>
			<TableCell className="max-w-xs">{override.reason}</TableCell>
			<TableCell className="whitespace-nowrap">
				{formatWhen(override.updatedAt)}
				<p className="text-xs text-muted-foreground">{override.updatedByName ?? ""}</p>
			</TableCell>
			{canChange ? (
				<TableCell className="min-w-64">
					<ReasonActionForm
						id={`remove-${override.id}`}
						label="Why remove it"
						submitLabel="Remove"
						placeholder="e.g. The store's tills are fixed"
						destructive
						pending={pending}
						onSubmit={remove}
					/>
				</TableCell>
			) : null}
		</TableRow>
	);
}

function selectUnit(state: { readonly values: OverrideFormValues }): FlagOverrideUnit {
	return state.values.unit;
}

function AddOverrideForm({ pending, onSet }: Pick<OverridesCardProps, "pending" | "onSet">): React.JSX.Element {
	const { api } = useAuth();
	const defaults: OverrideFormValues = { unit: "USER", subjectId: NO_SUBJECT, on: true, reason: "" };
	const form = useForm({
		defaultValues: defaults,
		validators: { onSubmit: OverrideFormSchema },
		onSubmit: async ({ value, formApi }): Promise<void> => {
			await onSet(OverrideFormSchema.parse(value));
			formApi.reset();
		},
	});
	const [search, setSearch] = React.useState("");
	const submit = React.useCallback((): Promise<void> => form.handleSubmit(), [form]);
	const handleSubmit = useFormSubmitHandler(submit);
	// Another kind of subject: the one picked before no longer applies.
	const changeUnit = React.useCallback(
		(unit: FlagOverrideUnit): void => {
			form.setFieldValue("unit", unit);
			form.setFieldValue("subjectId", NO_SUBJECT);
		},
		[form],
	);
	return (
		<form noValidate className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2" onSubmit={handleSubmit} aria-label="Add an override">
			<form.Field name="unit">
				{(field) => (
					<OptionSelectField id="override-unit" label="For a" value={field.state.value} options={FlagOverrideUnitSchema.options} onChange={changeUnit} labelOf={unitLabel} />
				)}
			</form.Field>
			<TextField id="override-search" label="Search by name" value={search} onChange={setSearch} onBlur={noop} errors={NO_ERRORS} placeholder="Name, email or store" />
			<form.Subscribe selector={selectUnit}>
				{(unit) => (
					<form.Field name="subjectId">
						{(field) => <SubjectPicker unit={unit} search={search} value={field.state.value} onChange={field.handleChange} errors={field.state.meta.errors} api={api} />}
					</form.Field>
				)}
			</form.Subscribe>
			<form.Field name="on">{(field) => <SwitchField id="override-on" label="Force it on" checked={field.state.value} onChange={field.handleChange} />}</form.Field>
			<div className="sm:col-span-2">
				<form.Field name="reason">
					{(field) => (
						<TextField
							id="override-reason"
							label="Why (kept in the audit log)"
							value={field.state.value}
							onChange={field.handleChange}
							onBlur={field.handleBlur}
							errors={field.state.meta.errors}
							placeholder="e.g. QA account for the release"
						/>
					)}
				</form.Field>
			</div>
			<div>
				<Button type="submit" size="sm" disabled={pending}>
					Add override
				</Button>
			</div>
		</form>
	);
}

interface SubjectPickerProps {
	readonly unit: FlagOverrideUnit;
	readonly search: string;
	readonly value: string;
	readonly onChange: (subjectId: string) => void;
	readonly errors: readonly FormFieldError[];
	readonly api: ReturnType<typeof useAuth>["api"];
}

/** The matching people or stores, to pick the one the override is for. */
function SubjectPicker({ unit, search, value, onChange, errors, api }: SubjectPickerProps): React.JSX.Element {
	const found = api.featureFlags.subjects.useQuery({ unit, ...(search.trim() === "" ? {} : { search: search.trim() }) }).data?.data.subjects;
	const subjects = React.useMemo(() => found ?? [], [found]);
	const options = [NO_SUBJECT, ...subjects.map((subject) => subject.id)];
	const labelOf = React.useCallback(
		(id: string): string => {
			const subject = subjects.find((candidate) => candidate.id === id);
			return subject === undefined ? "Pick one" : `${subject.name}${subject.detail === null ? "" : ` · ${subject.detail}`}`;
		},
		[subjects],
	);
	return <OptionSelectField id="override-subject" label={OVERRIDE_UNIT_LABELS[unit]} value={value} options={options} onChange={onChange} labelOf={labelOf} errors={errors} />;
}
