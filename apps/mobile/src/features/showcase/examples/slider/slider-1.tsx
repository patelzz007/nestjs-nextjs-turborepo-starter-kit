import { Slider } from "@workspace/ui-native/components/slider";
import * as React from "react";

export function Slider1Example(): React.JSX.Element {
	const [value, setValue] = React.useState<number>(50);
	return <Slider value={value} onChange={setValue} accessibilityLabel="Value" />;
}
