// ============================================
// @workspace/tokens — the design token source (ADR 030)
// ============================================
// Most consumers want the generated CSS (`@workspace/tokens/web.css`,
// `/mobile.css`, `/palette.css`). This entry is for code that needs a token's
// value in JavaScript (a chart, a native API such as the status bar colour):
// the typed token data and `resolveColorToken` for a theme's final colour.
// Importing it pulls in no runtime dependency.

export type { BrandMarkFacet, BrandMarkFacetName } from "./brand";
export { BRAND_MARK_FACETS, BRAND_MARK_SIZE, BRAND_MARK_VIEW_BOX } from "./brand";
export { LAYOUT } from "./layout";
export { MOTION } from "./motion";
export { PALETTE } from "./palette";
export { RADIUS, RADIUS_SCALE } from "./radius";
export type { ColorLookups, ColorSource } from "./resolve";
export { ColorReferenceCycleError, createColorLookups, resolveColorToken, resolveColorValue, UnknownColorTokenError, UnknownPaletteStepError } from "./resolve";
export type {
	ColorLiteral,
	ColorTokenName,
	ColorValue,
	Layout,
	Motion,
	Palette,
	PaletteScale,
	PaletteStep,
	Radius,
	RadiusScale,
	SharedColorName,
	SharedColors,
	TailwindTheme,
	Theme,
	ThemeName,
	ThemeRole,
	Themes,
	TokenSource,
	Typography,
} from "./schema";
export { DARK_THEME, LIGHT_THEME, SHARED_COLORS, THEMES } from "./semantic";
export { TOKEN_SOURCE } from "./source";
export { TAILWIND_THEME } from "./tailwind-theme";
export { TYPOGRAPHY } from "./typography";
