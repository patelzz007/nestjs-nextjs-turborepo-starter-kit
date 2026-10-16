import { QR_CODEWORD_BITS } from "./qr-bit-buffer";
import { type QrErrorCorrectionLevel } from "./qr-error-correction";
import { QR_FORMAT_INFO_BITS, QR_VERSION_INFO_BITS, qrFormatBits, qrVersionBits } from "./qr-format-info";
import { QrModuleGrid } from "./qr-module-grid";
import { readTableEntry } from "./qr-table";
import { alignmentPatternPositions, MIN_QR_VERSION_WITH_VERSION_INFO, qrSizeForVersion } from "./qr-version-table";

/**
 * Drawing the function patterns of a symbol (ISO/IEC 18004 §6.3) and placing its codewords
 * (§7.7.3). Coordinates are `(row, column)` from the top-left module.
 */

/** The timing patterns run along row 6 and column 6. */
export const QR_TIMING_LINE = 6;

/** A finder is 7×7 around its centre, ringed by a 1-module light separator: radius 4 in all. */
const FINDER_RADIUS_WITH_SEPARATOR = 4;
/** Rings of a finder (counted outward from its centre) that are light: the gap and the separator. */
const FINDER_LIGHT_RINGS: readonly number[] = [2, 4];
/** A finder's centre sits 3 modules in from the symbol's corner. */
const FINDER_CENTRE_INSET = 3;
/** A finder plus its separator is 8 modules on a side — the extent of the format area along each edge. */
const FINDER_AREA_MODULES = 8;

/** An alignment pattern is 5×5 around its centre; ring 1 is light. */
const ALIGNMENT_RADIUS = 2;
const ALIGNMENT_LIGHT_RING = 1;

/** The version information blocks are 6×3, starting 11 modules in from the far edge. */
const VERSION_INFO_BLOCK_DEPTH = 3;
const VERSION_INFO_EDGE_OFFSET = 11;

/** Bit `index` (0 = least significant) of `value`. */
function bitIsSet(value: number, index: number): boolean {
	return ((value >>> index) & 1) === 1;
}

/** Even modules of a timing line are dark. */
function isTimingModuleDark(position: number): boolean {
	return position % 2 === 0;
}

/** Draws the alternating timing patterns along row 6 and column 6. */
export function drawTimingPatterns(grid: QrModuleGrid): void {
	for (let position = 0; position < grid.size; position += 1) {
		grid.setFunctionModule(QR_TIMING_LINE, position, isTimingModuleDark(position));
		grid.setFunctionModule(position, QR_TIMING_LINE, isTimingModuleDark(position));
	}
}

/** Draws one finder pattern and its separator around `(centreRow, centreColumn)`, clipped to the symbol. */
export function drawFinderPattern(grid: QrModuleGrid, centreRow: number, centreColumn: number): void {
	for (let rowOffset = -FINDER_RADIUS_WITH_SEPARATOR; rowOffset <= FINDER_RADIUS_WITH_SEPARATOR; rowOffset += 1) {
		for (let columnOffset = -FINDER_RADIUS_WITH_SEPARATOR; columnOffset <= FINDER_RADIUS_WITH_SEPARATOR; columnOffset += 1) {
			const row = centreRow + rowOffset;
			const column = centreColumn + columnOffset;
			if (!grid.contains(row, column)) continue;
			const ring = Math.max(Math.abs(rowOffset), Math.abs(columnOffset));
			grid.setFunctionModule(row, column, !FINDER_LIGHT_RINGS.includes(ring));
		}
	}
}

/** Draws one 5×5 alignment pattern centred on `(centreRow, centreColumn)`. */
export function drawAlignmentPattern(grid: QrModuleGrid, centreRow: number, centreColumn: number): void {
	for (let rowOffset = -ALIGNMENT_RADIUS; rowOffset <= ALIGNMENT_RADIUS; rowOffset += 1) {
		for (let columnOffset = -ALIGNMENT_RADIUS; columnOffset <= ALIGNMENT_RADIUS; columnOffset += 1) {
			const ring = Math.max(Math.abs(rowOffset), Math.abs(columnOffset));
			grid.setFunctionModule(centreRow + rowOffset, centreColumn + columnOffset, ring !== ALIGNMENT_LIGHT_RING);
		}
	}
}

/** Draws every alignment pattern of `version`, skipping the three positions under the finders. */
export function drawAlignmentPatterns(grid: QrModuleGrid, version: number): void {
	const positions = alignmentPatternPositions(version);
	const lastIndex = positions.length - 1;
	positions.forEach((row: number, rowIndex: number): void => {
		positions.forEach((column: number, columnIndex: number): void => {
			const isUnderFinder = (rowIndex === 0 && columnIndex === 0) || (rowIndex === 0 && columnIndex === lastIndex) || (rowIndex === lastIndex && columnIndex === 0);
			if (!isUnderFinder) drawAlignmentPattern(grid, row, column);
		});
	});
}

/**
 * Writes the 15 format bits in both copies (ISO/IEC 18004 Figure 25) and the always-dark
 * module beside the lower-left finder. Bit 0 is the least significant bit of `formatBits`.
 */
