// ============================================
// generator/common.ts — pieces every output shares
// ============================================

import type { ColorValue, Palette, PrimitiveColor, RadiusName, SizeValue } from "../schema";
import { PaletteScaleSchema } from "../schema";
import type { CssDeclaration } from "./css";
import { declaration } from "./css";
import { formatColorLiteral, formatLength, formatVariableReference, paletteVariableName } from "./format";

/** The command that rewrites every generated file — named in each header and in every staleness failure. */
export const GENERATE_COMMAND = "pnpm tokens:generate";

/** The base radius every `rounded-*` step multiplies. */
export const BASE_RADIUS: RadiusName = "radius";

/** The opening lines of every generated file's header comment. */
export function generatedNotice(purpose: readonly string[]): readonly string[] {
	return [
		"GENERATED FILE: do not edit by hand.",
		"Source: packages/tokens/src, the one design token source (ADR 030).",
		`Regenerate with \`${GENERATE_COMMAND}\`; a test fails while this file is stale.`,
		"",
		...purpose,
	];
}

/** Every palette step as a `--palette-<scale>-<step>` declaration: scales in schema order, steps ascending. */
export function paletteDeclarations(palette: Palette): readonly CssDeclaration[] {
	return PaletteScaleSchema.options.flatMap((scale) => {
		const steps: readonly [string, PrimitiveColor][] = Object.entries(palette[scale]);
		return [...steps]
			.sort(([leftStep], [rightStep]) => Number(leftStep) - Number(rightStep))
			.map(([step, color]) => declaration(paletteVariableName(scale, step), formatColorLiteral(color)));
	});
}

/** A colour value as the web writes it: literals in full, palette steps and other tokens as `var(--…)`. */
export function formatWebColor(value: ColorValue): string {
	switch (value.kind) {
		case "oklch":
		case "hex":
		case "keyword":
			return formatColorLiteral(value);
		case "palette":
			return formatVariableReference(paletteVariableName(value.scale, value.step));
		case "token":
			return formatVariableReference(value.name);
	}
}

/** A size as the web writes it: a length, or `var(--…)` for an alias. */
export function formatWebSize(value: SizeValue): string {
	switch (value.kind) {
		case "length":
			return formatLength(value);
		case "token":
			return formatVariableReference(value.name);
	}
}
