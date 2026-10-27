import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { contrastRatio, MIN_NON_TEXT_CONTRAST, MIN_TEXT_CONTRAST, readCustomProperties, relativeLuminance } from "@workspace/ui/lib/core/color-contrast";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const require = createRequire(import.meta.url);
const PALETTE_CSS = readFileSync(require.resolve("@workspace/tokens/palette.css"), "utf8");
const THEME_CSS = readFileSync(new URL("../global.css", import.meta.url), "utf8");

const PALETTE = readCustomProperties(PALETTE_CSS, ":root");
/** The theme blocks' selectors: each theme also applies inside code blocks the reader set to it (src/scripts/code-theme.ts). */
const LIGHT_SELECTOR = ':root,\n:root[data-code-theme="light"] .code-block-island';
const DARK_SELECTOR = '[data-theme="dark"],\n:root[data-code-theme="dark"] .code-block-island';
const LIGHT = readCustomProperties(THEME_CSS, LIGHT_SELECTOR, PALETTE);
const DARK = readCustomProperties(THEME_CSS, DARK_SELECTOR, LIGHT);
const NORD = readCustomProperties(THEME_CSS, '[data-theme="nord"]', LIGHT);

/** Every text colour the docs set, on every surface it is set on. */
const TEXT_PAIRINGS: readonly (readonly [string, string])[] = [
	["--text", "--bg"],
	["--text", "--surface-muted"],
	["--text-secondary", "--bg"],
	["--muted", "--bg"],
	["--muted", "--surface-muted"],
	["--brand-text", "--bg"],
	["--brand-text", "--brand-soft"],
	["--nav-active-text", "--nav-active-bg"],
	["--brand-text-hover", "--bg"],
	["--on-brand-solid", "--brand-solid"],
	["--on-brand-solid", "--brand-solid-hover"],
];

function violations(theme: ReadonlyMap<string, string>): readonly string[] {
	return TEXT_PAIRINGS.flatMap(([foreground, background]): string[] => {
		const ratio = contrastRatio(theme.get(foreground) ?? "", theme.get(background) ?? "");
		return ratio >= MIN_TEXT_CONTRAST ? [] : [`${foreground} on ${background}: ${ratio.toFixed(2)}:1`];
	});
}

/** Dark code blocks' chrome (One Dark Pro): its title, language label and line numbers on its charcoal. */
const DARK_CODE = readCustomProperties(
	THEME_CSS,
	'[data-theme="dark"]:not([data-code-theme]) .code-block-island,\n[data-theme="nord"]:not([data-code-theme]) .code-block-island,\n:root[data-code-theme="dark"] .code-block-island',
	DARK,
);
const DARK_CODE_PAIRINGS: readonly (readonly [string, string])[] = [
	["--text", "--surface"],
	["--muted", "--surface"],
	["--text", "--surface-muted"],
	["--muted", "--surface-muted"],
];

describe("docs theme contrast (WCAG AA 4.5:1 text)", () => {
	it("meets the minimum for every text pair in the light theme", () => {
		expect(violations(LIGHT)).toEqual([]);
	});

	it("meets the minimum for every text pair in the dark theme", () => {
		expect(violations(DARK)).toEqual([]);
	});

	it("meets the minimum for every text pair in the Nord theme", () => {
		expect(violations(NORD)).toEqual([]);
	});

	it.each([
		["light", LIGHT],
		["dark", DARK],
		["Nord", NORD],
	])("keeps every callout title readable on its tint, and the badge glyph on the title's shade, in the %s theme", (_name, theme) => {
		const failing = ["info", "success", "warning", "error"].flatMap((kind): string[] =>
			[
				[`--${kind}-text`, `--${kind}-bg`],
				["--on-callout-accent", `--${kind}-text`],
			].flatMap(([foreground = "", background = ""]): string[] => {
				const ratio = contrastRatio(theme.get(foreground) ?? "", theme.get(background) ?? "");
				return ratio >= MIN_TEXT_CONTRAST ? [] : [`${foreground} on ${background}: ${ratio.toFixed(2)}:1`];
			}),
		);
		expect(failing).toEqual([]);
	});

	it("keeps Nord's card-tile icons at 3:1 on its pastel tiles (an icon, not text: WCAG 1.4.11)", () => {
		const failing = ["1", "2", "3", "4", "5", "6"].flatMap((tile): string[] => {
			const ratio = contrastRatio(NORD.get("--on-tile") ?? "", NORD.get(`--tile-${tile}`) ?? "");
			return ratio >= MIN_NON_TEXT_CONTRAST ? [] : [`--on-tile on --tile-${tile}: ${ratio.toFixed(2)}:1`];
		});
		expect(failing).toEqual([]);
	});

	it("meets the minimum for the dark code blocks' chrome (One Dark Pro, under the dark and Nord themes)", () => {
		const failing = DARK_CODE_PAIRINGS.flatMap(([foreground, background]): string[] => {
			const ratio = contrastRatio(DARK_CODE.get(foreground) ?? "", DARK_CODE.get(background) ?? "");
			return ratio >= MIN_TEXT_CONTRAST ? [] : [`${foreground} on ${background}: ${ratio.toFixed(2)}:1`];
		});
		expect(failing).toEqual([]);
	});
});

