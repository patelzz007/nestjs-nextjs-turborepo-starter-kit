import { act, renderHook } from "@testing-library/react-native";

import { SHEET_MOTION } from "../motion";
import { OVERLAY_HIDDEN, OVERLAY_SHOWN, useOverlayPresence } from "../use-overlay-presence";

interface Props {
	readonly visible: boolean;
}

beforeEach((): void => {
	jest.useFakeTimers();
});

afterEach((): void => {
	jest.useRealTimers();
});

describe("useOverlayPresence", () => {
	it("stays presented while it leaves, and unmounts only once fully hidden", async () => {
		const hook = await renderHook(({ visible }: Props) => useOverlayPresence(visible, SHEET_MOTION), { initialProps: { visible: true } });
		await act((): void => {
			jest.advanceTimersByTime(SHEET_MOTION.enter.duration);
		});
		expect(hook.result.current.progress.get()).toBe(OVERLAY_SHOWN);

		await hook.rerender({ visible: false });
		await act((): void => {
			jest.advanceTimersByTime(SHEET_MOTION.exit.duration - 1);
		});
		expect(hook.result.current.presented).toBe(true);

		await act((): void => {
			jest.advanceTimersByTime(SHEET_MOTION.exit.duration);
		});
		expect(hook.result.current.presented).toBe(false);
		expect(hook.result.current.progress.get()).toBe(OVERLAY_HIDDEN);
	});

	it("counts each opening, and a reopening while leaving stays open", async () => {
		const hook = await renderHook(({ visible }: Props) => useOverlayPresence(visible, SHEET_MOTION), { initialProps: { visible: false } });
		expect(hook.result.current).toMatchObject({ presented: false, opening: 0 });

		await hook.rerender({ visible: true });
		expect(hook.result.current).toMatchObject({ presented: true, opening: 1 });
		await hook.rerender({ visible: false });
		await hook.rerender({ visible: true });
		await act((): void => {
			jest.advanceTimersByTime(SHEET_MOTION.exit.duration + SHEET_MOTION.enter.duration);
		});
		expect(hook.result.current).toMatchObject({ presented: true, opening: 2 });
	});
});
