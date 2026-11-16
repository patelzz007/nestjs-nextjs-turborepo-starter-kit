"use client";

import * as React from "react";
import { useCallback, useState } from "react";

import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

const VOLUME_MIN = 0;
const VOLUME_MAX = 100;
const DEFAULT_VOLUME = 50;
/** Range inputs report decimal integers. */
const DECIMAL_RADIX = 10;

export function Input29Example(): React.JSX.Element {
	const [value, setValue] = useState(DEFAULT_VOLUME);

	const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setValue(Number.parseInt(event.target.value, DECIMAL_RADIX));
	}, []);

	return (
		<Field className="w-full max-w-xs">
			<div className="flex items-center justify-between">
				<FieldLabel htmlFor="range-slider">Volume</FieldLabel>
				<span className="text-xs font-medium text-muted-foreground">{String(value)}</span>
			</div>
			<Input
				id="range-slider"
				type="range"
				min={VOLUME_MIN}
				max={VOLUME_MAX}
				value={value}
				onChange={handleChange}
				className="h-2 cursor-pointer appearance-none bg-muted accent-primary"
			/>
		</Field>
	);
}
