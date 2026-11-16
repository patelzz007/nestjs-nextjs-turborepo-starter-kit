import { NativeSelect } from "@workspace/ui-native/components/native-select";
import * as React from "react";

const SIZES = [
	{ value: "s", label: "Small" },
	{ value: "m", label: "Medium" },
	{ value: "l", label: "Large" },
];

export function NativeSelectDo2Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>(null);
	return <NativeSelect label="Size" options={SIZES} value={value} onChange={setValue} placeholder="Pick a size" />;
}
