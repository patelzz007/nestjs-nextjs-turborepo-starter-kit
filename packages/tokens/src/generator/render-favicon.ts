// ============================================
// generator/render-favicon.ts — the generated browser icons (ADR 040)
// ============================================
// The tab icon of every web app and the docs site: the brand mark (brand.ts)
// exactly as the Expo app's sign-in tile draws it (AuthShell: an 80-pt
// `auth-brand-from` square, 22-pt corners, a 40-pt mark in the auth-panel
// foreground) — the phone's tile is the reference. Three files from one tile:
//
// - favicon.svg: what current Chrome, Edge and Firefox show (crisp at any size)
// - favicon.ico: 16 and 32 px, for Safari — which does not use SVG favicons and
//   otherwise draws a letter of the site's name — and older browsers
// - apple-touch-icon.png: 180 px, for iOS home screens and Safari bookmarks —
//   a full square: iOS rounds it with its own mask (transparent corners would
//   turn black)
//
// One set per brand tone, so the apps are told apart in a row of tabs: the
// default (`auth-brand-from`, slate — admin and docs), blue (web) and green
// (merchant), each the colour that app's own sign-in tile uses
// (`--auth-brand-from` in its theme CSS).
//
// Colours are #rrggbb (icon consumers may not read oklch()). The apps commit
// copies (scripts/generate.ts writes them) and a test in each fails while a
// copy differs from these files.

import { BRAND_MARK_FACETS, BRAND_MARK_SIZE, type BrandMarkFacet } from "../brand";
import type { ColorValue, TokenSource } from "../schema";
import { colorToken, paletteColor } from "../value";
import { createColorLookups, resolveColorValue } from "../resolve";
import { formatNumber } from "./format";
import { encodeIco } from "./ico";
import { encodePng } from "./png";
import { rasterizeTile, type TileSpec } from "./raster";
import { formatSrgbHex } from "./srgb-hex";

/** The mobile tile: 80 pt square with 22 pt corners (`size-20 rounded-3xl`) holding a 40 pt mark. */
const MOBILE_TILE_SIZE = 80;
const MOBILE_TILE_RADIUS = 22;
const MOBILE_MARK_SIZE = 40;
/** Both colours are shared (the same in every theme), so either theme resolves them. */
const COLOR_THEME = "light";
/** The sizes inside favicon.ico: the tab (16) and high-density tabs and taskbars (32). */
const ICO_SIZES: readonly number[] = [16, 32];
/** The iOS home-screen icon size. */
export const APPLE_TOUCH_ICON_SIZE = 180;

export type FaviconTone = "default" | "blue" | "green";

export interface FaviconVariant {
	readonly tone: FaviconTone;
	/** Added to each file name: `favicon-blue.svg`; empty for the default tone. */
	readonly suffix: string;
	/** The tile colour: the matching app's `--auth-brand-from`. */
	readonly tile: ColorValue;
}

/** Slate, the shared `auth-brand-from`: the admin panel and the docs site (and the phone's tile). */
export const DEFAULT_FAVICON_VARIANT: FaviconVariant = { tone: "default", suffix: "", tile: colorToken("auth-brand-from") };

export const FAVICON_VARIANTS: readonly FaviconVariant[] = [
	DEFAULT_FAVICON_VARIANT,
	{ tone: "blue", suffix: "-blue", tile: paletteColor("blue", "500") },
	{ tone: "green", suffix: "-green", tile: paletteColor("green", "500") },
];

/** A favicon always has its tile. */
export interface FaviconTileSpec extends TileSpec {
	readonly tileColor: string;
}

/** The favicon tile in the mark's 24-unit box, from the mobile tile's proportions and the variant's colours. */
export function faviconTile(source: TokenSource, variant: FaviconVariant): FaviconTileSpec {
	const lookups = createColorLookups(source, COLOR_THEME);
	const markScale = MOBILE_MARK_SIZE / MOBILE_TILE_SIZE;
	return {
		size: BRAND_MARK_SIZE,
		radius: (BRAND_MARK_SIZE * MOBILE_TILE_RADIUS) / MOBILE_TILE_SIZE,
		markScale,
		markOffset: (BRAND_MARK_SIZE * (1 - markScale)) / 2,
		tileColor: formatSrgbHex(resolveColorValue(variant.tile, lookups)),
		markColor: formatSrgbHex(resolveColorValue({ kind: "token", name: "auth-panel-foreground" }, lookups)),
	};
}

function facetElement(facet: BrandMarkFacet, color: string): string {
	return `    <path d="${facet.path}" fill="${color}" fill-opacity="${formatNumber(facet.opacity)}"/>`;
}

export function renderFaviconSvg(source: TokenSource, variant: FaviconVariant): string {
	const tile = faviconTile(source, variant);
	const size = formatNumber(tile.size);
	const offset = formatNumber(tile.markOffset);
	return [
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="Brand mark">`,
		"  <!-- GENERATED FILE: do not edit by hand. Source: packages/tokens/src/brand.ts (ADR 040); regenerate with `pnpm tokens:generate`. -->",
		`  <rect width="${size}" height="${size}" rx="${formatNumber(tile.radius)}" fill="${tile.tileColor}"/>`,
		`  <g transform="translate(${offset} ${offset}) scale(${formatNumber(tile.markScale)})">`,
		...BRAND_MARK_FACETS.map((facet: BrandMarkFacet): string => facetElement(facet, tile.markColor)),
		"  </g>",
		"</svg>",
		"",
	].join("\n");
}

function renderTilePng(spec: TileSpec, pixels: number): Uint8Array {
	return encodePng(pixels, pixels, rasterizeTile(spec, BRAND_MARK_FACETS, pixels));
}

/** No corner radius: the platform masks the icon itself. */
const SQUARE_CORNERS = 0;

export function renderFaviconIco(source: TokenSource, variant: FaviconVariant): Uint8Array {
	const tile = faviconTile(source, variant);
	return encodeIco(ICO_SIZES.map((size: number) => ({ size, png: renderTilePng(tile, size) })));
}

export function renderAppleTouchIcon(source: TokenSource, variant: FaviconVariant): Uint8Array {
	return renderTilePng({ ...faviconTile(source, variant), radius: SQUARE_CORNERS }, APPLE_TOUCH_ICON_SIZE);
}
