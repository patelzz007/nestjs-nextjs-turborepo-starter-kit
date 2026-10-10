// The current time (epoch ms), re-read every `intervalMs` while `running` —
// a clock for countdowns. Stopped, it keeps the last reading and holds no timer.

import * as React from "react";

export interface UseNowOptions {
	readonly intervalMs: number;
	readonly running: boolean;
}

export function useNow({ intervalMs, running }: UseNowOptions): number {
	const [nowMs, setNowMs] = React.useState<number>(Date.now);

	React.useEffect((): (() => void) | undefined => {
		if (!running) {
			return undefined;
		}
		const timer = setInterval((): void => {
			setNowMs(Date.now());
		}, intervalMs);
		return (): void => {
			clearInterval(timer);
		};
	}, [intervalMs, running]);

	return nowMs;
}
