"use client";

import { cn } from "@workspace/ui/lib/utils";

/**
 * Presentational password strength meter.
 *
 * Pure UI: it receives the computed score/percent from a `passwordStrength()`
 * call in the host app (packages/ui stays framework-free of business logic).
 * Renders a 4-segment bar with color coding per score and an optional checklist
 * of unmet criteria.
 */
export interface PasswordStrengthMeterProps {
	/** 0–4 (0 = empty/very weak, 4 = strong). */
	readonly score: number;
	/** Label for the current score (e.g. "Good"). */
	readonly label: string;
	/** Percentage 0–100 driving the filled bar width. */
	readonly percent: number;
	/** Optional list of unmet criteria shown as a checklist below the bar. */
	readonly missing?: readonly string[];
}

const SEGMENT_COLORS: readonly { readonly minScore: number; readonly className: string }[] = [
	{ minScore: 0, className: "bg-red-500" },
	{ minScore: 1, className: "bg-orange-500" },
	{ minScore: 2, className: "bg-amber-500" },
	{ minScore: 3, className: "bg-emerald-500" },
	{ minScore: 4, className: "bg-emerald-600" },
];

function colorForScore(score: number): string {
	for (const entry of SEGMENT_COLORS) {
		if (score >= entry.minScore) {
			return entry.className;
		}
	}
	return SEGMENT_COLORS[0]?.className ?? "bg-red-500";
}

export function PasswordStrengthMeter({ score, label, percent, missing = [] }: PasswordStrengthMeterProps): React.JSX.Element | null {
	if (percent <= 0) {
		return null;
	}

	const activeColor: string = colorForScore(score);

	return (
		<div className="space-y-1.5" data-slot="password-strength" aria-live="polite">
			<div className="flex items-center justify-between text-xs">
				<span className="text-muted-foreground">Password strength</span>
				<span className={cn("font-medium", activeColor)}>{label}</span>
			</div>

			{/* 4 equal segments; filled up to the score, colored by strength. */}
			<div className="flex gap-1" aria-hidden="true">
				{[0, 1, 2, 3].map((index) => {
					const filled = index < Math.round(score);
					return <div key={String(index)} className={cn("h-1 flex-1 rounded-full", filled ? activeColor : "bg-muted")} />;
				})}
			</div>

			{missing.length > 0 ? (
				<ul className="space-y-0.5">
					{missing.map((criterion) => (
						<li key={criterion} className="flex items-center gap-1.5 text-xs text-muted-foreground">
							<span className="size-1 rounded-full bg-muted-foreground/40" aria-hidden="true" />
							{criterion}
						</li>
					))}
				</ul>
			) : null}
		</div>
	);
}
