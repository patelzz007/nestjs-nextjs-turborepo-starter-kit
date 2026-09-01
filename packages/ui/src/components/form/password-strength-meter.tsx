"use client";

import { cn } from "@workspace/ui/lib/utils";
import { CircleCheckBigIcon, CircleXIcon, ShieldAlertIcon, ShieldCheckIcon, ShieldIcon, type LucideIcon } from "lucide-react";
import * as React from "react";

/**
 * Presentational password strength meter.
 *
 * Pure UI: it receives the computed score/percent/label from a
 * `passwordStrength()` call in the host app (packages/ui stays free of
 * business logic). Renders a header row with a soft-token status badge, an
 * animated progress bar, and an optional ✓/✗ criterion checklist.
 *
 * Rule 20: forwards its ref to the root element (tests, measurement).
 * Rule 22: colors come from design tokens (`--destructive`, `--warning`,
 * `--info`, `--success` + soft variants), never raw palette classes.
 */

export interface PasswordStrengthCriterion {
	/** Human-readable criterion label (consumer-owned copy, i18n at the smart layer). */
	readonly label: string;
	/** Whether the criterion is currently met. */
	readonly met: boolean;
}

export interface PasswordStrengthMeterProps {
	/** 0–4 (0 = empty/very weak, 4 = strong). */
	readonly score: number;
	/** Label for the current score (e.g. "Good"). */
	readonly label: string;
	/** Percentage 0–100 driving the filled bar width. */
	readonly percent: number;
	/** Full criterion list with met state — renders the ✓/✗ checklist. */
	readonly criteria?: readonly PasswordStrengthCriterion[];
	/**
	 * Unmet criteria shown as ✗ rows — legacy prop, used only when `criteria`
	 * is not provided (kept for backward compatibility).
	 */
	readonly missing?: readonly string[];
	/** Optional class for the wrapper. */
	readonly className?: string;
}

interface StrengthTier {
	readonly minScore: number;
	/** Filled-bar color (design token). */
	readonly barClass: string;
	/** Soft badge chip classes (design tokens). */
	readonly chipClass: string;
	/** Badge icon for the tier. */
	readonly icon: LucideIcon;
}

/**
 * One entry per score tier. Colors are design tokens, so the meter adapts to
 * dark mode automatically (rule 22). 0–1 share destructive, then the ramp
 * moves warning → info → success so every label reads distinctly.
 */
const STRENGTH_TIERS: readonly StrengthTier[] = [
	{ minScore: 0, barClass: "bg-destructive", chipClass: "bg-destructive-soft text-destructive", icon: ShieldAlertIcon },
	{ minScore: 1, barClass: "bg-destructive", chipClass: "bg-destructive-soft text-destructive", icon: ShieldAlertIcon },
	{ minScore: 2, barClass: "bg-warning", chipClass: "bg-warning-soft text-warning", icon: ShieldIcon },
	{ minScore: 3, barClass: "bg-info", chipClass: "bg-info-soft text-info", icon: ShieldCheckIcon },
	{ minScore: 4, barClass: "bg-success", chipClass: "bg-success-soft text-success", icon: ShieldCheckIcon },
];

/** Iterate highest-first so the exact score tier wins (score >= minScore). */
function tierForScore(score: number): StrengthTier {
	// Index 0 covers score 0, so the accumulator is always set on the first pass.
	let tier: StrengthTier = STRENGTH_TIERS[0] ?? { minScore: 0, barClass: "bg-destructive", chipClass: "bg-destructive-soft text-destructive", icon: ShieldAlertIcon };
	for (const candidate of STRENGTH_TIERS) {
		if (score >= candidate.minScore) {
			tier = candidate;
		}
	}
	return tier;
}

const PasswordStrengthMeter = React.memo(
	React.forwardRef<HTMLDivElement, PasswordStrengthMeterProps>(function PasswordStrengthMeter(
		{ score, label, percent, criteria, missing = [], className },
		ref,
	): React.JSX.Element | null {
		if (percent <= 0) {
			return null;
		}

		const tier: StrengthTier = tierForScore(score);
		const TierIcon: LucideIcon = tier.icon;
		// `criteria` is the richer contract (all criteria with met state); the
		// legacy `missing` list is only a fallback for older consumers.
		const hasChecklist: boolean = criteria !== undefined || missing.length > 0;

		return (
			<div ref={ref} data-slot="password-strength" className={cn("space-y-2", className)}>
				{/* Header row: label + status badge (flex-wrap for narrow forms). */}
				<div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1" aria-live="polite">
					<span className="text-xs font-medium text-muted-foreground">Password strength</span>
					<span className={cn("inline-flex min-w-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", tier.chipClass)}>
						<TierIcon className="size-3.5 shrink-0" aria-hidden="true" />
						{label}
					</span>
				</div>

				{/* Animated progress bar — smooth width transition per keystroke. */}
				<div
					role="progressbar"
					aria-label={`Password strength: ${label}`}
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={percent}
					className="h-1.5 overflow-hidden rounded-full bg-muted">
					<div className={cn("h-full rounded-full transition-[width] duration-300 ease-out", tier.barClass)} style={{ width: `${String(percent)}%` }} />
				</div>

				{hasChecklist ? (
					<ul className="space-y-1">
						{criteria !== undefined
							? criteria.map((criterion) => (
									<li key={criterion.label} className="flex items-center gap-1.5 text-xs">
										{criterion.met ? (
											<CircleCheckBigIcon className="size-3.5 shrink-0 text-success" aria-hidden="true" />
										) : (
											<CircleXIcon className="size-3.5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
										)}
										<span className={cn("min-w-0", criterion.met ? "text-foreground" : "text-muted-foreground")}>{criterion.label}</span>
									</li>
								))
							: missing.map((criterion) => (
									<li key={criterion} className="flex items-center gap-1.5 text-xs text-muted-foreground">
										<CircleXIcon className="size-3.5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
										<span className="min-w-0">{criterion}</span>
									</li>
								))}
					</ul>
				) : null}
			</div>
		);
	}),
);

export { PasswordStrengthMeter };
