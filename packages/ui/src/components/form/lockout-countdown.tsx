"use client";

import { cn } from "@workspace/ui/lib/utils";
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

export interface LockoutCountdownLabels {
	/** Shown while locked, e.g. "Account locked — try again in" (clock appended). */
	readonly lockedPrefix: string;
	/** Shown when the countdown reaches zero. */
	readonly lockedExpired: string;
}

/**
 * Live lockout countdown — ticks once per second from `remainingSeconds`.
 */
export interface LockoutCountdownProps extends VariantProps<typeof lockoutCountdownVariants> {
	/** Whole seconds until the lockout expires (from the API error payload). */
	readonly remainingSeconds: number;
	readonly labels: LockoutCountdownLabels;
	readonly className?: string;
}

function formatClock(totalSeconds: number): string {
	const safe: number = Math.max(0, totalSeconds);
	const minutes: number = Math.floor(safe / 60);
	const seconds: number = safe % 60;
	return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export const LockoutCountdown = React.forwardRef<HTMLParagraphElement, LockoutCountdownProps>(function LockoutCountdown(
	{ remainingSeconds, labels, className, variant, size, state },
	ref,
): React.JSX.Element {
	const [secondsLeft, setSecondsLeft] = React.useState<number>(() => Math.max(0, Math.round(remainingSeconds)));

	React.useEffect(() => {
		const tick = (): void => {
			setSecondsLeft((previous) => Math.max(0, previous - 1));
		};
		const timer = window.setInterval(tick, 1000);
		const onVisibilityChange = (): void => {
			if (document.visibilityState === "visible") {
				setSecondsLeft(() => Math.max(0, Math.round(remainingSeconds)));
			}
		};
		document.addEventListener("visibilitychange", onVisibilityChange);
		return (): void => {
			window.clearInterval(timer);
			document.removeEventListener("visibilitychange", onVisibilityChange);
		};
	}, [remainingSeconds]);

	const label: string = secondsLeft > 0 ? `${labels.lockedPrefix} ${formatClock(secondsLeft)}` : labels.lockedExpired;

	return (
		<p ref={ref} role="status" data-slot="lockout-countdown" className={cn(lockoutCountdownVariants({ variant, size, state }), className)}>
			<Lock className="size-3.5 shrink-0" aria-hidden="true" />
			<span className="tabular-nums">{label}</span>
		</p>
	);
});

export { lockoutCountdownVariants };
