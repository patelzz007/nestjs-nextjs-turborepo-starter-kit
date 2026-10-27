import { describe, expect, it } from "vitest";

import { resolveColorToken } from "../resolve";
import { type ThemeName, ThemeNameSchema } from "../schema";
import { TOKEN_SOURCE } from "../source";
import { DARK_THEME_NAMES, isDarkTheme, nextThemeName, THEME_NAMES } from "../theme-names";

const HEX_RADIX = 16;
const BYTE_MAX = 255;
const CHANNEL_COUNT = 3;

/** A rough 0–1 lightness of a resolved token colour (oklch's L, or a hex colour's mean channel) — enough to tell dark from light. */
function lightness(color: string): number {
	const oklch = /^oklch\((?<lightness>[\d.]+)/u.exec(color)?.groups?.lightness;
	if (oklch !== undefined) {
		return Number(oklch);
	}
	const hex = /^#(?<red>[0-9a-f]{2})(?<green>[0-9a-f]{2})(?<blue>[0-9a-f]{2})$/u.exec(color)?.groups;
	const channels = [hex?.red, hex?.green, hex?.blue].map((channel) => Number.parseInt(channel ?? "0", HEX_RADIX) / BYTE_MAX);
	return channels.reduce((sum, channel) => sum + channel, 0) / CHANNEL_COUNT;
}

/** Whether a theme's page is darker than its text. */
function hasDarkSurface(theme: ThemeName): boolean {
	return lightness(resolveColorToken(TOKEN_SOURCE, theme, "background")) < lightness(resolveColorToken(TOKEN_SOURCE, theme, "foreground"));
}

describe("THEME_NAMES", () => {
	it("lists every theme the schema defines, in its order", () => {
		expect(THEME_NAMES).toStrictEqual(ThemeNameSchema.options);
	});
});

describe("DARK_THEME_NAMES / isDarkTheme", () => {
	it("are exactly the themes whose page is darker than their text", () => {
		expect(DARK_THEME_NAMES).toStrictEqual(THEME_NAMES.filter(hasDarkSurface));
	});

	it("tells dark themes from the rest, including an unresolved theme", () => {
		expect(isDarkTheme("dark")).toBe(true);
		expect(isDarkTheme("nord")).toBe(true);
		expect(isDarkTheme("light")).toBe(false);
		expect(isDarkTheme("system")).toBe(false);
		expect(isDarkTheme(undefined)).toBe(false);
	});
});

describe("nextThemeName", () => {
	it("cycles light → dark → nord → light", () => {
		expect(nextThemeName("light")).toBe("dark");
		expect(nextThemeName("dark")).toBe("nord");
		expect(nextThemeName("nord")).toBe("light");
	});

	it("goes to dark from a theme that is not resolved yet", () => {
		expect(nextThemeName(undefined)).toBe("dark");
		expect(nextThemeName("system")).toBe("dark");
	});
});
