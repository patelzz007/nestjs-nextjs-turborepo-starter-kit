import * as React from "react";
import { Slider } from "@workspace/ui/components/slider";

const DEFAULT_VALUE: readonly number[] = [50];

export function Slider2Example(): React.JSX.Element {
	return (
		<div className="flex w-full max-w-xs items-center justify-center">
			<Slider defaultValue={DEFAULT_VALUE} max={100} step={1} disabled />
		</div>
	);
}
