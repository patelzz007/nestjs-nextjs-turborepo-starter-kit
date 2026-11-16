import { Slider } from "@workspace/ui-native/components/slider";
import * as React from "react";

export function SliderDo2Example(): React.JSX.Element {
	const [value, setValue] = React.useState<number>(20);
	return <Slider value={value} onChange={setValue} min={5} max={35} step={5} accessibilityLabel="Storage" />;
}
