"use client";

import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { cn } from "@workspace/ui/lib/core/utils";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { cva, type VariantProps } from "class-variance-authority";
import { Lock } from "lucide-react";
import * as React from "react";

const lockoutCountdownVariants = cva("flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium", {
	variants: {
		variant: {
			default: "border-warning/25 bg-warning/5 text-warning",
		},
		size: {
			default: "text-xs",
			sm: "px-2 py-1.5 text-xs",
		},
		state: {
			default: "",
			loading: "opacity-60",
			disabled: "opacity-50",
			error: "border-destructive/25 bg-destructive/5 text-destructive",
		},
	},
	defaultVariants: {
		variant: "default",
		size: "default",
		state: "default",
	},
});

/** The countdown's copy — the `lockoutCountdown` family of `UiKitLabels`. */
export interface LockoutCountdownLabels {
	/** Shown while locked, e.g. "Account locked — try again in" (clock appended). */
	readonly lockedPrefix: string;
	/** Shown when the countdown reaches zero. */
	readonly lockedExpired: string;
}

const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;
const TICK_INTERVAL_MS = MS_PER_SECOND;
/** Clock segments render as two digits (`04:07`). */
const CLOCK_SEGMENT_WIDTH = 2;

/**
 * Live lockout countdown. Uncontrolled by default: `remainingSeconds` fixes a
 * deadline (now + remainingSeconds) and the clock always shows the time left
 * until it — so a throttled background tab, or a tab that comes back into
 * view, shows the true remaining time instead of drifting or restarting.
 * Pass `secondsLeft` to drive the clock from the parent instead (e.g. a shared
 * timer or a test), in which case nothing ticks here.
 */
export interface LockoutCountdownProps extends VariantProps<typeof lockoutCountdownVariants> {
	/** Whole seconds until the lockout expires (from the API error payload). */
	readonly remainingSeconds: number;
	/** Controlled seconds left. When set, the parent owns the clock and the internal ticker is off. */
	readonly secondsLeft?: number;
	/** Per-usage overrides of the `lockoutCountdown` copy from `UiKitLabelsProvider`. */
	readonly labels?: UiKitLabelsOverride<"lockoutCountdown"> | undefined;
	readonly className?: string;
}

function wholeSeconds(seconds: number): number {
	return Math.max(0, Math.round(seconds));
}

/** Whole seconds from `now` until `deadlineMs`, rounded up so the clock reads 00:00 only once the deadline has passed. */
function secondsUntil(deadlineMs: number, now: number): number {
	return Math.max(0, Math.ceil((deadlineMs - now) / MS_PER_SECOND));
}

function formatClock(totalSeconds: number): string {
	const safe: number = Math.max(0, totalSeconds);
	const minutes: number = Math.floor(safe / SECONDS_PER_MINUTE);
	const seconds: number = safe % SECONDS_PER_MINUTE;
	return `${String(minutes).padStart(CLOCK_SEGMENT_WIDTH, "0")}:${String(seconds).padStart(CLOCK_SEGMENT_WIDTH, "0")}`;
}

export const LockoutCountdown = React.forwardRef<HTMLParagraphElement, LockoutCountdownProps>(function LockoutCountdown(
	{ remainingSeconds, secondsLeft: secondsLeftProp, labels: labelsOverride, className, variant, size, state },
	ref,
): React.JSX.Element {
	const labels = useUiKitLabels("lockoutCountdown", labelsOverride);
	const [secondsLeftState, setSecondsLeft] = React.useState<number>(() => wholeSeconds(remainingSeconds));
	// A new `remainingSeconds` (a fresh lockout) restarts the clock from it, during render — no stale frame.
	const [trackedRemainingSeconds, setTrackedRemainingSeconds] = React.useState<number>(remainingSeconds);
	if (trackedRemainingSeconds !== remainingSeconds) {
		setTrackedRemainingSeconds(remainingSeconds);
		setSecondsLeft(wholeSeconds(remainingSeconds));
	}
	const isControlled = secondsLeftProp !== undefined;
	const secondsLeft: number = isControlled ? wholeSeconds(secondsLeftProp) : secondsLeftState;

	React.useEffect(() => {
		if (isControlled) {
			return;
		}
		// The deadline is fixed when the lockout (`remainingSeconds`) arrives; every update re-derives from it.
		const deadlineMs = Date.now() + wholeSeconds(remainingSeconds) * MS_PER_SECOND;
		const sync = (): void => {
			setSecondsLeft(secondsUntil(deadlineMs, Date.now()));
		};
		const timer = window.setInterval(sync, TICK_INTERVAL_MS);
		const onVisibilityChange = (): void => {
			if (document.visibilityState === "visible") {
				sync();
			}
		};
		document.addEventListener("visibilitychange", onVisibilityChange);
		return (): void => {
			window.clearInterval(timer);
			document.removeEventListener("visibilitychange", onVisibilityChange);
		};
	}, [isControlled, remainingSeconds]);

	const label: string = secondsLeft > 0 ? `${labels.lockedPrefix} ${formatClock(secondsLeft)}` : labels.lockedExpired;

	return (
		<p ref={ref} role="status" data-slot="lockout-countdown" className={cn(lockoutCountdownVariants({ variant, size, state }), className)}>
			<Lock className="size-3.5 shrink-0" aria-hidden="true" />
			<span className="tabular-nums">{label}</span>
		</p>
	);
});

export { lockoutCountdownVariants };
