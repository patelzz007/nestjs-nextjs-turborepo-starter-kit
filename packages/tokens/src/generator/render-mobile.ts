// ============================================
// generator/render-mobile.ts — generated/mobile.css
// ============================================
// Uniwind's theming format (ADR 032), imported by apps/mobile's global.css:
//
//   @layer theme { :root { @variant light { … } @variant dark { … } } }
//   @theme inline { --color-card: var(--card); … --radius-lg: 0.625rem; … }
//
// Same variable names and the same values as the web. Each variant carries a
// LITERAL value for every variable (references resolved for that theme), so the
// native runtime never has to follow a `var()` chain; the `@theme inline`
// mapping gives the same utility names as the web (`bg-card`, `rounded-lg`).
// Web-chrome tokens (z-index layers, sidebar widths, switch geometry, easing,
// the web font variables, shadows) are not part of it.

import type { ColorTokenName, ThemeName, TokenSource } from "../schema";
import { RadiusNameSchema, RadiusStepSchema, SharedColorNameSchema, TextSizeNameSchema, ThemeNameSchema, ThemeRoleSchema } from "../schema";
import { createColorLookups, resolveColorValue } from "../resolve";
import { colorToken } from "../value";
import { BASE_RADIUS, generatedNotice } from "./common";
import type { CssDeclaration } from "./css";
import { declaration, printStylesheet, rule } from "./css";
import { formatColorLiteral, formatLength, formatVariableReference } from "./format";
import { assertThemeParity } from "./parity";

/** Every variable one Uniwind theme variant declares, each with a literal value. */
function variantDeclarations(source: TokenSource, theme: ThemeName): readonly CssDeclaration[] {
	const lookups = createColorLookups(source, theme);
	const literal = (name: ColorTokenName): string => formatColorLiteral(resolveColorValue(colorToken(name), lookups));
	return [
		...ThemeRoleSchema.options.map((role) => declaration(role, literal(role))),
		...SharedColorNameSchema.options.map((name) => declaration(name, literal(name))),
		...RadiusNameSchema.options.map((name) => declaration(name, formatLength(source.radius[name]))),
		...TextSizeNameSchema.options.map((name) => declaration(name, formatLength(source.typography.sizes[name]))),
	];
}

export function renderMobileStylesheet(source: TokenSource): string {
	const variants = ThemeNameSchema.options.map((theme) => ({ theme, declarations: variantDeclarations(source, theme) }));
	assertThemeParity("mobile.css", new Map(variants.map(({ theme, declarations }) => [theme, declarations.map(({ name }) => name)])));

	const baseRadius = source.radius[BASE_RADIUS];
	const { colors, radiusScale } = source.tailwindTheme;
	const themeMapping = rule("@theme inline", [
		...colors.map((name) => declaration(`color-${name}`, formatVariableReference(name))),
		...RadiusStepSchema.options.map((step) => declaration(`radius-${step}`, formatLength({ ...baseRadius, value: baseRadius.value * radiusScale[step] }))),
	]);

	const header = generatedNotice([
		"The mobile design tokens in Uniwind's theme format (ADR 032), imported by",
		"apps/mobile's global.css: one @variant per theme, every value literal, plus the",
		"@theme inline mapping that gives the web's utility names (bg-card, rounded-lg).",
	]);
	return printStylesheet(header, [
		rule("@layer theme", [
			rule(
				":root",
				variants.map(({ theme, declarations }) => rule(`@variant ${theme}`, declarations)),
			),
		]),
		themeMapping,
	]);
}
