import { render, renderHook } from "@testing-library/react-native";
import * as SystemUI from "expo-system-ui";
import * as React from "react";
import { Text } from "react-native";

import * as mockUniwindDefaults from "../../test/uniwind-mock";
import { NavigationThemeProvider, useNavigationTheme } from "./navigation-theme";

const mockTheme = { current: "dark" };
/** Token colours as the stylesheet resolves them, per CSS variable. */
const mockColors: Readonly<Record<string, string>> = {
	"--background": "#1d1d1d",
	"--card": "#2b2b2b",
	"--foreground": "#f5f5f5",
	"--border": "#393939",
	"--primary": "#f1f4f9",
	"--destructive": "#e5484d",
};

jest.mock("uniwind", () => ({
	...mockUniwindDefaults,
	useUniwind: (): { readonly theme: string; readonly hasAdaptiveThemes: boolean } => ({ theme: mockTheme.current, hasAdaptiveThemes: true }),
	useCSSVariable: (name: string): string | undefined => mockColors[name],
}));

describe("useNavigationTheme", () => {
	it("gives the navigators the token colours of the theme on screen — never their default white", async () => {
		mockTheme.current = "dark";
		const { result } = await renderHook(() => useNavigationTheme());

		expect(result.current.dark).toBe(true);
		expect(result.current.colors).toStrictEqual({ background: "#1d1d1d", card: "#2b2b2b", text: "#f5f5f5", border: "#393939", primary: "#f1f4f9", notification: "#e5484d" });
	});

	it("uses the light base in the light theme", async () => {
		mockTheme.current = "light";
		const { result } = await renderHook(() => useNavigationTheme());

		expect(result.current.dark).toBe(false);
		expect(result.current.colors.background).toBe("#1d1d1d");
	});
});

describe("NavigationThemeProvider", () => {
	it("paints the native root window the page colour, so nothing behind a moving screen flashes", async () => {
		mockTheme.current = "dark";
		const setBackground = jest.spyOn(SystemUI, "setBackgroundColorAsync").mockResolvedValue(undefined);

		await render(
			<NavigationThemeProvider>
				<Text>screen</Text>
			</NavigationThemeProvider>,
		);

		expect(setBackground).toHaveBeenCalledWith("#1d1d1d");
	});
});
