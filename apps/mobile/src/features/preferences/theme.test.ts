import { applyThemePreference } from "./theme";

const mockSetTheme = jest.fn();

jest.mock("uniwind", () => ({
	Uniwind: {
		setTheme: (theme: string): void => {
			mockSetTheme(theme);
		},
	},
}));

describe("applyThemePreference", () => {
	it.each(["system", "light", "dark"] satisfies ("system" | "light" | "dark")[])("hands %s to Uniwind", (theme) => {
		applyThemePreference(theme);
		expect(mockSetTheme).toHaveBeenCalledWith(theme);
	});
});
