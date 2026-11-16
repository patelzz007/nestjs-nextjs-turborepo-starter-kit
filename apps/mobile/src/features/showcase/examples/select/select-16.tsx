import { Text } from "react-native";
import { SelectField, type SelectOption } from "@workspace/ui-native/components/select-field";
import * as React from "react";

const ACCESS_LEVELS: readonly SelectOption<string>[] = [
	{ value: "full_access", label: "Full access", description: "Can modify list and invite members" },
	{ value: "read_write", label: "Read and write", description: "Can edit and publish lists" },
	{ value: "read_only", label: "Read only", description: "Can only view lists" },
	{ value: "no_access", label: "No access", description: "Cannot view or edit lists" },
];

/** The field shows the level's name alone; the list explains each one. */
function LevelName(option: SelectOption<string>): React.JSX.Element {
	return <Text className="text-body-lg font-sans text-foreground">{option.label}</Text>;
}

export function Select16Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("read_write");
	return <SelectField label="Access" options={ACCESS_LEVELS} value={value} onChange={setValue} renderValue={LevelName} />;
}
