import { MultiSelectField, type SelectOption } from "@workspace/ui-native/components/select-field";
import * as React from "react";
import { Text } from "react-native";

const FRUITS: readonly SelectOption<string>[] = [
	{ value: "apple", label: "Apple" },
	{ value: "banana", label: "Banana" },
	{ value: "blueberry", label: "Blueberry" },
	{ value: "grapes", label: "Grapes" },
	{ value: "pineapple", label: "Pineapple" },
	{ value: "strawberry", label: "Strawberry" },
	{ value: "watermelon", label: "Watermelon" },
];

const NO_FRUITS: readonly string[] = [];

/** The field's summary: the one fruit's name, or how many are chosen. */
function FruitSummary(chosen: readonly SelectOption<string>[]): React.JSX.Element {
	const [only] = chosen;
	const summary = chosen.length === 1 && only !== undefined ? only.label : `${String(chosen.length)} fruits selected`;
	return <Text className="text-body-lg font-sans text-foreground">{summary}</Text>;
}

export function Select12Example(): React.JSX.Element {
	const [values, setValues] = React.useState<readonly string[]>(NO_FRUITS);
	return <MultiSelectField label="Fruits" options={FRUITS} values={values} onChange={setValues} placeholder="Select fruits" renderValues={FruitSummary} />;
}
