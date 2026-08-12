"use client";

// ============================================
// components/telescope/range-picker.tsx
// Segmented control for the overview time range. Dumb: options are static,
// the current value + change callback arrive via props.
// ============================================

import { cn } from "@workspace/ui/lib/utils";
import { useCallback } from "react";

import type { TelescopeRange } from "@workspace/shared";

const RANGE_OPTIONS: readonly { readonly value: TelescopeRange; readonly label: string }[] = [
	{ value: "15m", label: "15m" },
	{ value: "1h", label: "1h" },
	{ value: "6h", label: "6h" },
	{ value: "24h", label: "24h" },
];

export interface RangePickerProps {
	readonly value: TelescopeRange;
	readonly onChange: (range: TelescopeRange) => void;
}

interface RangeOptionButtonProps {
	readonly option: { readonly value: TelescopeRange; readonly label: string };
	readonly active: boolean;
	readonly onSelect: (range: TelescopeRange) => void;
}

/** One segment — the per-option closure lives here (rule 16). */
function RangeOptionButton({ option, active, onSelect }: RangeOptionButtonProps): React.JSX.Element {
	const handleClick = useCallback((): void => {
		onSelect(option.value);
	}, [onSelect, option.value]);

	return (
		<button
			type="button"
			aria-pressed={active}
			onClick={handleClick}
			className={cn(
				"rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
				active ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
			)}>
			{option.label}
		</button>
	);
}

/** Segmented time-range control — buttons announce state via `aria-pressed`. */
export function RangePicker({ value, onChange }: RangePickerProps): React.JSX.Element {
	return (
		<div role="group" aria-label="Time range" className="inline-flex items-center gap-0.5 rounded-lg border border-input bg-background p-0.5">
			{RANGE_OPTIONS.map((option) => (
				<RangeOptionButton key={option.value} option={option} active={option.value === value} onSelect={onChange} />
			))}
		</div>
	);
}
