// ============================================
// resolve.ts — follow token references down to a literal colour
// ============================================
// The web keeps references as `var(--…)` (the browser resolves them); the
// mobile output and JavaScript consumers (charts, native APIs) need the final
// colour of a token in a given theme. `invert` → `foreground` → neutral-900 in
// light resolves to `oklch(0.24 0.02 258)`.

import { formatColorLiteral, paletteVariableName } from "./generator/format";
import type { ColorLiteral, ColorTokenName, ColorValue, Palette, PrimitiveColor, SharedColors, ThemeName, Themes } from "./schema";

/** The parts of the token source colour resolution reads. */
export interface ColorSource {
	readonly palette: Palette;
	readonly themes: Themes;
	readonly sharedColors: SharedColors;
}

export class UnknownColorTokenError extends Error {
	public constructor(public readonly tokenName: string) {
		super(`No colour token named "--${tokenName}"`);
		this.name = "UnknownColorTokenError";
	}
}

export class UnknownPaletteStepError extends Error {
	public constructor(public readonly variableName: string) {
		super(`No palette step "--${variableName}"`);
		this.name = "UnknownPaletteStepError";
	}
}

export class ColorReferenceCycleError extends Error {
	public constructor(public readonly chain: readonly string[]) {
		super(`Colour tokens reference each other in a cycle: ${chain.map((name) => `--${name}`).join(" → ")}`);
		this.name = "ColorReferenceCycleError";
	}
}

/** Name → value maps the resolver walks: palette steps by variable name (`palette-neutral-50`), colour tokens by name. */
export interface ColorLookups {
	readonly palette: ReadonlyMap<string, PrimitiveColor>;
	readonly colors: ReadonlyMap<string, ColorValue>;
}

/** The lookups for one theme: every palette step, plus the theme's roles and the shared colours. */
export function createColorLookups(source: ColorSource, theme: ThemeName): ColorLookups {
	const scales: readonly [string, Readonly<Record<string, PrimitiveColor>>][] = Object.entries(source.palette);
	return {
		palette: new Map(scales.flatMap(([scale, steps]) => Object.entries(steps).map(([step, color]): [string, PrimitiveColor] => [paletteVariableName(scale, step), color]))),
		colors: new Map([...Object.entries(source.sharedColors), ...Object.entries(source.themes[theme])]),
	};
}

function resolveWithin(value: ColorValue, lookups: ColorLookups, chain: readonly string[]): ColorLiteral {
	switch (value.kind) {
		case "oklch":
		case "hex":
		case "keyword":
			return value;
		case "palette": {
			const variableName = paletteVariableName(value.scale, value.step);
			const color = lookups.palette.get(variableName);
			if (color === undefined) {
				throw new UnknownPaletteStepError(variableName);
			}
			return color;
		}
		case "token": {
			if (chain.includes(value.name)) {
				throw new ColorReferenceCycleError([...chain, value.name]);
			}
			const referenced = lookups.colors.get(value.name);
			if (referenced === undefined) {
				throw new UnknownColorTokenError(value.name);
			}
			return resolveWithin(referenced, lookups, [...chain, value.name]);
		}
	}
}

/** The literal colour a value ends at, every palette and token reference followed. */
export function resolveColorValue(value: ColorValue, lookups: ColorLookups): ColorLiteral {
	return resolveWithin(value, lookups, []);
}

/** The literal colour (`oklch(…)`, `#…`, `transparent`) a colour token has in a theme, as CSS text. */
export function resolveColorToken(source: ColorSource, theme: ThemeName, name: ColorTokenName): string {
	return formatColorLiteral(resolveColorValue({ kind: "token", name }, createColorLookups(source, theme)));
}
