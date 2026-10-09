// ============================================
// generator/format.ts — token values → CSS text
// ============================================
// One function per value kind, each producing exactly one canonical spelling,
// so the same token data always yields byte-identical CSS (the staleness test
// depends on it).

import type { ColorLiteral, CubicBezier, Length, ShadowLayer, StackLevel } from "../schema";

/**
 * Digits kept after the decimal point. Rounds away binary float noise from
 * arithmetic (0.625 × 2.2 = 1.3750000000000002 → 1.375) while keeping every
 * hand-written token value exactly (the most precise is three decimals).
 */
const FRACTION_DIGITS = 6;

/** A number in its shortest exact spelling: `0.5`, `258`, `-0.15`; never `-0` or float noise. */
export function formatNumber(value: number): string {
	const rounded = Number(value.toFixed(FRACTION_DIGITS));
	return String(rounded === 0 ? 0 : rounded);
}

/** `oklch(L C h)`, `oklch(L C h / a)`, `#rrggbb` or a colour keyword. */
export function formatColorLiteral(color: ColorLiteral): string {
	switch (color.kind) {
		case "oklch": {
			const channels = [color.lightness, color.chroma, color.hue].map(formatNumber).join(" ");
			return color.alpha === undefined ? `oklch(${channels})` : `oklch(${channels} / ${formatNumber(color.alpha)})`;
		}
		case "hex":
			return color.value;
		case "keyword":
			return color.value;
	}
}

/** `20rem`, `1.5px`, `-0.15rem`. */
export function formatLength(length: Length): string {
	return `${formatNumber(length.value)}${length.unit}`;
}

/** A pixel offset as `box-shadow` writes it: `0` bare, anything else with `px`. */
export function formatPixels(value: number): string {
	return value === 0 ? "0" : `${formatNumber(value)}px`;
}

/** `cubic-bezier(0.22, 1, 0.36, 1)`. */
export function formatCubicBezier(curve: CubicBezier): string {
	return `cubic-bezier(${[curve.x1, curve.y1, curve.x2, curve.y2].map(formatNumber).join(", ")})`;
}

/** A `z-index` layer. */
export function formatStackLevel(level: StackLevel): string {
	return formatNumber(level.value);
}

/** `var(--<name>)`. */
export function formatVariableReference(name: string): string {
	return `var(--${name})`;
}

/** The CSS custom-property name of one palette step (no leading `--`). */
export function paletteVariableName(scale: string, step: string): string {
	return `palette-${scale}-${step}`;
}

/** One `box-shadow` layer: `[inset] x y blur spread var(--color)`. */
export function formatShadowLayer(layer: ShadowLayer): string {
	const geometry = [layer.offsetX, layer.offsetY, layer.blur, layer.spread].map(formatPixels).join(" ");
	const shadow = `${geometry} ${formatVariableReference(layer.color.name)}`;
	return layer.isInset ? `inset ${shadow}` : shadow;
}
