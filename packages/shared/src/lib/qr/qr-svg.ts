import { z } from "zod";

import { encodeQr, type QrEncodeOptions, type QrMatrix } from "./qr-encode";

/**
 * The light margin around a symbol, in modules. ISO/IEC 18004 §6.3.8 requires 4 for
 * Model 2; scanners struggle to find the finders without it.
 */
export const DEFAULT_QR_QUIET_ZONE_MODULES = 4;

/** A quiet zone width in whole modules. */
export const QrQuietZoneSchema = z.int().min(0);

/** Options for turning a matrix into an SVG path. */
export interface QrSvgPathOptions {
	/** Light modules around the symbol; defaults to {@link DEFAULT_QR_QUIET_ZONE_MODULES}. Use 0 inside a frame that already pads the code. */
	readonly quietZoneModules?: number | undefined;
}

/** A symbol as one SVG path, in module units. */
export interface QrSvgPath {
	/** Path data drawing every dark module: one `M x y h n v1 h -n z` rectangle per horizontal run. */
	readonly path: string;
	/** Width and height of the `viewBox` (`0 0 viewBoxSize viewBoxSize`): the symbol plus the quiet zone on both sides. */
	readonly viewBoxSize: number;
}

/** The `d` fragment of one horizontal run of `length` dark modules starting at `(x, y)`. */
function runPath(x: number, y: number, length: number): string {
	return `M${String(x)} ${String(y)}h${String(length)}v1h-${String(length)}z`;
}

/**
 * `matrix` as a single compact SVG path: each horizontal run of dark modules is one
 * rectangle, offset by the quiet zone. Draw it with `fill` and `shape-rendering="crispEdges"`
 * in a square `viewBox` of `viewBoxSize`.
 */
export function qrMatrixToSvgPath(matrix: QrMatrix, options: QrSvgPathOptions = {}): QrSvgPath {
	const quietZone = QrQuietZoneSchema.parse(options.quietZoneModules ?? DEFAULT_QR_QUIET_ZONE_MODULES);
	const runs: string[] = [];
	for (let row = 0; row < matrix.size; row += 1) {
		let runStart: number | undefined;
		// One step past the last column closes a run that touches the right edge (outside the symbol is light).
		for (let column = 0; column <= matrix.size; column += 1) {
			const isDark = matrix.isDark(row, column);
			if (isDark && runStart === undefined) runStart = column;
			if (!isDark && runStart !== undefined) {
				runs.push(runPath(runStart + quietZone, row + quietZone, column - runStart));
				runStart = undefined;
			}
		}
	}
	return { path: runs.join(""), viewBoxSize: matrix.size + 2 * quietZone };
}

/** A CSS hex colour (`#000`, `#000000`) — the only colour syntax accepted into the SVG markup. */
export const QrSvgColorSchema = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/u, "Expected a hex colour such as #000000");

/**
 * The standalone SVG's colours when none are given: black modules on white. A scanner needs
 * dark-on-light contrast whatever the viewer's theme, and these match the UI kits'
 * `qr-foreground` / `qr-background` tokens (packages/tokens).
 */
export const DEFAULT_QR_SVG_DARK_COLOR = "#000000";
export const DEFAULT_QR_SVG_LIGHT_COLOR = "#ffffff";

/** Options for {@link renderQrSvg}: the encode options plus the quiet zone and colours. */
export interface RenderQrSvgOptions extends QrSvgPathOptions {
	readonly encode?: QrEncodeOptions | undefined;
	/** Colour of the dark modules (hex); defaults to {@link DEFAULT_QR_SVG_DARK_COLOR}. */
	readonly darkColor?: string | undefined;
	/** Colour of the background and quiet zone (hex); defaults to {@link DEFAULT_QR_SVG_LIGHT_COLOR}. */
	readonly lightColor?: string | undefined;
}

/**
 * `text` as a complete, standalone `<svg>` document (dark modules on a filled light
 * background, quiet zone included) — for places with no UI kit, such as a server building a
 * `data:image/svg+xml` URL. It scales to any size without blurring.
 */
export function renderQrSvg(text: string, options: RenderQrSvgOptions = {}): string {
	const darkColor = QrSvgColorSchema.parse(options.darkColor ?? DEFAULT_QR_SVG_DARK_COLOR);
	const lightColor = QrSvgColorSchema.parse(options.lightColor ?? DEFAULT_QR_SVG_LIGHT_COLOR);
	const { path, viewBoxSize } = qrMatrixToSvgPath(encodeQr(text, options.encode), { quietZoneModules: options.quietZoneModules });
	const size = String(viewBoxSize);
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="${lightColor}"/><path fill="${darkColor}" d="${path}"/></svg>`;
}
