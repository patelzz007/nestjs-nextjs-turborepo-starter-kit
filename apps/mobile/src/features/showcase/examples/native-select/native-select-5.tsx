import { NativeSelect, type NativeSelectOption } from "@workspace/ui-native/components/native-select";
import * as React from "react";

import { ignorePress } from "../example-support";

const FRUITS: readonly NativeSelectOption<string>[] = [
	{ value: "apple", label: "Apple" },
	{ value: "banana", label: "Banana" },
	{ value: "grapes", label: "Grapes", disabled: true },
	{ value: "mango", label: "Mango" },
	{ value: "pear", label: "Pear" },
];

export function NativeSelect5Example(): React.JSX.Element {
	return <NativeSelect label="Fruit" options={FRUITS} value="apple" onChange={ignorePress} disabled />;
}
