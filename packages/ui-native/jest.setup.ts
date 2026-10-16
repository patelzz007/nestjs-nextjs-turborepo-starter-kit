// Runs before every kit test file (jest.config.js → setupFilesAfterEnv). Only
// BOUNDARIES are replaced — native modules with no JavaScript implementation
// under Jest (ADR 031, rules/11): Uniwind (compiled by Metro) renders
// unstyled, the keyboard is keyboard-controller's own Jest stand-in, and
// Reanimated's native worklet runtime runs on the JS thread.

import "@testing-library/react-native/matchers";
import { cleanup } from "@testing-library/react-native";
import type * as KeyboardController from "react-native-keyboard-controller";
import type * as Worklets from "react-native-worklets";

// `mock…` names are the only outer variables a hoisted jest.mock factory may use.
import * as mockUniwind from "./test/uniwind-mock";

jest.mock("uniwind", () => mockUniwind);
jest.mock("react-native-keyboard-controller", () => jest.requireActual<typeof KeyboardController>("react-native-keyboard-controller/jest"));
jest.mock("react-native-worklets", () => jest.requireActual<typeof Worklets>("react-native-worklets/src/mock"));

afterEach(async () => {
	await cleanup();
});
