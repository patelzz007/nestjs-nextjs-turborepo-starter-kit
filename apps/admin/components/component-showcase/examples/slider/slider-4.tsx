import * as React from "react";
import { Slider } from "@workspace/ui/components/slider";

const SINGLE_VALUE: readonly number[] = [50];
const RANGE_VALUE: readonly number[] = [25, 75];

export function Slider4Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center gap-12">
			<Slider defaultValue={SINGLE_VALUE} max={100} step={1} orientation="vertical" className="h-40" />
			<Slider defaultValue={RANGE_VALUE} max={100} step={5} orientation="vertical" className="h-40" />
		</div>
	);
}
