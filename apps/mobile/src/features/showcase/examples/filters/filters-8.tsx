import { filterValueItems, type FilterOperator } from "@workspace/ui-kit-logic";
import { RadioGroup } from "@workspace/ui-native/components/radio-group";
import { SegmentedControl } from "@workspace/ui-native/components/segmented-control";
import { Switch } from "@workspace/ui-native/components/switch";
import { ToggleGroup } from "@workspace/ui-native/components/toggle-group";
import type { FilterBarEditorProps, FilterBarField } from "@workspace/ui-native/lib/filters";
import * as React from "react";

import { FilterBar, PRIORITIES, scalarText } from "./filters-sample";

const IS: readonly FilterOperator[] = [{ value: "is", label: "is" }];
const ANY_OF: readonly FilterOperator[] = [{ value: "has_any_of", label: "has any of", arity: "many" }];

/** The first item of a value as text, else `fallback`. */
function firstText(value: FilterBarEditorProps["value"], fallback: string): string {
	const [item] = filterValueItems(value);
	const text = scalarText(item);
	return text === "" ? fallback : text;
}

/** Four priorities fit one row of segments. */
function PriorityEditor({ field, value, onValueChange }: FilterBarEditorProps): React.JSX.Element {
	const options = (field.options ?? []).map((option) => ({ value: option.value, label: option.label }));
	return <SegmentedControl label={field.label} options={options} value={firstText(value, options.at(0)?.value ?? "")} onChange={onValueChange} />;
}

/** Channels read better as a list with descriptions. */
function ChannelEditor({ field, value, onValueChange }: FilterBarEditorProps): React.JSX.Element {
	const options = (field.options ?? []).map((option) => ({ value: option.value, label: option.label, description: option.description ?? "" }));
	return <RadioGroup label={field.label} options={options} value={firstText(value, "")} onChange={onValueChange} />;
}

/** Tags pressed on and off, several at once. */
function TagEditor({ field, value, onValueChange }: FilterBarEditorProps): React.JSX.Element {
	const options = (field.options ?? []).map((option) => ({ value: option.value, label: option.label }));
	const pressed = filterValueItems(value).map(scalarText);
	const change = React.useCallback(
		(next: readonly string[]): void => {
			onValueChange([...next]);
		},
		[onValueChange],
	);
	return <ToggleGroup type="multiple" label={field.label} options={options} value={pressed} onChange={change} />;
}

/** A yes or no. */
function FlagEditor({ field, value, onValueChange }: FilterBarEditorProps): React.JSX.Element {
	const [item] = filterValueItems(value);
	return <Switch label={field.label} checked={item === true} onChange={onValueChange} />;
}

const FIELDS: readonly FilterBarField[] = [
	{ id: "priority", label: "Priority", operators: IS, options: PRIORITIES, editor: PriorityEditor },
	{
		id: "channel",
		label: "Channel",
		operators: IS,
		editor: ChannelEditor,
		options: [
			{ value: "email", label: "Email", description: "Replies within a day" },
			{ value: "chat", label: "Chat", description: "Answered live" },
			{ value: "phone", label: "Phone", description: "Calls, with a callback" },
		],
	},
	{
		id: "tags",
		label: "Tags",
		operators: ANY_OF,
		editor: TagEditor,
		options: ["Bug", "Billing", "Feature", "Docs"].map((tag: string) => ({ value: tag.toLowerCase(), label: tag })),
	},
	{ id: "vip", label: "VIP customer", operators: IS, editor: FlagEditor },
];

// The kit's choice controls as editors: segments, radios, toggle chips and a switch.
export function Filters8Example(): React.JSX.Element {
	return <FilterBar fields={FIELDS} showQuery />;
}
