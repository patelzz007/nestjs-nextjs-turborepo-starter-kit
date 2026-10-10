import { act, renderHook } from "@testing-library/react-native";

import { useNow } from "./use-now";

const START_MS = 1_791_504_000_000;
const TICK_MS = 1_000;

describe("useNow", () => {
	beforeEach(() => {
		jest.useFakeTimers({ now: START_MS });
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("re-reads the clock every interval while running", async () => {
		const { result } = await renderHook(() => useNow({ intervalMs: TICK_MS, running: true }));
		expect(result.current).toBe(START_MS);

		await act((): void => {
			jest.advanceTimersByTime(TICK_MS);
		});
		expect(result.current).toBe(START_MS + TICK_MS);
	});

	it("keeps its last reading while stopped", async () => {
		const { result, rerender } = await renderHook(({ running }: { readonly running: boolean }) => useNow({ intervalMs: TICK_MS, running }), {
			initialProps: { running: true },
		});
		await rerender({ running: false });

		await act((): void => {
			jest.advanceTimersByTime(TICK_MS * 5);
		});
		expect(result.current).toBe(START_MS);
	});
});
