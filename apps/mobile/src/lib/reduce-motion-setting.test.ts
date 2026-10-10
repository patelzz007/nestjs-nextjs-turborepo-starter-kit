import { AccessibilityInfo } from "react-native";

import { isReduceMotionOn } from "./reduce-motion-setting";

describe("isReduceMotionOn", () => {
	it("reports motion on until the OS answers, then what it says, and follows changes", async () => {
		jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
		const subscribe = jest.spyOn(AccessibilityInfo, "addEventListener");

		expect(isReduceMotionOn()).toBe(false);
		await Promise.resolve();
		expect(isReduceMotionOn()).toBe(true);
		expect(subscribe).toHaveBeenCalledWith("reduceMotionChanged", expect.any(Function));
		expect(subscribe).toHaveBeenCalledTimes(1);
	});
});
