import { Badge, type BadgeTone } from "@workspace/ui-native/components/badge";
import { SelectField, type SelectOption } from "@workspace/ui-native/components/select-field";
import * as React from "react";

interface Status {
	readonly value: string;
	readonly label: string;
	readonly tone: BadgeTone;
}

const STATUSES: readonly Status[] = [
	{ value: "in-progress", label: "In Progress", tone: "warning" },
	{ value: "completed", label: "Completed", tone: "success" },
	{ value: "pending", label: "Pending", tone: "info" },
	{ value: "cancelled", label: "Cancelled", tone: "neutral" },
	{ value: "rejected", label: "Rejected", tone: "destructive" },
];

const OPTIONS: readonly SelectOption<string>[] = STATUSES.map((status: Status): SelectOption<string> => ({
	value: status.value,
	label: status.label,
	trailing: <Badge label={status.label} tone={status.tone} variant="outline" size="sm" />,
}));

/** The field shows the chosen status as its badge. */
function StatusBadge(option: SelectOption<string>): React.JSX.Element {
	const tone = STATUSES.find((status: Status): boolean => status.value === option.value)?.tone ?? "neutral";
	return <Badge label={option.label} tone={tone} variant="outline" />;
}

export function Select19Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("pending");
	return <SelectField label="Status" hideLabel prefix="Status:" options={OPTIONS} value={value} onChange={setValue} renderValue={StatusBadge} />;
}
