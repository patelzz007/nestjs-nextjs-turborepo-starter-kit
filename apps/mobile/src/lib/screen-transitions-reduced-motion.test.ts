import { Animated } from "react-native";

import { tabSceneStyle } from "./screen-transitions";

// The OS setting is the boundary here: Reduce Motion is on.
jest.mock("./reduce-motion-setting", () => ({ isReduceMotionOn: (): boolean => true }));

describe("the tab transition with Reduce Motion on", () => {
	it("drops the drift: tabs dissolve in place", () => {
		const scene = tabSceneStyle({ current: { progress: new Animated.Value(1) } });

		expect(JSON.stringify(scene.sceneStyle)).toBe(JSON.stringify({ opacity: 0, transform: [{ translateX: 0 }] }));
	});
});
