import { act, renderHook } from "@testing-library/react-native";
import { AppState, type AppStateStatus, type NativeEventSubscription } from "react-native";

import { isForeground, useAppActive } from "./use-app-active";

describe("isForeground", () => {
	it.each([
		["active", true],
		["unknown", true],
		["background", false],
		["inactive", false],
	] satisfies [AppStateStatus, boolean][])("reads %s as %s", (state, expected) => {
		expect(isForeground(state)).toBe(expected);
	});

	it("reads no state yet (starting up) as the foreground", () => {
		expect(isForeground(null)).toBe(true);
	});
});

describe("useAppActive", () => {
	it("follows the app between the foreground and the background, and stops listening on unmount", async () => {
		let listener: ((state: AppStateStatus) => void) | null = null;
		const remove = jest.fn();
		jest.spyOn(AppState, "addEventListener").mockImplementation((_type, handler): NativeEventSubscription => {
			listener = handler;
			return { remove };
		});
		const { result, unmount } = await renderHook(() => useAppActive());
		const emit = (state: AppStateStatus): void => {
			listener?.(state);
		};

		await act((): void => {
			emit("background");
		});
		expect(result.current).toBe(false);
		await act((): void => {
			emit("active");
		});
		expect(result.current).toBe(true);
		await act((): void => {
			emit("inactive");
		});
		expect(result.current).toBe(false);

		await unmount();
		expect(remove).toHaveBeenCalledTimes(1);
	});
});
