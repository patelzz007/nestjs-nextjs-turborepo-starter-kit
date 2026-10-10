// ============================================
// brand.ts — the brand mark (ADR 040)
// ============================================
// One geometric mark for every app: an isometric cube cut into three facets
// with a hairline gap between them, drawn in ONE colour at three strengths —
// the lit top face full, the left face mid, the right face in shadow. Each
// platform draws it from this data (packages/ui `BrandMark`, the Expo app's
// `BrandMark`), and the favicons are generated from it (generator/render-favicon.ts),
// so the mark can never drift between the web, the docs and the phone.
//
// Coordinates are in a 24 × 24 box: a regular hexagon of radius 10.5 around
// the centre, each face pulled 12% towards its own middle to open the gaps.

export type BrandMarkFacetName = "top" | "left" | "right";

export interface BrandMarkFacet {
	readonly name: BrandMarkFacetName;
	/** SVG path data in the mark's 24 × 24 box. */
	readonly path: string;
	/** How strongly the facet takes the mark's colour (1 = full). */
	readonly opacity: number;
}

/** Side of the square the mark is drawn in. */
export const BRAND_MARK_SIZE = 24;

export const BRAND_MARK_VIEW_BOX = `0 0 ${String(BRAND_MARK_SIZE)} ${String(BRAND_MARK_SIZE)}`;

/** Back to front: the faces never overlap, so the order only fixes the output. */
export const BRAND_MARK_FACETS: readonly BrandMarkFacet[] = [
	{ name: "top", path: "M12 2.13 L20 6.75 L12 11.37 L4 6.75 Z", opacity: 1 },
	{ name: "left", path: "M3.45 7.69 L11.45 12.31 L11.45 21.55 L3.45 16.93 Z", opacity: 0.62 },
	{ name: "right", path: "M12.55 12.31 L20.55 7.7 L20.55 16.93 L12.55 21.55 Z", opacity: 0.32 },
];
