import * as React from "react";

// The examples that need "now" (relative times, date bounds) read it the way
// the kit's own RelativeTime does: through `useSyncExternalStore`, from a
// snapshot taken once and then cached, so every render — and every example on
// the page — agrees on the same moment. Rendering stays pure.

/** The moment the first example asked for the time, in epoch milliseconds. */
let sampleNowMs: number | undefined;

function readSampleNow(): number {
	sampleNowMs ??= Date.now();
	return sampleNowMs;
}

/** The snapshot never changes after it is taken, so there is nothing to subscribe to. */
function subscribeToNothing(): () => void {
	return (): void => undefined;
}

/** The examples' shared "now", in epoch milliseconds: read once, then stable. */
export function useSampleNow(): number {
	return React.useSyncExternalStore(subscribeToNothing, readSampleNow, readSampleNow);
}
