"use client";

import { isArrayValue } from "@workspace/shared";
import { Label } from "@workspace/ui/components/label";
import { Slider } from "@workspace/ui/components/slider";
import * as React from "react";

interface RatingLevel {
	readonly value: number;
	readonly emoji: string;
	readonly label: string;
}

const RATING_LEVELS: readonly RatingLevel[] = [
	{ value: 1, emoji: "😡", label: "Awful" },
	{ value: 2, emoji: "🙁", label: "Poor" },
	{ value: 3, emoji: "😐", label: "Okay" },
	{ value: 4, emoji: "🙂", label: "Good" },
	{ value: 5, emoji: "😍", label: "Amazing" },
];
const RATING_MIN = 1;
const RATING_MAX = 5;
const RATING_INITIAL = 3;
const RATING_STEP = 1;

export function Slider12Example(): React.JSX.Element {
	const [value, setValue] = React.useState(RATING_INITIAL);
	const level = RATING_LEVELS.find((candidate) => candidate.value === value);

	const handleValueChange = React.useCallback((next: number | readonly number[]): void => {
		const [first = RATING_INITIAL] = isArrayValue(next) ? next : [next];
		setValue(first);
	}, []);

	return (
		<div className="mx-auto grid w-full max-w-sm gap-3">
			<Label className="text-sm font-medium">Rate your experience</Label>
			<div className="flex items-center gap-3">
				<Slider aria-label="Experience rating" value={value} onValueChange={handleValueChange} min={RATING_MIN} max={RATING_MAX} step={RATING_STEP} />
				<span className="text-2xl" aria-hidden="true">
					{level?.emoji}
				</span>
			</div>
			<span className="text-center text-xs font-medium text-muted-foreground">{level?.label}</span>
		</div>
	);
}
