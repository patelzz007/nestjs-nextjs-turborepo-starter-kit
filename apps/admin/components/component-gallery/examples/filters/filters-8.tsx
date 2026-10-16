"use client";

import { isStringPrimitive } from "@workspace/shared";
import { CreditCardIcon, GlobeIcon, KeyRoundIcon, MonitorSmartphoneIcon, ShieldCheckIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Filters } from "@workspace/ui/components/filters/filters";
import { createFilterQuery, createFilterRule } from "@workspace/ui/components/filters/filters-query";
import {
	filterValueItems,
	type FilterCommitOptions,
	type FilterEditorProps,
	type FilterField,
	type FilterOption,
	type FilterQuery,
	type FilterValue,
	type FilterValueDisplayContext,
} from "@workspace/ui/components/filters/filters-types";
import { Label } from "@workspace/ui/components/label";
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/native-select";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";
import { Switch } from "@workspace/ui/components/switch";
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";
import { cn } from "@workspace/ui/lib/core/utils";

/* -------------------------------------------------------------------------- */
/*                                  Options                                   */
/* -------------------------------------------------------------------------- */

const CHANNELS: readonly FilterOption[] = [
	{ value: "web", label: "Web" },
	{ value: "ios", label: "iOS" },
	{ value: "android", label: "Android" },
	{ value: "api", label: "API" },
];

interface Plan {
	readonly value: string;
	readonly label: string;
	readonly hint: string;
}

const PLANS: readonly Plan[] = [
	{ value: "free", label: "Free", hint: "No card on file" },
	{ value: "pro", label: "Pro", hint: "Monthly or yearly" },
	{ value: "ultimate", label: "Ultimate", hint: "Seat based" },
];

const PERMISSIONS: readonly FilterOption[] = [
	{ value: "read", label: "Read" },
	{ value: "write", label: "Write" },
	{ value: "publish", label: "Publish" },
	{ value: "admin", label: "Administer" },
	{ value: "billing", label: "Billing" },
];

const REGIONS: readonly FilterOption[] = [
	{ value: "emea", label: "EMEA" },
	{ value: "amer", label: "AMER" },
	{ value: "apac", label: "APAC" },
	{ value: "latam", label: "LATAM" },
];

/** The picks of a "many" value, as strings. Anything else stored there is ignored. */
function pickedValues(value: FilterValue | undefined): readonly string[] {
	return filterValueItems(value).filter(isStringPrimitive);
}

/** The one pick of a single-valued option field, or the empty string. */
function pickedValue(value: FilterValue | undefined): string {
	return isStringPrimitive(value) ? value : "";
}

const NO_PICKS: readonly string[] = [];

/** Each tick writes through without dismissing the popover. */
const KEEP_OPEN: FilterCommitOptions = { close: false };

/**
 * The row every hand-rolled list below is built from.
 *
 * It is the shipped option row's own density written out: `px-2 py-1` inside a
 * `p-1` list, so a checkbox row and a `FilterMenu` row are the same height in
 * the same popover rather than two densities in one bar. The two overrides are
 * both `Label`'s, and both are wrong for a menu row rather than wrong outright:
 * `font-medium` is emphasis a row does not want, and `leading-none` is a
 * one-line caption's line box, which crushes a row to 24px where the list
 * beside it draws 28.
 */
const ROW = "hover:bg-accent flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 leading-normal font-normal";

interface PickedLabelsProps {
	readonly options: readonly FilterOption[];
	readonly empty: string;
}

/**
 * The first pick by name, plus what it stands in for.
 *
 * The default display collapses anything past one pick to "N selected", which
 * names nothing: the whole point of picking Read and Write is that the chip
 * says Read. These options carry no icon, so the leading LABEL does that work
 * and the overflow follows it in a muted, tabular count.
 */
function PickedLabels({ options, empty }: PickedLabelsProps): React.JSX.Element {
	const [first] = options;
	if (first === undefined) return <>{empty}</>;
	return (
		<span className="flex items-center gap-1.5">
			{first.label}
			{options.length > 1 ? <span className="text-xs text-muted-foreground tabular-nums">+{options.length - 1}</span> : null}
		</span>
	);
}

/* -------------------------------------------------------------------------- */
/*                                  Editors                                   */
/* -------------------------------------------------------------------------- */

/**
 * A segmented control, committing on every press.
 *
 * `commit(next, { close: false })` writes the value through WITHOUT dismissing,
 * which is what makes several picks one gesture. That is the same contract the
 * built-in multi-select uses, so a custom control behaves like the shipped ones.
 */
