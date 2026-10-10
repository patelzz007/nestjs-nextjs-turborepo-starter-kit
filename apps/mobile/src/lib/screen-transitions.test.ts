import { Animated } from "react-native";

import { EMPHASIZED_EASING, PUSH_TRANSITION, ROOT_TRANSITION, TAB_TRANSITION_SPEC, tabSceneStyle } from "./screen-transitions";

/** The scene style a tab gets at a fixed position (-1 before the selected tab, 0 selected, 1 after). */
function sceneAt(position: number): ReturnType<typeof tabSceneStyle> {
	return tabSceneStyle({ current: { progress: new Animated.Value(position) } });
}

describe("screen transitions", () => {
	it("pushes with the iOS push on both platforms and fades between root groups", () => {
		expect(PUSH_TRANSITION).toBe("ios_from_right");
		expect(ROOT_TRANSITION).toBe("fade");
	});

	it("switches tabs with a quick timing curve from the tokens", () => {
		expect(TAB_TRANSITION_SPEC).toStrictEqual({ animation: "timing", config: { duration: 260, easing: EMPHASIZED_EASING } });
		expect(EMPHASIZED_EASING(1)).toBeCloseTo(1);
		// Decelerating: most of the way there early.
		expect(EMPHASIZED_EASING(0.3)).toBeGreaterThan(0.6);
	});

	it("shows the selected tab in place and fades its neighbours out a short way to their side", () => {
		expect(JSON.stringify(sceneAt(0).sceneStyle)).toBe(JSON.stringify({ opacity: 1, transform: [{ translateX: 0 }] }));
		expect(JSON.stringify(sceneAt(1).sceneStyle)).toBe(JSON.stringify({ opacity: 0, transform: [{ translateX: 16 }] }));
		expect(JSON.stringify(sceneAt(-1).sceneStyle)).toBe(JSON.stringify({ opacity: 0, transform: [{ translateX: -16 }] }));
	});
});
