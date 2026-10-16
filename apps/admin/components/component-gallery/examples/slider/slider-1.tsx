import * as React from "react";
import { Slider } from "@workspace/ui/components/slider";

export function Slider1Example(): React.JSX.Element {
	return (
		<div className="flex w-full max-w-xs items-center justify-center">
			<Slider defaultValue={50} max={100} step={1} />
		</div>
	);
}
