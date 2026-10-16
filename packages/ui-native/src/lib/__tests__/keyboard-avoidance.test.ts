import { KEYBOARD_AVOIDING_BEHAVIOR } from "../keyboard-avoidance";

describe("KEYBOARD_AVOIDING_BEHAVIOR", () => {
	it("pads on every platform — edge-to-edge Android no longer resizes the window, so a screen, a sheet and an auth page must pad", () => {
		expect(KEYBOARD_AVOIDING_BEHAVIOR).toBe("padding");
	});
});
