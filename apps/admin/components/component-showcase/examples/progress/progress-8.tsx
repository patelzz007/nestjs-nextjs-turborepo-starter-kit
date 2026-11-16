"use client";

import * as React from "react";
import { useEffect, useState } from "react";

import { Progress } from "@workspace/ui/components/progress";

/** The bars animate from 0 to this value shortly after mounting. */
const TARGET_PROGRESS = 75;
const FILL_DELAY_MS = 500;

export function Progress8Example(): React.JSX.Element {
	const [progress, setProgress] = useState(45);

	useEffect((): (() => void) => {
		const timer = setTimeout((): void => {
			setProgress(TARGET_PROGRESS);
		}, FILL_DELAY_MS);
		return (): void => {
			clearTimeout(timer);
		};
	}, []);

	return (
		<div className="mx-auto flex w-full max-w-xs flex-col gap-6">
			<Progress value={progress} className="**:data-[slot=progress-indicator]:bg-success" />
			<Progress value={progress} className="**:data-[slot=progress-indicator]:bg-warning" />
			<Progress value={progress} className="**:data-[slot=progress-indicator]:bg-tone-violet" />
			<Progress value={progress} className="**:data-[slot=progress-indicator]:bg-tone-blue" />
			<Progress value={progress} className="**:data-[slot=progress-indicator]:bg-tone-teal" />
		</div>
	);
}