function ChannelToggles({ value, onValueChange, commit, field }: FilterEditorProps): React.JSX.Element {
	const current = pickedValues(value);
	const handleValueChange = React.useCallback(
		(next: string[]): void => {
			onValueChange(next);
			commit(next, KEEP_OPEN);
		},
		[commit, onValueChange],
	);

	return (
		// No width: the group is `w-fit` and four short segments already decide how
		// wide the panel wants to be.
		<div className="p-2">
			<ToggleGroup multiple variant="outline" spacing={0} aria-label={field.label} value={current} onValueChange={handleValueChange}>
				{CHANNELS.map((channel: FilterOption): React.JSX.Element => (
					<ToggleGroupItem key={channel.value} value={channel.value}>
						{channel.label}
					</ToggleGroupItem>
				))}
			</ToggleGroup>
		</div>
	);
}

/** One choice, so choosing IS the commit and the popover closes behind it. */
function PlanRadios({ value, commit, field }: FilterEditorProps): React.JSX.Element {
	const handleValueChange = React.useCallback(
		(next: string): void => {
			commit(next);
		},
		[commit],
	);
	const current = pickedValue(value);

	return (
		<RadioGroup className="flex w-56 flex-col p-1" aria-label={field.label} value={current === "" ? null : current} onValueChange={handleValueChange}>
			{PLANS.map((plan: Plan): React.JSX.Element => (
				// Top aligned, because the row is two lines and the control belongs
				// beside the first of them.
				<Label key={plan.value} className={cn(ROW, "items-start")}>
					<RadioGroupItem value={plan.value} className="mt-0.5" />
					<span className="flex flex-col gap-0.5">
						<span className="text-sm">{plan.label}</span>
						<span className="text-xs text-muted-foreground">{plan.hint}</span>
					</span>
				</Label>
			))}
		</RadioGroup>
	);
}

interface PermissionRowProps {
	readonly permission: FilterOption;
	readonly checked: boolean;
	readonly onToggle: (entry: string, checked: boolean) => void;
}

function PermissionRow({ permission, checked, onToggle }: PermissionRowProps): React.JSX.Element {
	const handleCheckedChange = React.useCallback(
		(next: boolean): void => {
			onToggle(permission.value, next);
		},
		[onToggle, permission.value],
	);
	return (
		<Label className={ROW}>
			<Checkbox checked={checked} onCheckedChange={handleCheckedChange} />
			<span className="text-sm">{permission.label}</span>
		</Label>
	);
}

/**
 * Checkboxes rather than the built-in list, for a short closed set.
 *
 * Every tick is a real commit with `{ close: false }`, exactly as the built-in
 * multi-select does, so there is nothing held back for an Apply to accept or a
 * Discard to take away. The footer offers the one thing ticking cannot reach
 * instead: emptying the set in a single press, beside the count it changes.
 */
function PermissionChecks({ value, onValueChange, commit, labels }: FilterEditorProps): React.JSX.Element {
	const current = pickedValues(value);

	const write = React.useCallback(
		(next: readonly string[]): void => {
			onValueChange(next);
			commit(next, KEEP_OPEN);
		},
		[commit, onValueChange],
	);

	const toggle = React.useCallback(
		(entry: string, checked: boolean): void => {
			write(checked ? [...current, entry] : current.filter((item: string): boolean => item !== entry));
		},
		[current, write],
	);

	const clear = React.useCallback((): void => {
		write(NO_PICKS);
	}, [write]);

	return (
		<div className="flex w-56 flex-col p-1">
			{PERMISSIONS.map((permission: FilterOption): React.JSX.Element => (
				<PermissionRow key={permission.value} permission={permission} checked={current.includes(permission.value)} onToggle={toggle} />
			))}

			<div className="mt-1 flex items-center justify-between gap-2 border-t ps-2 pt-1">
				<span className="text-xs text-muted-foreground tabular-nums">{labels.valueCount(current.length)}</span>
				<Button variant="ghost" size="sm" disabled={current.length === 0} onClick={clear}>
					{labels.clear}
				</Button>
			</div>
		</div>
	);
}

/** A switch, for the one case where the value is the control's own state. */
function EnabledSwitch({ value, commit, field }: FilterEditorProps): React.JSX.Element {
	const handleCheckedChange = React.useCallback(
		(checked: boolean): void => {
			commit(checked);
		},
		[commit],
	);

	return (
		// `w-40` is the width the shipped boolean editor uses, so the popover is
		// the size the bar's own True/False panel would have been.
		<Label className="flex w-40 cursor-pointer items-center justify-between gap-3 p-2 font-normal">
			<span className="text-sm">{field.label}</span>
			{/* One decisive value, so flipping it is the whole edit. */}
			<Switch checked={value === true} onCheckedChange={handleCheckedChange} aria-label={field.label} />
		</Label>
	);
}

