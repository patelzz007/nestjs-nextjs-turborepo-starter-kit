import { renderHook } from "@testing-library/react-native";
import * as ExpoFont from "expo-font";

import { APP_FONTS, useAppFonts } from "./fonts";

jest.mock("expo-font", () => ({ useFonts: jest.fn() }));

describe("APP_FONTS", () => {
	it("registers the web's typefaces, one family per weight", () => {
		expect(Object.keys(APP_FONTS)).toStrictEqual([
			"Geist_400Regular",
			"Geist_500Medium",
			"Geist_600SemiBold",
			"Geist_700Bold",
			"BricolageGrotesque_600SemiBold",
			"GeistMono_400Regular",
		]);
	});
});

describe("useAppFonts", () => {
	it("loads every app font", async () => {
		jest.mocked(ExpoFont.useFonts).mockReturnValue([false, null]);

		await renderHook(() => useAppFonts());

		expect(ExpoFont.useFonts).toHaveBeenCalledWith(APP_FONTS);
	});

	it("is not ready while the fonts load", async () => {
		jest.mocked(ExpoFont.useFonts).mockReturnValue([false, null]);

		const { result } = await renderHook(() => useAppFonts());

		expect(result.current).toBe(false);
	});

	it("is ready once they are loaded", async () => {
		jest.mocked(ExpoFont.useFonts).mockReturnValue([true, null]);

		const { result } = await renderHook(() => useAppFonts());

		expect(result.current).toBe(true);
	});

	it("is ready when loading failed, so the app opens with the system font instead of hanging on the splash screen", async () => {
		jest.mocked(ExpoFont.useFonts).mockReturnValue([false, new Error("Font file missing")]);

		const { result } = await renderHook(() => useAppFonts());

		expect(result.current).toBe(true);
	});
});
