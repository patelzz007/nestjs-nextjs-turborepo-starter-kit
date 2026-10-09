// ============================================
// value.ts — typed constructors for token values
// ============================================
// The data modules (palette.ts, semantic.ts, …) are written with these, so a
// token reads like the CSS it becomes (`oklch(0.5, 0.016, 258)`,
// `paletteColor("neutral", "900")`) while staying typed: a palette step that
// does not exist on its scale is a compile error.

import type {
	ColorKeyword,
	ColorReference,
	ColorTokenName,
	CubicBezier,
	FontReference,
	FontVariable,
	HexColor,
	Length,
	OklchColor,
	PaletteReference,
	PaletteScale,
	PaletteStep,
	SizeName,
	SizeReference,
	StackLevel,
} from "./schema";

/** An `oklch(L C h)` colour, with an optional alpha (`oklch(L C h / a)`). */
export function oklch(lightness: number, chroma: number, hue: number, alpha?: number): OklchColor {
	if (alpha === undefined) {
		return { kind: "oklch", lightness, chroma, hue };
	}
	return { kind: "oklch", lightness, chroma, hue, alpha };
}

/** A six-digit lowercase hex colour (`#f1f4f9`). */
export function hex(value: string): HexColor {
	return { kind: "hex", value };
}

/** The `transparent` colour keyword. */
export const TRANSPARENT: ColorKeyword = { kind: "keyword", value: "transparent" };

/** A reference to one palette step — `var(--palette-<scale>-<step>)` on the web. */
export function paletteColor<TScale extends PaletteScale>(scale: TScale, step: PaletteStep<TScale>): PaletteReference {
	return { kind: "palette", scale, step };
}

/** A colour token aliasing another colour token (`var(--tier-gold)`). */
export function colorToken(name: ColorTokenName): ColorReference {
	return { kind: "token", name };
}

/** A size aliasing another size token (`var(--max-width-10xl)`). */
export function sizeToken(name: SizeName): SizeReference {
	return { kind: "token", name };
}

/** A font family provided at runtime by an app's font loader (`var(--font-sans)`). */
export function fontVariable(name: FontVariable): FontReference {
	return { kind: "font", name };
}

/** A length in rem. */
export function rem(value: number): Length {
	return { kind: "length", value, unit: "rem" };
}

/** A length in px. */
export function px(value: number): Length {
	return { kind: "length", value, unit: "px" };
}

/** A `z-index` stacking layer. */
export function stackLevel(value: number): StackLevel {
	return { kind: "stack-level", value };
}

/** A `cubic-bezier(x1, y1, x2, y2)` easing curve. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): CubicBezier {
	return { kind: "cubic-bezier", x1, y1, x2, y2 };
}
