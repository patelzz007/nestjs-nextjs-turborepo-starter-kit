import { NumberField } from "@workspace/ui-native/components/number-field";
import * as React from "react";

export function NumberField5Example(): React.JSX.Element {
	const [value, setValue] = React.useState<number | null>(3);
	return <NumberField value={value} onChange={setValue} min={0} max={10} layout="spinner" accessibilityLabel="Quantity" />;
}
