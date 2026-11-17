"use client";

import {
	AppLanguageSchema,
	ClientPlatformSchema,
	CustomerTierSchema,
	DeploymentEnvironmentSchema,
	epochMs,
	FlagAppSchema,
	GroupOperatorSchema,
	ListOperatorSchema,
	PermissionActionSchema,
	PermissionResourceSchema,
	VersionOperatorSchema,
	type Condition,
	type ConditionAttribute,
	type ConditionInput,
	type EpochMs,
	type GroupOperator,
	type ListOperator,
	type PermissionAction,
	type PermissionResource,
	type VersionOperator,
} from "@workspace/shared";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import * as React from "react";
import { z } from "zod";

import { CheckboxGroupField, OptionSelectField, SwitchField } from "@/components/common/form-fields";

/** A rule's first condition of a kind: an empty list, today's version, no time limits, the first group. */
export function emptyCondition(attribute: ConditionAttribute, firstGroupKey: string): Condition {
	switch (attribute) {
		case "USER_ID":
		case "EMAIL_DOMAIN":
		case "TENANT_ID":
		case "LOCATION_ID":
			return { attribute, operator: "IN", values: [] };
		case "CUSTOMER_TIER":
			return { attribute, operator: "IN", values: [] };
		case "APP":
			return { attribute, operator: "IN", values: [] };
		case "PLATFORM":
			return { attribute, operator: "IN", values: [] };
		case "LOCALE":
			return { attribute, operator: "IN", values: [] };
		case "ENVIRONMENT":
			return { attribute, operator: "IN", values: [] };
		case "PLATFORM_STAFF":
			return { attribute, is: true };
		case "PERMISSION":
			return { attribute, operator: "HAS", permission: { action: "READ", resource: "ADMIN_DASHBOARD" } };
		case "APP_VERSION":
			return { attribute, operator: "AT_LEAST", version: "1.0.0" };
		case "FLAG_GROUP":
			return { attribute, operator: "IN_GROUP", groupKey: firstGroupKey };
		case "TIME":
			return { attribute, from: null, until: null };
	}
}

const LIST_OPERATOR_LABELS: Readonly<Record<ListOperator, string>> = { IN: "is one of", NOT_IN: "is none of" };
const VERSION_OPERATOR_LABELS: Readonly<Record<VersionOperator, string>> = { AT_LEAST: "at least", BELOW: "below" };
const GROUP_OPERATOR_LABELS: Readonly<Record<GroupOperator, string>> = { IN_GROUP: "in the group", NOT_IN_GROUP: "not in the group" };
const HasOperatorSchema = z.enum(["HAS", "LACKS"]);
type HasOperator = z.output<typeof HasOperatorSchema>;
const HAS_LABELS: Readonly<Record<HasOperator, string>> = { HAS: "has", LACKS: "lacks" };
const VALUE_SEPARATOR = /[\s,]+/u;

function listOperatorLabel(operator: ListOperator): string {
	return LIST_OPERATOR_LABELS[operator];
}

function versionOperatorLabel(operator: VersionOperator): string {
	return VERSION_OPERATOR_LABELS[operator];
}

function groupOperatorLabel(operator: GroupOperator): string {
	return GROUP_OPERATOR_LABELS[operator];
}

function hasOperatorLabel(operator: HasOperator): string {
	return HAS_LABELS[operator];
}

/** Comma or space separated text → its values (empty pieces dropped). */
export function splitValues(text: string): string[] {
	return text.split(VALUE_SEPARATOR).filter((value) => value !== "");
}

/** `datetime-local` value ↔ epoch milliseconds (local time). */
export function epochFromLocal(value: string): EpochMs | null {
	const at = new Date(value).getTime();
	return value === "" || Number.isNaN(at) ? null : epochMs(at);
}

const LOCAL_DATE_TIME_LENGTH = 16;
const MS_PER_MINUTE = 60_000;

export function localFromEpoch(at: number | null): string {
	if (at === null) {
		return "";
	}
	const local = new Date(at - new Date(at).getTimezoneOffset() * MS_PER_MINUTE);
	return local.toISOString().slice(0, LOCAL_DATE_TIME_LENGTH);
}

export interface ConditionEditorProps {
	readonly id: string;
	readonly condition: ConditionInput;
	readonly groupKeys: readonly string[];
	readonly onChange: (condition: ConditionInput) => void;
}

/** A condition on a list of values (ids, domains, tiers, apps, platforms, languages, environments). */
type ListConditionInput = Extract<ConditionInput, { readonly values: readonly string[] }>;

/** What a list condition's values are chosen from: typed freely (ids, domains), or ticked from a closed set. */
interface ListChoices {
	readonly label: string;
	readonly options: readonly string[] | null;
}

