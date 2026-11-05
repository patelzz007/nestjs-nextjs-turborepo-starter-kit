import { keyboardSystemBars } from "../keyboard-system-bars";

describe("keyboardSystemBars", () => {
	it("passes nothing when the provider detects edge to edge itself (a development or release build)", () => {
		expect(keyboardSystemBars(true)).toEqual({});
	});

	it("marks both system bars translucent when it cannot (Expo Go)", () => {
		expect(keyboardSystemBars(false)).toEqual({ statusBarTranslucent: true, navigationBarTranslucent: true });
	});
});