// ── Diagram labels on their role tints ─────────────────────────────────────
// A node's fill is `color-mix(in oklab, <role hue> <fill mix>, var(--surface))`
// (global.css → "Diagrams") and its label is `--text`. The mix is reproduced
// here — sRGB → linear → Oklab, mixed, and back — so every role tint is held to
// the same 4.5:1 as the rest of the docs in both themes.

const DIAGRAM_HUES: readonly string[] = [
	"--diagram-entry",
	"--diagram-step",
	"--diagram-store",
	"--diagram-decision",
	"--diagram-outcome",
	"--diagram-person",
	"--diagram-success",
];

type Oklab = readonly [number, number, number];

const HEX_PATTERN = /^#(?<red>[\da-f]{2})(?<green>[\da-f]{2})(?<blue>[\da-f]{2})$/iu;
const OKLCH_PATTERN = /^oklch\(\s*(?<lightness>[\d.]+)\s+(?<chroma>[\d.]+)\s+(?<hue>[\d.]+)\s*\)$/u;
const PERCENT_PATTERN = /^(?<amount>[\d.]+)%$/u;
const ChannelSchema = z.coerce.number();
const BYTE = 255;
const DEGREES_TO_RADIANS = Math.PI / 180;

function toLinear(channel: number): number {
	return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function fromLinear(channel: number): number {
	const clamped = Math.min(1, Math.max(0, channel));
	return clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055;
}

/** Oklab of a `#rrggbb` or `oklch(L C h)` token value. */
function oklab(color: string): Oklab {
	const oklch = OKLCH_PATTERN.exec(color.trim());
	if (oklch?.groups !== undefined) {
		const chroma = ChannelSchema.parse(oklch.groups.chroma);
		const hue = ChannelSchema.parse(oklch.groups.hue) * DEGREES_TO_RADIANS;
		return [ChannelSchema.parse(oklch.groups.lightness), chroma * Math.cos(hue), chroma * Math.sin(hue)];
	}
	const hex = HEX_PATTERN.exec(color.trim());
	if (hex?.groups === undefined) {
		throw new Error(`unsupported colour ${color}`);
	}
	const [red, green, blue] = [hex.groups.red, hex.groups.green, hex.groups.blue].map((part) => toLinear(Number.parseInt(part ?? "0", 16) / BYTE));
	const l = Math.cbrt(0.4122214708 * (red ?? 0) + 0.5363325363 * (green ?? 0) + 0.0514459929 * (blue ?? 0));
	const m = Math.cbrt(0.2119034982 * (red ?? 0) + 0.6806995451 * (green ?? 0) + 0.1073969566 * (blue ?? 0));
	const s = Math.cbrt(0.0883024619 * (red ?? 0) + 0.2817188376 * (green ?? 0) + 0.6299787005 * (blue ?? 0));
	return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

/** `#rrggbb` of an Oklab colour (clamped to sRGB). */
function hexOf([lightness, a, b]: Oklab): string {
	const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
	const channels = [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
	];
	return `#${channels
		.map((channel) =>
			Math.round(fromLinear(channel) * BYTE)
				.toString(16)
				.padStart(2, "0"),
		)
		.join("")}`;
}

/** CSS `color-mix(in oklab, first <amount>, second)`. */
function mixInOklab(first: string, amount: string, second: string): string {
	const share = ChannelSchema.parse(PERCENT_PATTERN.exec(amount.trim())?.groups?.amount) / 100;
	const [firstLightness, firstA, firstB] = oklab(first);
	const [secondLightness, secondA, secondB] = oklab(second);
	return hexOf([firstLightness * share + secondLightness * (1 - share), firstA * share + secondA * (1 - share), firstB * share + secondB * (1 - share)]);
}

function diagramLabelViolations(theme: ReadonlyMap<string, string>): readonly string[] {
	const text = theme.get("--text") ?? "";
	return DIAGRAM_HUES.flatMap((hue): string[] => {
		const fill = mixInOklab(theme.get(hue) ?? "", theme.get("--diagram-fill-mix") ?? "", theme.get("--surface") ?? "");
		const ratio = contrastRatio(text, fill);
		return ratio >= MIN_TEXT_CONTRAST ? [] : [`--text on ${hue} tint (${fill}): ${ratio.toFixed(2)}:1`];
	});
}

describe("diagram label contrast (WCAG AA 4.5:1 text)", () => {
	it("reproduces CSS oklab mixing (guards the check itself)", () => {
		// The endpoints of a mix are its inputs; white stays white through the round trip.
		expect(mixInOklab("#2e90fa", "100%", "#ffffff")).toBe("#2e90fa");
		expect(mixInOklab("#2e90fa", "0%", "oklch(1 0 0)")).toBe("#ffffff");
		expect(relativeLuminance(mixInOklab("#000000", "50%", "#ffffff"))).toBeGreaterThan(0.1);
	});

	it("keeps every role tint readable in the light theme", () => {
		expect(diagramLabelViolations(LIGHT)).toEqual([]);
	});

	it("keeps every role tint readable in the dark theme", () => {
		expect(diagramLabelViolations(DARK)).toEqual([]);
	});

	it("keeps every role tint readable in the Nord theme", () => {
		expect(diagramLabelViolations(NORD)).toEqual([]);
	});
});
