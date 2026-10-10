// ============================================
// generator/render-mobile-assets.ts — the Expo app's launch assets (ADR 043)
// ============================================
// What the phone shows before any JavaScript runs, from the brand mark
// (brand.ts) and the `splash` colours (semantic.ts):
//
// - app-icon.png: 1024 px, the white mark on a full `splash` square — iOS and
//   Android mask the corners themselves
// - splash-icon.png: 1024 px, the white mark alone on transparency — the native
//   splash screen draws it centred on the `splash` colour
// - launch-colors.json: those two colours as #rrggbb, read by app.config.ts, so
//   the native splash and the in-app launch screen are one colour
//
// scripts/generate.ts copies them into apps/mobile/assets/.

import { BRAND_MARK_FACETS, BRAND_MARK_SIZE } from "../brand";
import type { TokenSource } from "../schema";
import { createColorLookups, resolveColorValue } from "../resolve";
import { colorToken } from "../value";
import { encodePng } from "./png";
import { rasterizeTile, type TileSpec } from "./raster";
import { formatSrgbHex } from "./srgb-hex";

/** The size stores and launchers ask for. */
export const MOBILE_ASSET_PIXELS = 1024;
/** The mark covers half the app icon: inside Android's adaptive-icon safe zone. */
const APP_ICON_MARK_SCALE = 0.5;
/** The splash image is the mark alone, edge to edge: the platform sizes it. */
const SPLASH_MARK_SCALE = 1;
const NO_RADIUS = 0;
/** The splash colours are shared (the same in every theme), so either theme resolves them. */
const COLOR_THEME = "light";

export interface LaunchColors {
	readonly backgroundColor: string;
	readonly foregroundColor: string;
}

export function launchColors(source: TokenSource): LaunchColors {
	const lookups = createColorLookups(source, COLOR_THEME);
	return {
		backgroundColor: formatSrgbHex(resolveColorValue(colorToken("splash"), lookups)),
		foregroundColor: formatSrgbHex(resolveColorValue(colorToken("splash-foreground"), lookups)),
	};
}

function markSpec(colors: LaunchColors, markScale: number, tileColor: string | null): TileSpec {
	return { size: BRAND_MARK_SIZE, radius: NO_RADIUS, markScale, markOffset: (BRAND_MARK_SIZE * (1 - markScale)) / 2, tileColor, markColor: colors.foregroundColor };
}

export function renderAppIcon(source: TokenSource): Uint8Array {
	const colors = launchColors(source);
	return encodePng(
		MOBILE_ASSET_PIXELS,
		MOBILE_ASSET_PIXELS,
		rasterizeTile(markSpec(colors, APP_ICON_MARK_SCALE, colors.backgroundColor), BRAND_MARK_FACETS, MOBILE_ASSET_PIXELS),
	);
}

export function renderSplashIcon(source: TokenSource): Uint8Array {
	return encodePng(MOBILE_ASSET_PIXELS, MOBILE_ASSET_PIXELS, rasterizeTile(markSpec(launchColors(source), SPLASH_MARK_SCALE, null), BRAND_MARK_FACETS, MOBILE_ASSET_PIXELS));
}

export function renderLaunchColorsJson(source: TokenSource): string {
	return `${JSON.stringify(launchColors(source), null, "\t")}\n`;
}
