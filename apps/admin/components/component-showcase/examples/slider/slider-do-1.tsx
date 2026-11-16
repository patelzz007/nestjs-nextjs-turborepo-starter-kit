import * as React from "react";
import { isArrayValue } from "@workspace/shared";
import { Label } from "@workspace/ui/components/label";
import { Slider } from "@workspace/ui/components/slider";

const INITIAL_VOLUME = 60;

export function SliderDo1Example(): React.JSX.Element {
	const [volume, setVolume] = React.useState<number>(INITIAL_VOLUME);
	const change = React.useCallback((value: number | readonly number[]): void => {
		const [first = INITIAL_VOLUME] = isArrayValue(value) ? value : [value];
		setVolume(first);
	}, []);
	return (
		<div className="flex w-full max-w-xs flex-col gap-2">
			<div className="flex justify-between text-sm">
				<Label id="slider-do-1-label">Volume</Label>
				<span className="text-muted-foreground tabular-nums">{`${String(volume)}%`}</span>
			</div>
			<Slider value={volume} onValueChange={change} max={100} aria-labelledby="slider-do-1-label" />
		</div>
	);
}