/**
 * The platform's own menu, for a list short enough that a search box is chrome.
 *
 * A native `<select>` opens as an OS popup OUTSIDE the document: on a phone it
 * becomes the system wheel, and its menu is never clipped by the popover it
 * lives in. The empty option is what lets the filter be cleared back to "any",
 * since a select has no unselected state of its own. The select keeps the
 * field's name as its `aria-label`, where it is not already on screen.
 */
function RegionSelect({ value, commit, field }: FilterEditorProps): React.JSX.Element {
	const handleChange = React.useCallback(
		(event: React.ChangeEvent<HTMLSelectElement>): void => {
			commit(event.target.value === "" ? undefined : event.target.value);
		},
		[commit],
	);

	return (
		<div className="w-48 p-2">
			<NativeSelect className="w-full" aria-label={field.label} value={pickedValue(value)} onChange={handleChange}>
				<NativeSelectOption value="">Any region</NativeSelectOption>
				{REGIONS.map((region: FilterOption): React.JSX.Element => (
					<NativeSelectOption key={region.value} value={region.value}>
						{region.label}
					</NativeSelectOption>
				))}
			</NativeSelect>
		</div>
	);
}

/* -------------------------------------------------------------------------- */
/*                                   Schema                                   */
/* -------------------------------------------------------------------------- */

function renderChannels({ options }: FilterValueDisplayContext): React.ReactNode {
	return <PickedLabels options={options} empty="any channel" />;
}

function renderPermissions({ options }: FilterValueDisplayContext): React.ReactNode {
	return <PickedLabels options={options} empty="any permission" />;
}

function renderSwitch({ value }: FilterValueDisplayContext): React.ReactNode {
	return value === true ? "on" : "off";
}

const FIELDS: readonly FilterField[] = [
	{
		id: "channel",
		label: "Channel",
		type: "multiselect",
		// The options still ship, even though the editor draws its own rows: they
		// are what the chip resolves a stored value's LABEL from.
		options: CHANNELS,
		editor: ChannelToggles,
		renderValue: renderChannels,
		icon: <MonitorSmartphoneIcon />,
	},
	{
		id: "plan",
		label: "Plan",
		type: "select",
		options: PLANS.map((plan: Plan): FilterOption => ({ value: plan.value, label: plan.label })),
		editor: PlanRadios,
		icon: <CreditCardIcon />,
	},
	{
		id: "permissions",
		label: "Permissions",
		type: "multiselect",
		options: PERMISSIONS,
		editor: PermissionChecks,
		renderValue: renderPermissions,
		icon: <ShieldCheckIcon />,
	},
	{
		id: "region",
		label: "Region",
		type: "select",
		options: REGIONS,
		editor: RegionSelect,
		icon: <GlobeIcon />,
	},
	{
		id: "twoFactor",
		// The short form, because a chip is a row of them; the acronym is what a
		// filter list would call it anyway.
		label: "2FA",
		type: "boolean",
		editor: EnabledSwitch,
		renderValue: renderSwitch,
		icon: <KeyRoundIcon />,
	},
];

const INITIAL_QUERY: FilterQuery = createFilterQuery([
	createFilterRule({
		id: "seed-1",
		path: ["channel"],
		operator: "has_any_of",
		value: ["web", "ios"],
	}),
	createFilterRule({
		id: "seed-2",
		path: ["plan"],
		operator: "is",
		value: "pro",
	}),
	createFilterRule({
		id: "seed-3",
		path: ["region"],
		operator: "is",
		value: "emea",
	}),
	/*
        FOUR chips, and the fourth is the last one that fits.

        Five editors are on show, and seeding one chip each is the obvious
        thing: every editor would then be one press away. It does not fit, and
        the way it fails is worse than the click it saves. The bar is a wrapping
        row whose chips live in an inner toolbar, and a flex child that wraps
        internally claims the full width of its line, so the moment the fifth
        chip goes to a second row the toolbar owns BOTH rows and pushes Add
        filter and Clear onto a third - the trigger at the far left, Clear at
        the far right, a thousand pixels of nothing between them.

        Measured at the width a catalog card gives this bar (1128px), the five
        chips run 1172 to 1336 depending on the style against a budget of 977 to
        1036. No arrangement of five fits and no wording closes a 300px gap, so
        the count is the thing that gives. Two of the five drops leave a row that
        fits; this one clears sera by 64px where dropping Channel clears it by
        15, and it costs the least besides, because Permissions drew the same
        `PickedLabels` display the Channel chip already shows - and shows better,
        since Channel carries the overflow count too. Its editor is reachable
        from Add filter like any other field.
      */
	createFilterRule({
		id: "seed-4",
		path: ["twoFactor"],
		operator: "is",
		value: true,
	}),
]);

export function Filters8Example(): React.JSX.Element {
	const [query, setQuery] = React.useState<FilterQuery>(INITIAL_QUERY);

	return <Filters fields={FIELDS} query={query} onQueryChange={setQuery} showClear />;
}
