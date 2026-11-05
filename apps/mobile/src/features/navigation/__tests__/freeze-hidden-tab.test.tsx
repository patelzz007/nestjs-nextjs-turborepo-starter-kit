import { act, renderHook } from "@testing-library/react-native";
import { useIsFocused } from "expo-router";

import { PAGE_CHANGE_MS } from "@workspace/ui-native/lib/motion";

import { useFrozenWhileHidden } from "../freeze-hidden-tab";

jest.mock("expo-router", () => ({ ...jest.requireActual<object>("expo-router"), useIsFocused: jest.fn() }));

const focusedMock = jest.mocked(useIsFocused);

describe("useFrozenWhileHidden", () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("never freezes the tab on screen", async () => {
		focusedMock.mockReturnValue(true);
		const onSettled = jest.fn();
		const { result } = await renderHook(() => useFrozenWhileHidden(onSettled));
		await act((): void => {
			jest.advanceTimersByTime(PAGE_CHANGE_MS * 2);
		});
		expect(result.current).toBe(false);
		expect(onSettled).not.toHaveBeenCalled();
	});

	it("settles a tab out of sight once the switch away is over, calling onSettled first", async () => {
		focusedMock.mockReturnValue(false);
		const onSettled = jest.fn();
		const { result } = await renderHook(() => useFrozenWhileHidden(onSettled));
		expect(result.current).toBe(false);
		await act((): void => {
			jest.advanceTimersByTime(PAGE_CHANGE_MS);
		});
		expect(onSettled).toHaveBeenCalled();
		expect(result.current).toBe(true);
	});

	it("is visible again at once when the tab is focused again", async () => {
		focusedMock.mockReturnValue(false);
		const { result, rerender } = await renderHook(() => useFrozenWhileHidden(jest.fn()));
		await act((): void => {
			jest.advanceTimersByTime(PAGE_CHANGE_MS);
		});
		focusedMock.mockReturnValue(true);
		await rerender({});
		expect(result.current).toBe(false);
	});
});
