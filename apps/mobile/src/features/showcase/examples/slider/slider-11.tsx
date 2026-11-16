import { Slider } from "@workspace/ui-native/components/slider";
import * as React from "react";

function asPercent(value: number): string {
	return `${String(value)}%`;
}

export function Slider11Example(): React.JSX.Element {
	const [value, setValue] = React.useState<number>(60);
	return <Slider value={value} onChange={setValue} showValueBubble formatValue={asPercent} accessibilityLabel="Volume" className="mt-6" />;
}
