import * as React from "react";
import { Slider } from "@workspace/ui/components/slider";

const DEFAULT_RANGE: readonly number[] = [25, 75];

export function Slider6Example(): React.JSX.Element {
	return (
		<div className="flex w-full max-w-xs items-center justify-center">
			<Slider defaultValue={DEFAULT_RANGE} max={100} step={5} />
		</div>
	);
}
