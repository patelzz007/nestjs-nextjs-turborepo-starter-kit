import * as React from "react";
import { Slider } from "@workspace/ui/components/slider";

/** Three thumbs, one per value. */
const DEFAULT_THUMBS: readonly number[] = [10, 40, 80];

export function Slider3Example(): React.JSX.Element {
	return (
		<div className="flex w-full max-w-xs items-center justify-center">
			<Slider defaultValue={DEFAULT_THUMBS} max={100} step={10} />
		</div>
	);
}
