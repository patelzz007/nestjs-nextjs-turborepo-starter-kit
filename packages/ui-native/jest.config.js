// jest-expo for the React Native UI kit — the same runner, preset and
// resolution rules as apps/mobile (ADR 031): React Native's transforms and
// native-module mocks are built for Jest, not Vitest.

/** @type {import("jest").Config} */
module.exports = {
	preset: "jest-expo",
	resolver: "<rootDir>/jest.resolver.cjs",
	setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
	moduleNameMapper: {
		// Uniwind compiles CSS in Metro; tests render without styles.
		"\\.css$": "<rootDir>/test/style-mock.cjs",
	},
	// Tests live in `__tests__/` folders beside the code they test (rules/11 → "Where tests live").
	testMatch: ["<rootDir>/src/**/__tests__/**/*.test.{ts,tsx}"],
	clearMocks: true,
	restoreMocks: true,
};
