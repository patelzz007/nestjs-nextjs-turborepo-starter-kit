import { View } from "react-native";
import { SelectField, type SelectOption } from "@workspace/ui-native/components/select-field";
import * as React from "react";

const STATUS_FILTERS: readonly SelectOption<string>[] = [
	{ value: "all", label: "All Status" },
	{ value: "active", label: "Active", leading: <View className="size-2 rounded-full bg-success" /> },
	{ value: "paused", label: "Paused", leading: <View className="size-2 rounded-full bg-warning" /> },
	{ value: "archived", label: "Archived", leading: <View className="size-2 rounded-full bg-muted-foreground" /> },
	{ value: "failed", label: "Failed", leading: <View className="size-2 rounded-full bg-destructive" /> },
];

export function Select26Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("all");
	return <SelectField label="Status" hideLabel options={STATUS_FILTERS} value={value} onChange={setValue} size="sm" variant="muted" />;
}
