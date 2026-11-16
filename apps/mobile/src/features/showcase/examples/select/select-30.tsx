import { Badge, type BadgeTone, type BadgeVariant } from "@workspace/ui-native/components/badge";
import { SelectField, type SelectOption } from "@workspace/ui-native/components/select-field";
import * as React from "react";

interface Priority {
	readonly value: string;
	readonly label: string;
	readonly tone: BadgeTone;
	readonly variant: BadgeVariant;
}

const PRIORITIES: readonly Priority[] = [
	{ value: "none", label: "No Priority", tone: "neutral", variant: "outline" },
	{ value: "low", label: "Low", tone: "info", variant: "soft" },
	{ value: "medium", label: "Medium", tone: "warning", variant: "soft" },
	{ value: "high", label: "High", tone: "warning", variant: "solid" },
	{ value: "urgent", label: "Urgent", tone: "destructive", variant: "solid" },
];

const OPTIONS: readonly SelectOption<string>[] = PRIORITIES.map((priority: Priority): SelectOption<string> => ({
	value: priority.value,
	label: priority.label,
	leading: <Badge label={priority.label.slice(0, 1)} tone={priority.tone} variant={priority.variant} size="sm" />,
}));

/** The field shows the chosen priority as its badge. */
function PriorityBadge(option: SelectOption<string>): React.JSX.Element {
	const priority = PRIORITIES.find((item: Priority): boolean => item.value === option.value);
	return <Badge label={option.label} tone={priority?.tone ?? "neutral"} variant={priority?.variant ?? "outline"} />;
}

export function Select30Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("medium");
	return <SelectField label="Priority" options={OPTIONS} value={value} onChange={setValue} renderValue={PriorityBadge} />;
}
