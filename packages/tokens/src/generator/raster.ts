// ============================================
// generator/raster.ts — the brand tile as RGBA pixels
// ============================================
// Draws the brand mark — on its rounded tile, or alone on transparency — into
// a square of pixels, for the PNG icons. Edges are anti-aliased by sampling a
// grid of points inside each pixel and averaging. Scanline-based: for each row
// of samples the covered spans (the tile, each facet) are worked out once and
// filled into a typed array, so a 1024 px image renders in tens of milliseconds. Pure arithmetic — no canvas,
// no dependency.

import type { BrandMarkFacet } from "../brand";

/** The tile in the mark's coordinate box (24 units), with #rrggbb colours. */
export interface TileSpec {
	readonly size: number;
	readonly radius: number;
	readonly markScale: number;
	readonly markOffset: number;
	/** `null`: no tile — the mark alone on transparency (the native splash image). */
	readonly tileColor: string | null;
	readonly markColor: string;
}

interface Point {
	readonly x: number;
	readonly y: number;
}

interface Rgb {
	readonly red: number;
	readonly green: number;
	readonly blue: number;
}

interface Span {
	readonly from: number;
	readonly to: number;
}

/** Samples per pixel along each axis: 4 × 4 = 16 per pixel for small icons, where every pixel shows. */
const SMALL_ICON_SAMPLES_PER_AXIS = 4;
/** 2 × 2 from this size up: at app-icon sizes finer anti-aliasing is invisible, and 16 samples would cost seconds. */
const LARGE_ICON_PIXELS = 512;
const LARGE_ICON_SAMPLES_PER_AXIS = 2;
const HALF = 0.5;
const BYTE_MAX = 255;
const HEX_RADIX = 16;
const BYTES_PER_PIXEL = 4;
const OPAQUE = 1;
const TRANSPARENT = 0;
const NO_TILE: Rgb = { red: 0, green: 0, blue: 0 };
/** A sample off the tile (or, without a tile, off the canvas): it adds nothing. */
const OUTSIDE = -1;
const HEX_COLOR_PATTERN = /^#(?<red>[0-9a-f]{2})(?<green>[0-9a-f]{2})(?<blue>[0-9a-f]{2})$/u;
const NUMBER_PATTERN = /-?\d+(?:\.\d+)?/gu;

/** Thrown for a colour that is not `#rrggbb`, or a facet path that is not a polygon of number pairs. */
export class UnsupportedIconInputError extends Error {
	public constructor(detail: string) {
		super(`Cannot rasterize the icon: ${detail}`);
		this.name = "UnsupportedIconInputError";
	}
}

function parseHex(color: string): Rgb {
	const groups = HEX_COLOR_PATTERN.exec(color)?.groups;
	if (groups?.red === undefined || groups.green === undefined || groups.blue === undefined) {
		throw new UnsupportedIconInputError(`${color} is not #rrggbb`);
	}
	return { red: Number.parseInt(groups.red, HEX_RADIX), green: Number.parseInt(groups.green, HEX_RADIX), blue: Number.parseInt(groups.blue, HEX_RADIX) };
}

/** A facet's polygon (`M x y L x y … Z`), moved into tile coordinates. */
function facetPolygon(facet: BrandMarkFacet, spec: TileSpec): readonly Point[] {
	const numbers = [...facet.path.matchAll(NUMBER_PATTERN)].map(([match]) => Number(match));
	if (numbers.length % 2 !== 0) {
		throw new UnsupportedIconInputError(`facet ${facet.name} has an odd number of coordinates`);
	}
	const points: Point[] = [];
	for (let index = 0; index < numbers.length; index += 2) {
		const [x = 0, y = 0] = numbers.slice(index, index + 2);
		points.push({ x: spec.markOffset + x * spec.markScale, y: spec.markOffset + y * spec.markScale });
	}
	return points;
}

/** Where a horizontal line crosses a convex polygon, or `null` when it misses. */
function polygonSpan(polygon: readonly Point[], y: number): Span | null {
	let from = Number.POSITIVE_INFINITY;
	let to = Number.NEGATIVE_INFINITY;
	polygon.forEach((current: Point, index: number): void => {
		const previous = polygon.at(index - 1) ?? current;
		if (current.y > y !== previous.y > y) {
			const x = previous.x + ((y - previous.y) * (current.x - previous.x)) / (current.y - previous.y);
			from = Math.min(from, x);
			to = Math.max(to, x);
		}
	});
	return from <= to ? { from, to } : null;
}

