// Runs before every mobile test file (jest.config.js → setupFilesAfterEnv).
// Only BOUNDARIES are replaced here — native modules with no JavaScript
// implementation under Jest (ADR 031, rules/11): the OS secret store becomes an
// in-memory map each test can inspect and reset, and Uniwind (compiled by
// Metro) renders unstyled.

import "@testing-library/react-native/matchers";

// `mock…` names are the only outer variables a hoisted jest.mock factory may use.
import { memorySecureStore as mockSecureStore } from "./test/secure-store-memory";
import * as mockUniwind from "./test/uniwind-mock";

jest.mock("expo-secure-store", () => mockSecureStore);
// Uniwind compiles styles in Metro, not under Jest (test/uniwind-mock.tsx).
jest.mock("uniwind", () => mockUniwind);

beforeEach(() => {
	mockSecureStore.reset();
});
