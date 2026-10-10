import { renderHook } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";

import { useReduceMotion } from "./use-reduce-motion";

describe("useReduceMotion", () => {
	it("starts with motion on, then follows what the OS reports", async () => {
		jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);

		const { result } = await renderHook(() => useReduceMotion());

		expect(result.current).toBe(true);
	});

	it("listens for changes to the setting, and lets go on unmount", async () => {
		jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
		const subscribe = jest.spyOn(AccessibilityInfo, "addEventListener");
		const { result, unmount } = await renderHook(() => useReduceMotion());

		expect(result.current).toBe(false);
		expect(subscribe).toHaveBeenCalledWith("reduceMotionChanged", expect.any(Function));
		await expect(unmount()).resolves.toBeUndefined();
	});

	it("keeps motion on when the OS cannot answer", async () => {
		jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockRejectedValue(new Error("unavailable"));

		const { result } = await renderHook(() => useReduceMotion());

		expect(result.current).toBe(false);
	});
});