/** The values a list condition offers, by attribute. */
export function listChoicesOf(attribute: ListConditionInput["attribute"]): ListChoices {
	switch (attribute) {
		case "USER_ID":
		case "TENANT_ID":
		case "LOCATION_ID":
			return { label: "Ids", options: null };
		case "EMAIL_DOMAIN":
			return { label: "Domains", options: null };
		case "CUSTOMER_TIER":
			return { label: "Tiers", options: CustomerTierSchema.options };
		case "APP":
			return { label: "Apps", options: FlagAppSchema.options };
		case "PLATFORM":
			return { label: "Platforms", options: ClientPlatformSchema.options };
		case "LOCALE":
			return { label: "Languages", options: AppLanguageSchema.options };
		case "ENVIRONMENT":
			return { label: "Environments", options: DeploymentEnvironmentSchema.options };
	}
}

/** The condition with new values, each checked against the attribute's own set. */
export function withListValues(condition: ListConditionInput, values: readonly string[]): ConditionInput {
	switch (condition.attribute) {
		case "USER_ID":
		case "EMAIL_DOMAIN":
		case "TENANT_ID":
		case "LOCATION_ID":
			return { ...condition, values: [...values] };
		case "CUSTOMER_TIER":
			return { ...condition, values: z.array(CustomerTierSchema).parse(values) };
		case "APP":
			return { ...condition, values: z.array(FlagAppSchema).parse(values) };
		case "PLATFORM":
			return { ...condition, values: z.array(ClientPlatformSchema).parse(values) };
		case "LOCALE":
			return { ...condition, values: z.array(AppLanguageSchema).parse(values) };
		case "ENVIRONMENT":
			return { ...condition, values: z.array(DeploymentEnvironmentSchema).parse(values) };
	}
}

function ListText({
	id,
	label,
	values,
	onChange,
}: {
	readonly id: string;
	readonly label: string;
	readonly values: readonly string[];
	readonly onChange: (values: string[]) => void;
}): React.JSX.Element {
	const [text, setText] = React.useState(values.join(", "));
	const handleChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			setText(event.target.value);
			onChange(splitValues(event.target.value));
		},
		[onChange],
	);
	return (
		<div className="space-y-1.5">
			<Label htmlFor={id}>{label}</Label>
			<Input id={id} value={text} onChange={handleChange} placeholder="Separate with commas" />
		</div>
	);
}

function ListConditionEditor({
	id,
	condition,
	onChange,
}: {
	readonly id: string;
	readonly condition: ListConditionInput;
	readonly onChange: (condition: ConditionInput) => void;
}): React.JSX.Element {
	const choices = listChoicesOf(condition.attribute);
	const setOperator = React.useCallback(
		(operator: ListOperator): void => {
			onChange({ ...condition, operator });
		},
		[condition, onChange],
	);
	const setValues = React.useCallback(
		(values: readonly string[]): void => {
			onChange(withListValues(condition, values));
		},
		[condition, onChange],
	);
	return (
		<div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
			<OptionSelectField id={`${id}-op`} label="Match" value={condition.operator} options={ListOperatorSchema.options} labelOf={listOperatorLabel} onChange={setOperator} />
			{choices.options === null ? (
				<ListText id={`${id}-values`} label={choices.label} values={condition.values} onChange={setValues} />
			) : (
				<CheckboxGroupField id={`${id}-values`} label={choices.label} value={condition.values} options={choices.options} onChange={setValues} />
			)}
		</div>
	);
}

type StaffConditionInput = Extract<ConditionInput, { readonly attribute: "PLATFORM_STAFF" }>;

function StaffConditionEditor({
	id,
	condition,
	onChange,
}: {
	readonly id: string;
	readonly condition: StaffConditionInput;
	readonly onChange: (condition: ConditionInput) => void;
}): React.JSX.Element {
	const setIs = React.useCallback(
		(is: boolean): void => {
			onChange({ ...condition, is });
		},
		[condition, onChange],
	);
	return <SwitchField id={`${id}-is`} label="Is platform staff" checked={condition.is} onChange={setIs} />;
}

type PermissionConditionInput = Extract<ConditionInput, { readonly attribute: "PERMISSION" }>;

function PermissionConditionEditor({
	id,
	condition,
	onChange,
}: {
	readonly id: string;
	readonly condition: PermissionConditionInput;
	readonly onChange: (condition: ConditionInput) => void;
}): React.JSX.Element {
	const setOperator = React.useCallback(
		(operator: HasOperator): void => {
			onChange({ ...condition, operator });
		},
		[condition, onChange],
	);
	const setAction = React.useCallback(
		(action: PermissionAction): void => {
			onChange({ ...condition, permission: { ...condition.permission, action } });
		},
		[condition, onChange],
	);
	const setResource = React.useCallback(
		(resource: PermissionResource): void => {
			onChange({ ...condition, permission: { ...condition.permission, resource } });
		},
		[condition, onChange],
	);
	return (
		<div className="grid gap-3 sm:grid-cols-3">
			<OptionSelectField id={`${id}-op`} label="The person" value={condition.operator} options={HasOperatorSchema.options} labelOf={hasOperatorLabel} onChange={setOperator} />
			<OptionSelectField id={`${id}-action`} label="Action" value={condition.permission.action} options={PermissionActionSchema.options} onChange={setAction} />
			<OptionSelectField id={`${id}-resource`} label="Resource" value={condition.permission.resource} options={PermissionResourceSchema.options} onChange={setResource} />
		</div>
	);
}

