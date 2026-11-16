import { SelectField, type SelectOption } from "@workspace/ui-native/components/select-field";
import * as React from "react";

const SIZES: readonly SelectOption<string>[] = [
	{ value: "sm", label: "Small" },
	{ value: "md", label: "Medium" },
	{ value: "lg", label: "Large" },
	{ value: "xl", label: "Extra Large" },
];

export function Select33Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("md");
	return <SelectField label="Size" options={SIZES} value={value} onChange={setValue} size="sm" />;
}