/** Where a horizontal line crosses the rounded square, or `null` when it misses. */
function roundedSquareSpan(size: number, radius: number, y: number): Span | null {
	if (y < 0 || y > size) {
		return null;
	}
	const distanceIntoCorner = y < radius ? radius - y : y > size - radius ? y - (size - radius) : 0;
	const inset = radius - Math.sqrt(Math.max(0, radius ** 2 - distanceIntoCorner ** 2));
	return { from: inset, to: size - inset };
}

/** Marks `share` on the sample columns a span covers (sample column `index` sits at `(index + ½) × step`). */
function fillSpan(shares: Float32Array, span: Span | null, step: number, share: number): void {
	if (span === null) {
		return;
	}
	const first = Math.max(0, Math.ceil(span.from / step - HALF));
	const last = Math.min(shares.length - 1, Math.floor(span.to / step - HALF));
	shares.fill(share, first, last + 1);
}

/** RGBA bytes, row by row, of the mark (on its tile, unless `tileColor` is null) drawn into `pixels` × `pixels`. */
export function rasterizeTile(spec: TileSpec, facets: readonly BrandMarkFacet[], pixels: number): Uint8Array {
	const tile = spec.tileColor === null ? null : parseHex(spec.tileColor);
	const base = tile ?? NO_TILE;
	const mark = parseHex(spec.markColor);
	const polygons = facets.map((facet: BrandMarkFacet) => ({ polygon: facetPolygon(facet, spec), opacity: facet.opacity }));
	const samplesPerAxis = pixels >= LARGE_ICON_PIXELS ? LARGE_ICON_SAMPLES_PER_AXIS : SMALL_ICON_SAMPLES_PER_AXIS;
	const samples = samplesPerAxis * samplesPerAxis;
	const sampleColumns = pixels * samplesPerAxis;
	/** Distance between neighbouring samples, in tile units. */
	const step = spec.size / sampleColumns;
	const bytes = new Uint8Array(pixels * pixels * BYTES_PER_PIXEL);
	// Per sample column of the current sample row: the mark's share there, or OUTSIDE when off the tile.
	const shares = new Float32Array(sampleColumns);
	// Premultiplied sums for one row of pixels.
	const sums = new Float64Array(pixels * BYTES_PER_PIXEL);

	for (let row = 0; row < pixels; row += 1) {
		sums.fill(0);
		for (let sampleY = 0; sampleY < samplesPerAxis; sampleY += 1) {
			const y = (row * samplesPerAxis + sampleY + HALF) * step;
			shares.fill(OUTSIDE);
			fillSpan(shares, tile === null ? { from: 0, to: spec.size } : roundedSquareSpan(spec.size, spec.radius, y), step, TRANSPARENT);
			// The facets do not overlap; each paints its own span over the tile.
			for (const { polygon, opacity } of polygons) {
				fillSpan(shares, polygonSpan(polygon, y), step, opacity);
			}
			for (let column = 0; column < sampleColumns; column += 1) {
				const markShare = shares[column] ?? OUTSIDE;
				if (markShare === OUTSIDE) {
					continue;
				}
				const tileShare = tile === null ? TRANSPARENT : OPAQUE - markShare;
				const offset = Math.floor(column / samplesPerAxis) * BYTES_PER_PIXEL;
				sums[offset] = (sums[offset] ?? 0) + mark.red * markShare + base.red * tileShare;
				sums[offset + 1] = (sums[offset + 1] ?? 0) + mark.green * markShare + base.green * tileShare;
				sums[offset + 2] = (sums[offset + 2] ?? 0) + mark.blue * markShare + base.blue * tileShare;
				sums[offset + 3] = (sums[offset + 3] ?? 0) + markShare + tileShare;
			}
		}
		for (let column = 0; column < pixels; column += 1) {
			const offset = column * BYTES_PER_PIXEL;
			const alpha = sums[offset + 3] ?? 0;
			const unpremultiply = alpha === 0 ? 0 : 1 / alpha;
			const target = (row * pixels + column) * BYTES_PER_PIXEL;
			bytes[target] = Math.round((sums[offset] ?? 0) * unpremultiply);
			bytes[target + 1] = Math.round((sums[offset + 1] ?? 0) * unpremultiply);
			bytes[target + 2] = Math.round((sums[offset + 2] ?? 0) * unpremultiply);
			bytes[target + 3] = Math.round((alpha / samples) * BYTE_MAX);
		}
	}
	return bytes;
}
