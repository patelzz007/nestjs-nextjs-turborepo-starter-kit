"use client";

import * as React from "react";
import { isArrayValue } from "@workspace/shared";
import { useCallback, useState } from "react";

import { Progress } from "@workspace/ui/components/progress";
import { Slider } from "@workspace/ui/components/slider";

const INITIAL_VALUE = 50;

export function Progress6Example(): React.JSX.Element {
	const [value, setValue] = useState(INITIAL_VALUE);

	const handleValueChange = useCallback((next: number | readonly number[]): void => {
		const [first = INITIAL_VALUE] = isArrayValue(next) ? next : [next];
		setValue(first);
	}, []);
	const sliderValue = React.useMemo((): readonly number[] => [value], [value]);

	return (
		<div className="mx-auto flex w-full max-w-xs flex-col gap-6">
			<Progress value={value} />
			<Slider value={sliderValue} onValueChange={handleValueChange} min={0} max={100} step={1} />
		</div>
	);
}
