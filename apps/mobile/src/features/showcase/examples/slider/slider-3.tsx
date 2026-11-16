import { RangeSlider } from "@workspace/ui-native/components/range-slider";
import * as React from "react";

const LABELS: readonly string[] = ["Low", "Middle", "High"];

export function Slider3Example(): React.JSX.Element {
	const [values, setValues] = React.useState<readonly number[]>([10, 40, 80]);
	return <RangeSlider value={values} onChange={setValues} step={10} thumbLabels={LABELS} />;
}