export function drawFormatInfo(grid: QrModuleGrid, formatBits: number): void {
	const { size } = grid;
	// Copy 1 — around the top-left finder: down column 8 (skipping the timing row), then left along row 8.
	for (let bit = 0; bit < QR_FORMAT_INFO_BITS; bit += 1) {
		const isDark = bitIsSet(formatBits, bit);
		if (bit < QR_TIMING_LINE) grid.setFunctionModule(bit, FINDER_AREA_MODULES, isDark);
		else if (bit < FINDER_AREA_MODULES) grid.setFunctionModule(bit + 1, FINDER_AREA_MODULES, isDark);
		else if (bit === FINDER_AREA_MODULES) grid.setFunctionModule(FINDER_AREA_MODULES, FINDER_AREA_MODULES - 1, isDark);
		else grid.setFunctionModule(FINDER_AREA_MODULES, QR_FORMAT_INFO_BITS - 1 - bit, isDark);
	}
	// Copy 2 — bits 0–7 leftward under the top-right finder, bits 8–14 down beside the bottom-left finder.
	for (let bit = 0; bit < QR_FORMAT_INFO_BITS; bit += 1) {
		const isDark = bitIsSet(formatBits, bit);
		if (bit < FINDER_AREA_MODULES) grid.setFunctionModule(FINDER_AREA_MODULES, size - 1 - bit, isDark);
		else grid.setFunctionModule(size - QR_FORMAT_INFO_BITS + bit, FINDER_AREA_MODULES, isDark);
	}
	// The dark module (§7.9.1): always dark, just above the lower copy.
	grid.setFunctionModule(size - FINDER_AREA_MODULES, FINDER_AREA_MODULES, true);
}

/** Writes the two 6×3 version information blocks (versions 7 and up; ISO/IEC 18004 §7.10). */
export function drawVersionInfo(grid: QrModuleGrid, version: number): void {
	if (version < MIN_QR_VERSION_WITH_VERSION_INFO) return;
	const bits = qrVersionBits(version);
	for (let bit = 0; bit < QR_VERSION_INFO_BITS; bit += 1) {
		const isDark = bitIsSet(bits, bit);
		const far = grid.size - VERSION_INFO_EDGE_OFFSET + (bit % VERSION_INFO_BLOCK_DEPTH);
		const near = Math.floor(bit / VERSION_INFO_BLOCK_DEPTH);
		// Lower-left block (3 rows × 6 columns) and its transpose, the upper-right block.
		grid.setFunctionModule(far, near, isDark);
		grid.setFunctionModule(near, far, isDark);
	}
}

/** The mask written while the codewords are placed — it only reserves the format area; the real mask is drawn last. */
const PLACEHOLDER_MASK = 0;

/** A grid for `version` with every function pattern drawn (format information as a placeholder) and no data yet. */
export function buildFunctionPatterns(version: number, level: QrErrorCorrectionLevel): QrModuleGrid {
	const grid = new QrModuleGrid(qrSizeForVersion(version));
	drawTimingPatterns(grid);
	const far = grid.size - 1 - FINDER_CENTRE_INSET;
	drawFinderPattern(grid, FINDER_CENTRE_INSET, FINDER_CENTRE_INSET);
	drawFinderPattern(grid, FINDER_CENTRE_INSET, far);
	drawFinderPattern(grid, far, FINDER_CENTRE_INSET);
	drawAlignmentPatterns(grid, version);
	drawFormatInfo(grid, qrFormatBits(level, PLACEHOLDER_MASK));
	drawVersionInfo(grid, version);
	return grid;
}

/** Codeword columns are walked in pairs from the right edge. */
const COLUMN_PAIR_WIDTH = 2;

/**
 * Places `codewords` (already interleaved, error correction included) into the data modules,
 * most significant bit first, in the standard's zig-zag: two-module-wide columns from the
 * right edge, alternately upward and downward, stepping over the vertical timing line.
 * Data modules left after the last bit (the remainder bits) stay light.
 */
export function placeCodewords(grid: QrModuleGrid, codewords: readonly number[]): void {
	const totalBits = codewords.length * QR_CODEWORD_BITS;
	const { size } = grid;
	let bitIndex = 0;
	let right = size - 1;
	while (right >= 1) {
		// Column 6 is the vertical timing line: from there on, every pair sits one column further left.
		if (right === QR_TIMING_LINE) right -= 1;
		// The first pair (at the right edge) runs upward, and the direction alternates with every pair.
		const isUpward = Math.floor((right + 1) / COLUMN_PAIR_WIDTH) % 2 === 0;
		for (let step = 0; step < size; step += 1) {
			const row = isUpward ? size - 1 - step : step;
			for (let offset = 0; offset < COLUMN_PAIR_WIDTH; offset += 1) {
				const column = right - offset;
				if (grid.isFunction(row, column)) continue;
				const isDark =
					bitIndex < totalBits &&
					bitIsSet(readTableEntry(codewords, Math.floor(bitIndex / QR_CODEWORD_BITS), "codewords"), QR_CODEWORD_BITS - 1 - (bitIndex % QR_CODEWORD_BITS));
				grid.setDataModule(row, column, isDark);
				bitIndex += 1;
			}
		}
		right -= COLUMN_PAIR_WIDTH;
	}
}