type VersionConditionInput = Extract<ConditionInput, { readonly attribute: "APP_VERSION" }>;

function VersionConditionEditor({
	id,
	condition,
	onChange,
}: {
	readonly id: string;
	readonly condition: VersionConditionInput;
	readonly onChange: (condition: ConditionInput) => void;
}): React.JSX.Element {
	const setOperator = React.useCallback(
		(operator: VersionOperator): void => {
			onChange({ ...condition, operator });
		},
		[condition, onChange],
	);
	const setVersion = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			onChange({ ...condition, version: event.target.value });
		},
		[condition, onChange],
	);
	return (
		<div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
			<OptionSelectField
				id={`${id}-op`}
				label="Version"
				value={condition.operator}
				options={VersionOperatorSchema.options}
				labelOf={versionOperatorLabel}
				onChange={setOperator}
			/>
			<div className="space-y-1.5">
				<Label htmlFor={`${id}-version`}>App version</Label>
				<Input id={`${id}-version`} value={condition.version} onChange={setVersion} placeholder="e.g. 2.1.0" />
			</div>
		</div>
	);
}

type GroupConditionInput = Extract<ConditionInput, { readonly attribute: "FLAG_GROUP" }>;

function GroupConditionEditor({
	id,
	condition,
	groupKeys,
	onChange,
}: {
	readonly id: string;
	readonly condition: GroupConditionInput;
	readonly groupKeys: readonly string[];
	readonly onChange: (condition: ConditionInput) => void;
}): React.JSX.Element {
	const setOperator = React.useCallback(
		(operator: GroupOperator): void => {
			onChange({ ...condition, operator });
		},
		[condition, onChange],
	);
	const setGroup = React.useCallback(
		(groupKey: string): void => {
			onChange({ ...condition, groupKey });
		},
		[condition, onChange],
	);
	return (
		<div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
			<OptionSelectField id={`${id}-op`} label="Match" value={condition.operator} options={GroupOperatorSchema.options} labelOf={groupOperatorLabel} onChange={setOperator} />
			<OptionSelectField id={`${id}-group`} label="Group" value={condition.groupKey} options={groupKeys.length === 0 ? [condition.groupKey] : groupKeys} onChange={setGroup} />
		</div>
	);
}

type TimeConditionInput = Extract<ConditionInput, { readonly attribute: "TIME" }>;

function TimeConditionEditor({
	id,
	condition,
	onChange,
}: {
	readonly id: string;
	readonly condition: TimeConditionInput;
	readonly onChange: (condition: ConditionInput) => void;
}): React.JSX.Element {
	const setFrom = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			onChange({ ...condition, from: epochFromLocal(event.target.value) });
		},
		[condition, onChange],
	);
	const setUntil = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			onChange({ ...condition, until: epochFromLocal(event.target.value) });
		},
		[condition, onChange],
	);
	return (
		<div className="grid gap-3 sm:grid-cols-2">
			<div className="space-y-1.5">
				<Label htmlFor={`${id}-from`}>From (empty: no start)</Label>
				<Input id={`${id}-from`} type="datetime-local" value={localFromEpoch(condition.from)} onChange={setFrom} />
			</div>
			<div className="space-y-1.5">
				<Label htmlFor={`${id}-until`}>Until (empty: no end)</Label>
				<Input id={`${id}-until`} type="datetime-local" value={localFromEpoch(condition.until)} onChange={setUntil} />
			</div>
		</div>
	);
}

/** One condition's controls, by kind: the right input for each attribute (controlled; owns no data). */
export function ConditionEditor({ id, condition, groupKeys, onChange }: ConditionEditorProps): React.JSX.Element {
	switch (condition.attribute) {
		case "USER_ID":
		case "EMAIL_DOMAIN":
		case "TENANT_ID":
		case "LOCATION_ID":
		case "CUSTOMER_TIER":
		case "APP":
		case "PLATFORM":
		case "LOCALE":
		case "ENVIRONMENT":
			return <ListConditionEditor id={id} condition={condition} onChange={onChange} />;
		case "PLATFORM_STAFF":
			return <StaffConditionEditor id={id} condition={condition} onChange={onChange} />;
		case "PERMISSION":
			return <PermissionConditionEditor id={id} condition={condition} onChange={onChange} />;
		case "APP_VERSION":
			return <VersionConditionEditor id={id} condition={condition} onChange={onChange} />;
		case "FLAG_GROUP":
			return <GroupConditionEditor id={id} condition={condition} groupKeys={groupKeys} onChange={onChange} />;
		case "TIME":
			return <TimeConditionEditor id={id} condition={condition} onChange={onChange} />;
	}
}
