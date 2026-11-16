import { Field } from "@workspace/ui-native/components/field";
import { NativeSelect, type NativeSelectOption } from "@workspace/ui-native/components/native-select";
import * as React from "react";

const COUNTRIES: readonly NativeSelectOption<string>[] = [
	{ value: "my", label: "Malaysia" },
	{ value: "sg", label: "Singapore" },
	{ value: "id", label: "Indonesia" },
];

export function NativeSelect4Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("my");
	return (
		<Field label="Country" hint="Where the company is registered.">
			<NativeSelect label="Country" options={COUNTRIES} value={value} onChange={setValue} />
		</Field>
	);
}
