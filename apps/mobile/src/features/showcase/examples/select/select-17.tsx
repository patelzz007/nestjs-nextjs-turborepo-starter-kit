import { View } from "react-native";
import { SelectField, type SelectOption } from "@workspace/ui-native/components/select-field";
import * as React from "react";

const STATUSES: readonly SelectOption<string>[] = [
	{ value: "in-progress", label: "In Progress", leading: <View className="size-2 rounded-full bg-tone-violet" /> },
	{ value: "completed", label: "Completed", leading: <View className="size-2 rounded-full bg-success" /> },
	{ value: "pending", label: "Pending", leading: <View className="size-2 rounded-full bg-primary" /> },
	{ value: "cancelled", label: "Cancelled", leading: <View className="size-2 rounded-full bg-warning" /> },
	{ value: "rejected", label: "Rejected", leading: <View className="size-2 rounded-full bg-destructive" /> },
];

export function Select17Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("completed");
	return <SelectField label="Status" options={STATUSES} value={value} onChange={setValue} />;
}
