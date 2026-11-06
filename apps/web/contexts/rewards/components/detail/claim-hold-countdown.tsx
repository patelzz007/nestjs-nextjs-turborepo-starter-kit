"use client";

import * as React from "react";

import { formatHoldTime, holdSecondsLeft } from "@/contexts/rewards/lib/claim-hold";

const TICK_MS = 1_000;

export interface ClaimHoldCountdownProps {
	readonly holdExpiresAt: number;
	/** The hold's time ran out. */
	readonly onExpired: () => void;
}

/** How long the customer's held unit stays theirs, ticking once a second. */
export function ClaimHoldCountdown({ holdExpiresAt, onExpired }: ClaimHoldCountdownProps): React.JSX.Element {
	const [secondsLeft, setSecondsLeft] = React.useState<number>(() => holdSecondsLeft(holdExpiresAt, Date.now()));

	React.useEffect((): (() => void) => {
		const timer = setInterval((): void => {
			const left = holdSecondsLeft(holdExpiresAt, Date.now());
			setSecondsLeft(left);
			if (left === 0) {
				clearInterval(timer);
				onExpired();
			}
		}, TICK_MS);
		return (): void => {
			clearInterval(timer);
		};
	}, [holdExpiresAt, onExpired]);

	return (
		<p className="text-sm text-muted-foreground" role="timer" aria-live="off">
			Held for you for <span className="font-medium text-foreground tabular-nums">{formatHoldTime(secondsLeft)}</span>
		</p>
	);
}
