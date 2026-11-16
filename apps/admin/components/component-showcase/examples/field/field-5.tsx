"use client";

import * as React from "react";
import { isArrayValue } from "@workspace/shared";
import { useCallback, useState } from "react";

import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldTitle } from "@workspace/ui/components/field";
import { Slider } from "@workspace/ui/components/slider";
import { Switch } from "@workspace/ui/components/switch";

const DEFAULT_CPU_PERCENT = 75;
const CPU_MAX_PERCENT = 100;
const CPU_STEP_PERCENT = 5;
const INITIAL_CPU_LIMIT: readonly number[] = [DEFAULT_CPU_PERCENT];

export function Field5Example(): React.JSX.Element {
	const [cpuLimit, setCpuLimit] = useState<readonly number[]>(INITIAL_CPU_LIMIT);
	const [cpuPercent = DEFAULT_CPU_PERCENT] = cpuLimit;

	const handleValueChange = useCallback((value: number | readonly number[]): void => {
		setCpuLimit(isArrayValue(value) ? value : [value]);
	}, []);

	return (
		<div className="mx-auto w-full max-w-xs">
			<FieldGroup>
				<Field orientation="horizontal">
					<FieldContent>
						<FieldTitle>High Performance Mode</FieldTitle>
						<FieldDescription>Prioritize speed over battery life for intensive tasks.</FieldDescription>
					</FieldContent>
					<Switch id="high-performance" defaultChecked />
				</Field>
				<Field>
					<div className="flex items-center justify-between">
						<FieldLabel htmlFor="cpu-allocation">CPU Allocation</FieldLabel>
						<span className="text-xs font-medium text-muted-foreground">{String(cpuPercent)}%</span>
					</div>
					<Slider id="cpu-allocation" value={cpuLimit} onValueChange={handleValueChange} max={CPU_MAX_PERCENT} step={CPU_STEP_PERCENT} />
					<FieldDescription>Limit the maximum CPU resources used by the application.</FieldDescription>
				</Field>
			</FieldGroup>
		</div>
	);
}
