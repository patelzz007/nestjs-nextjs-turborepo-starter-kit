import { NativeSelect, type NativeSelectOption } from "@workspace/ui-native/components/native-select";
import * as React from "react";

const SIZES: readonly NativeSelectOption<string>[] = [
	{ value: "m", label: "Medium" },
	{ value: "l", label: "Large" },
];

export function NativeSelect3Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("m");
	return <NativeSelect label="Size" options={SIZES} value={value} onChange={setValue} size="sm" />;
}
