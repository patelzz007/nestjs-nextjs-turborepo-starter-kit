import { NumberField } from "@workspace/ui-native/components/number-field";
import * as React from "react";

export function NumberFieldDont1Example(): React.JSX.Element {
	const [value, setValue] = React.useState<number | null>(3);
	return <NumberField value={value} onChange={setValue} accessibilityLabel="Guests" />;
}
