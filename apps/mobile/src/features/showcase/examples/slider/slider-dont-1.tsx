import { Slider } from "@workspace/ui-native/components/slider";
import * as React from "react";

export function SliderDont1Example(): React.JSX.Element {
	const [value, setValue] = React.useState<number>(60);
	return <Slider value={value} onChange={setValue} accessibilityLabel="Volume" />;
}
