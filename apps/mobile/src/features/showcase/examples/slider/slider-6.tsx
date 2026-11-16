import { RangeSlider } from "@workspace/ui-native/components/range-slider";
import * as React from "react";

const LABELS: readonly string[] = ["Minimum", "Maximum"];

export function Slider6Example(): React.JSX.Element {
	const [values, setValues] = React.useState<readonly number[]>([25, 75]);
	return <RangeSlider value={values} onChange={setValues} thumbLabels={LABELS} />;
}
