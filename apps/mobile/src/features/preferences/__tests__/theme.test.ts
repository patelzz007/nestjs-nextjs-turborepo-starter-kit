import { Appearance } from "react-native";

import { applyThemePreference } from "../theme";

const mockSetTheme = jest.fn();

jest.mock("uniwind", () => ({
	Uniwind: {
		setTheme: (theme: string): void => {
			mockSetTheme(theme);
		},
	},
}));

describe("applyThemePreference", () => {
	let setColorScheme: jest.SpyInstance;

	beforeEach((): void => {
		mockSetTheme.mockClear();
		setColorScheme = jest.spyOn(Appearance, "setColorScheme").mockImplementation((): void => undefined);
	});

	afterEach((): void => {
		setColorScheme.mockRestore();
	});

	it.each(["system", "light", "dark", "nord"] satisfies ("system" | "light" | "dark" | "nord")[])("hands %s to Uniwind", (theme) => {
		applyThemePreference(theme);
		expect(mockSetTheme).toHaveBeenCalledWith(theme);
	});

	it("leaves the OS colour scheme to Uniwind for system, light and dark", () => {
		applyThemePreference("system");
		applyThemePreference("light");
		applyThemePreference("dark");
		expect(setColorScheme).not.toHaveBeenCalled();
	});

	it("draws native controls dark under Nord, after Uniwind has switched", () => {
		applyThemePreference("nord");
		expect(setColorScheme).toHaveBeenCalledWith("dark");
		expect(mockSetTheme.mock.invocationCallOrder.at(0)).toBeLessThan(setColorScheme.mock.invocationCallOrder.at(0) ?? 0);
	});
});
