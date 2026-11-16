import { Slider } from "@workspace/ui-native/components/slider";
import * as React from "react";

export function SliderDont2Example(): React.JSX.Element {
	const [value, setValue] = React.useState<number>(470);
	return <Slider value={value} onChange={setValue} min={0} max={1000} accessibilityLabel="Exact amount" />;
}
