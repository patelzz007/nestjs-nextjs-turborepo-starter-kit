// ============================================
// generator/render-web.ts — generated/web.css
// ============================================
// What packages/ui's globals.css imports:
//   :root          palette primitives, theme-independent tokens, the light theme
//   .dark          the dark theme (every themed role, nothing else)
//   @theme inline  the Tailwind mapping that turns tokens into utilities
// References stay `var(--…)` so the browser resolves them per element, exactly
// as the hand-written CSS this replaced did.

import type { Shadow, ThemeName, TokenSource } from "../schema";
import {
	EasingNameSchema,
	FontRoleSchema,
	RadiusNameSchema,
	RadiusStepSchema,
	SharedColorNameSchema,
	SizeNameSchema,
	StackLevelNameSchema,
	TextSizeNameSchema,
	ThemeNameSchema,
	ThemeRoleSchema,
} from "../schema";
import { BASE_RADIUS, formatWebColor, formatWebSize, generatedNotice, paletteDeclarations } from "./common";
import type { CssDeclaration, CssRule } from "./css";
import { declaration, printStylesheet, rule } from "./css";
import { formatCubicBezier, formatLength, formatNumber, formatShadowLayer, formatStackLevel, formatVariableReference } from "./format";
import { assertThemeParity } from "./parity";

/** Where each theme's values live on the web. The light theme shares `:root` with every theme-independent token. */
const WEB_THEME_SELECTORS: Readonly<Record<ThemeName, string>> = {
	light: ":root",
	dark: ".dark",
};

/** The selector of the theme that is in effect when no theme class is set. */
const DEFAULT_THEME_SELECTOR = ":root";

function themeDeclarations(source: TokenSource, theme: ThemeName): readonly CssDeclaration[] {
	const values = source.themes[theme];
	return ThemeRoleSchema.options.map((role) => declaration(role, formatWebColor(values[role])));
}

/** Tokens that are the same in every theme — written once, in `:root`. */
function themeIndependentDeclarations(source: TokenSource): readonly CssDeclaration[] {
	const { layout, typography, motion, sharedColors, radius } = source;
	return [
		...StackLevelNameSchema.options.map((name) => declaration(name, formatStackLevel(layout.stackLevels[name]))),
		...SizeNameSchema.options.map((name) => declaration(name, formatWebSize(layout.sizes[name]))),
		...FontRoleSchema.options.map((name) => declaration(name, formatVariableReference(typography.fonts[name].name))),
		...TextSizeNameSchema.options.map((name) => declaration(name, formatLength(typography.sizes[name]))),
		...EasingNameSchema.options.map((name) => declaration(name, formatCubicBezier(motion[name]))),
		...SharedColorNameSchema.options.map((name) => declaration(name, formatWebColor(sharedColors[name]))),
		...RadiusNameSchema.options.map((name) => declaration(name, formatLength(radius[name]))),
	];
}

function formatShadow(shadow: Shadow): string {
	return shadow.layers.map(formatShadowLayer).join(", ");
}

/** `var(--radius)` for the base step, `calc(var(--radius) * <factor>)` for the rest. */
function formatRadiusStep(factor: number): string {
	const base = formatVariableReference(BASE_RADIUS);
	return factor === 1 ? base : `calc(${base} * ${formatNumber(factor)})`;
}

function tailwindThemeRule(source: TokenSource): CssRule {
	const { aliases, colors, shadows, radiusScale, fonts } = source.tailwindTheme;
	return rule("@theme inline", [
		...aliases.map((alias) => declaration(alias.name, formatVariableReference(alias.token))),
		...colors.map((name) => declaration(`color-${name}`, formatVariableReference(name))),
		...shadows.map((shadow) => declaration(shadow.name, formatShadow(shadow))),
		...RadiusStepSchema.options.map((step) => declaration(`radius-${step}`, formatRadiusStep(radiusScale[step]))),
		...fonts.map((font) => declaration(font, formatVariableReference(font))),
	]);
}

export function renderWebStylesheet(source: TokenSource): string {
	const themed = ThemeNameSchema.options.map((theme) => ({ theme, declarations: themeDeclarations(source, theme) }));
	assertThemeParity("web.css", new Map(themed.map(({ theme, declarations }) => [theme, declarations.map(({ name }) => name)])));

	const themeRules = themed.map(({ theme, declarations }) => {
		const selector = WEB_THEME_SELECTORS[theme];
		return selector === DEFAULT_THEME_SELECTOR
			? rule(selector, [...paletteDeclarations(source.palette), ...themeIndependentDeclarations(source), ...declarations])
			: rule(selector, declarations);
	});

	const header = generatedNotice([
		"The web design tokens, imported by packages/ui src/styles/globals.css:",
		":root holds the palette primitives, the theme-independent tokens and the light",
		"theme; .dark holds the dark theme; @theme inline maps tokens to Tailwind utilities.",
	]);
	return printStylesheet(header, [...themeRules, tailwindThemeRule(source)]);
}
