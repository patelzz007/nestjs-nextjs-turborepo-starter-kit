"use client";

import { cn } from "@workspace/ui/lib/utils";
import { Lock } from "lucide-react";
import * as React from "react";

/**
 * Live "account locked — retry in MM:SS" countdown.
 *
 * Receives the initial `remainingSeconds` from the ACCOUNT_LOCKED error payload
 * and ticks down once per second (pausing while the tab is hidden, like the
 * session badge). When it hits zero the countdown freezes at 00:00 and the
 * caller can clear the lockout state on the next submit.
 */
export interface LockoutCountdownProps {
	/** Whole seconds until the lockout expires (from the API error payload). */
	readonly remainingSeconds: number;
	/** Optional class for the wrapper. */
	readonly className?: string;
}

function formatClock(totalSeconds: number): string {
	const safe: number = Math.max(0, totalSeconds);
	const minutes: number = Math.floor(safe / 60);
	const seconds: number = safe % 60;
	return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function LockoutCountdown({ remainingSeconds, className }: LockoutCountdownProps): React.JSX.Element {
	const [secondsLeft, setSecondsLeft] = React.useState<number>(() => Math.max(0, Math.round(remainingSeconds)));

	React.useEffect(() => {
		const tick = (): void => {
			setSecondsLeft((previous) => Math.max(0, previous - 1));
		};
		const timer = window.setInterval(tick, 1000);
		const onVisibilityChange = (): void => {
			if (document.visibilityState === "visible") {
				// Resync from the API-provided expiry on tab return.
				setSecondsLeft(() => Math.max(0, Math.round(remainingSeconds)));
			}
		};
		document.addEventListener("visibilitychange", onVisibilityChange);
		return (): void => {
			window.clearInterval(timer);
			document.removeEventListener("visibilitychange", onVisibilityChange);
		};
	}, [remainingSeconds]);

	const label: string = secondsLeft > 0 ? `Account locked — try again in ${formatClock(secondsLeft)}` : "Account locked — you can try again now";

	return (
		<p
			role="status"
			data-slot="lockout-countdown"
			className={cn(
				"flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-400",
				className,
			)}>
			<Lock className="size-3.5 shrink-0" aria-hidden="true" />
			<span className="tabular-nums">{label}</span>
		</p>
	);
}
