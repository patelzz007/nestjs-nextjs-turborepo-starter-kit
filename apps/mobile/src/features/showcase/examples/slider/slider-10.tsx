import { Slider } from "@workspace/ui-native/components/slider";
import { type SliderMark } from "@workspace/ui-native/components/slider";
import * as React from "react";

/** A tick per month, labelled every second one. */
const MONTHS: readonly SliderMark[] = Array.from({ length: 13 }, (_unused: undefined, month: number): SliderMark =>
	month % 2 === 0 ? { value: month, label: String(month) } : { value: month },
);

function inMonths(value: number): string {
	return value === 1 ? "1 month" : `${String(value)} months`;
}

export function Slider10Example(): React.JSX.Element {
	const [value, setValue] = React.useState<number>(6);
	return <Slider value={value} onChange={setValue} min={0} max={12} marks={MONTHS} accessibilityLabel="Duration" formatValue={inMonths} />;
}
