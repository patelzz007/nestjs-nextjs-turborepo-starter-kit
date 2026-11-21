// ============================================
// lib/diagram/static-diagram.ts — a diagram as a standalone SVG file
// ============================================
// For places that cannot run Pele or read the app's CSS — the README on GitHub, an
// exported file. The SVG is drawn by Pele like the `Diagram` component, and the
// theme is baked in: every `--pele-*` variable is set to the literal colour its
// token (DIAGRAM_COLOR_TOKENS) has in that theme, and the diagram sits on a card.
// Deterministic: the same source and theme always give the same bytes.

import { createColorLookups, formatSrgbHex, resolveColorValue, TOKEN_SOURCE, type ThemeName } from "@workspace/tokens";
import { render } from "pele";

import { DIAGRAM_COLOR_TOKENS } from "@workspace/ui/lib/diagram/diagram-theme";

/** A system font stack: an SVG shown as an image cannot load the app's web fonts. */
export const STATIC_DIAGRAM_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';
const STATIC_DIAGRAM_FONT_MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
/** Space between the diagram and the card's edge, and the card's corner radius (px). */
const CARD_PADDING = 24;
const CARD_RADIUS = 12;
const NODE_RADIUS = "6px";

export interface StaticDiagramOptions {
	readonly theme: ThemeName;
	/** Prefix of the SVG's element ids — unique per diagram on one page. */
	readonly idPrefix: string;
}

/** `--pele-bg:#ffffff;--pele-fg:#1f2430;…` — the theme's literal colour for every Pele variable. */
function themeDeclarations(theme: ThemeName): string {
	const lookups = createColorLookups(TOKEN_SOURCE, theme);
	const colors = Object.entries(DIAGRAM_COLOR_TOKENS).map(([variable, token]) => `${variable}:${formatSrgbHex(resolveColorValue({ kind: "token", name: token }, lookups))}`);
	return [...colors, `--pele-radius:${NODE_RADIUS}`].join(";");
}

/**
 * Renders Mermaid-syntax `source` to a self-contained SVG in `theme`, on a rounded card.
 * Throws Pele's `PeleError` when the source does not parse.
 */
export function renderStaticDiagram(source: string, { theme, idPrefix }: StaticDiagramOptions): string {
	const { svg, width, height } = render(source, { idPrefix, fontFamily: STATIC_DIAGRAM_FONT, fontFamilyMono: STATIC_DIAGRAM_FONT_MONO, responsive: false });
	const cardWidth = width + CARD_PADDING * 2;
	const cardHeight = height + CARD_PADDING * 2;
	return [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${String(cardWidth)}" height="${String(cardHeight)}" viewBox="0 0 ${String(cardWidth)} ${String(cardHeight)}" style="${themeDeclarations(theme)}">`,
		`<rect x="0.5" y="0.5" width="${String(cardWidth - 1)}" height="${String(cardHeight - 1)}" rx="${String(CARD_RADIUS)}" fill="var(--pele-bg)" stroke="var(--pele-border)"/>`,
		// Pele's own <svg> (with its role, title and description), offset by the padding.
		`<g transform="translate(${String(CARD_PADDING)} ${String(CARD_PADDING)})">${svg}</g>`,
		"</svg>",
		"",
	].join("\n");
}
