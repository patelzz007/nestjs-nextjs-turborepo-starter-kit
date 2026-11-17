"use client";

import { PERCENTAGE_MAX, PERCENTAGE_MIN } from "@workspace/shared";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import * as React from "react";

import { clampPercentage } from "./rule-editor/rollout-editor";

export interface PercentInputProps {
	readonly id: string;
	readonly label: string;
	readonly value: number;
	readonly onChange: (value: number) => void;
	readonly className?: string | undefined;
}

/** A share from 0 to 100, typed (controlled; what's typed is kept inside the range). */
export function PercentInput({ id, label, value, onChange, className }: PercentInputProps): React.JSX.Element {
	const handleChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			onChange(clampPercentage(event.target.value));
		},
		[onChange],
	);
	return (
		<div className={className ?? "space-y-1.5"}>
			<Label htmlFor={id}>{label}</Label>
			<Input id={id} type="number" inputMode="numeric" min={PERCENTAGE_MIN} max={PERCENTAGE_MAX} value={String(value)} onChange={handleChange} />
		</div>
	);
}

export interface DateTimeInputProps {
	readonly id: string;
	readonly label: string;
	/** A `datetime-local` value (empty: none). */
	readonly value: string;
	readonly onChange: (value: string) => void;
	readonly className?: string | undefined;
}

/** A local date and time (controlled; empty means none). */
export function DateTimeInput({ id, label, value, onChange, className }: DateTimeInputProps): React.JSX.Element {
	const handleChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			onChange(event.target.value);
		},
		[onChange],
	);
	return (
		<div className={className ?? "space-y-1.5"}>
			<Label htmlFor={id}>{label}</Label>
			<Input id={id} type="datetime-local" value={value} onChange={handleChange} />
		</div>
	);
}
