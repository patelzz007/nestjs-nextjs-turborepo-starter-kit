import { act } from "@testing-library/react";
import { vi } from "vitest";

/** The engine's write is a zero-delay timer, which timers (real and fake alike) run 1 ms later at the earliest. */
const NEXT_TICK_MS = 1;

/**
 * Lets the URL-state engine write what it queued. `useUrlState` changes its
 * state at once but writes the address bar on the next tick, as in the
 * browser; a test asserting the URL (or a `pushState` spy) awaits this first.
 * Works under fake timers too.
 */
export async function flushUrlUpdates(): Promise<void> {
	await act(async (): Promise<void> => {
		if (vi.isFakeTimers()) {
			await vi.advanceTimersByTimeAsync(NEXT_TICK_MS);
			return;
		}
		await new Promise<void>((resolve: () => void): void => {
			setTimeout(resolve, NEXT_TICK_MS);
		});
	});
}
