// React Native's idle callbacks (`requestIdleCallback` / `cancelIdleCallback`): the runtime calls them
// when the JS thread has nothing else to do. Jest's React Native environment does not provide them, so
// under test they run on the next timer tick, with a full idle budget — the code that schedules them
// (features/navigation/use-preloaded-tabs.ts) runs unchanged.

/** The time an idle callback is told it has left: the runtime's usual frame budget. */
const IDLE_BUDGET_MS = 50;
const NEXT_TICK_MS = 0;

export function installIdleCallbacks(): void {
	globalThis.requestIdleCallback = (callback: (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void): number =>
		setTimeout((): void => {
			callback({ didTimeout: false, timeRemaining: (): number => IDLE_BUDGET_MS });
		}, NEXT_TICK_MS);
	globalThis.cancelIdleCallback = (handle: number | null | undefined): void => {
		clearTimeout(handle ?? undefined);
	};
}
