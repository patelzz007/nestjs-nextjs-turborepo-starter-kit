import { NumberField } from "@workspace/ui-native/components/number-field";
import * as React from "react";

export function NumberFieldDo2Example(): React.JSX.Element {
	const [value, setValue] = React.useState<number | null>(3);
	return <NumberField value={value} onChange={setValue} min={0} max={120} step={5} accessibilityLabel="Minutes" />;
}
