import { act, renderHook } from "@testing-library/react-native";
import { DeviceEventEmitter, Keyboard, type KeyboardEvent, type KeyboardEventName } from "react-native";

import { useKeyboardVisible } from "./use-keyboard-visible";

/** What the OS sends when the keyboard moves. */
const KEYBOARD_EVENT: KeyboardEvent = {
	duration: 0,
	easing: "keyboard",
	endCoordinates: { height: 300, screenX: 0, screenY: 544, width: 390 },
	startCoordinates: { height: 0, screenX: 0, screenY: 844, width: 390 },
	isEventFromThisApp: true,
};

/** Plays a keyboard event the way the native keyboard observer delivers it. */
function emitKeyboard(eventName: KeyboardEventName): void {
	DeviceEventEmitter.emit(eventName, KEYBOARD_EVENT);
}

describe("useKeyboardVisible", () => {
	it("starts from whether the keyboard is open right now", async () => {
		jest.spyOn(Keyboard, "isVisible").mockReturnValue(true);

		const { result } = await renderHook(() => useKeyboardVisible());

		expect(result.current).toBe(true);
	});

	it("follows the keyboard opening and closing (iOS: before it moves)", async () => {
		jest.spyOn(Keyboard, "isVisible").mockReturnValue(false);
		const { result } = await renderHook(() => useKeyboardVisible());

		expect(result.current).toBe(false);
		await act((): void => {
			emitKeyboard("keyboardWillShow");
		});
		expect(result.current).toBe(true);
		await act((): void => {
			emitKeyboard("keyboardWillHide");
		});
		expect(result.current).toBe(false);
	});

	it("stops listening when it unmounts", async () => {
		const listenersBefore = DeviceEventEmitter.listenerCount("keyboardWillShow");
		const { unmount } = await renderHook(() => useKeyboardVisible());

		expect(DeviceEventEmitter.listenerCount("keyboardWillShow")).toBe(listenersBefore + 1);
		await unmount();
		expect(DeviceEventEmitter.listenerCount("keyboardWillShow")).toBe(listenersBefore);
		expect(DeviceEventEmitter.listenerCount("keyboardWillHide")).toBe(listenersBefore);
	});
});
