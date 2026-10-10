// Runs before every mobile test file (jest.config.js → setupFilesAfterEnv).
// Only BOUNDARIES are replaced here — native modules with no JavaScript
// implementation under Jest (ADR 031, rules/11): the OS secret store becomes an
// in-memory map each test can inspect and reset, Uniwind (compiled by Metro)
// renders unstyled, and Reanimated's native worklet runtime runs on the JS thread.

import "@testing-library/react-native/matchers";
import type * as Worklets from "react-native-worklets";

// `mock…` names are the only outer variables a hoisted jest.mock factory may use.
import { memorySecureStore as mockSecureStore } from "./test/secure-store-memory";
import * as mockUniwind from "./test/uniwind-mock";

jest.mock("expo-secure-store", () => mockSecureStore);
// Uniwind compiles styles in Metro, not under Jest (test/uniwind-mock.tsx).
jest.mock("uniwind", () => mockUniwind);
// Reanimated's worklet runtime is native; its own Jest stand-in runs worklets on the JS thread,
// so the real Reanimated (springs, animated styles) runs under test (ADR 036).
jest.mock("react-native-worklets", () => jest.requireActual<typeof Worklets>("react-native-worklets/src/mock"));

beforeEach(() => {
	mockSecureStore.reset();
});
