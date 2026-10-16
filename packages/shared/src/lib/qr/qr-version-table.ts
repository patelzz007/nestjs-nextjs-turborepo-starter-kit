import { QR_CODEWORD_BITS } from "./qr-bit-buffer";
import { QR_ERROR_CORRECTION_LEVEL_ORDINAL, type QrErrorCorrectionLevel } from "./qr-error-correction";
import { readTableEntry } from "./qr-table";

/** The smallest and largest QR Model 2 versions (21×21 to 177×177 modules). */
export const MIN_QR_VERSION = 1;
export const MAX_QR_VERSION = 40;

/** Version 1 is 21 modules wide; every version adds 4 (ISO/IEC 18004 §5.3.1). */
const VERSION_ONE_SIZE_MODULES = 17;
const MODULES_PER_VERSION_STEP = 4;

/** Versions 7 and up carry an 18-bit version information block (§7.10). */
export const MIN_QR_VERSION_WITH_VERSION_INFO = 7;

/**
 * Error-correction codewords per block, by level (L, M, Q, H) then version 1–40
 * (ISO/IEC 18004 Table 9).
 */
const EC_CODEWORDS_PER_BLOCK: readonly (readonly number[])[] = [
	[7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
	[10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
	[13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
	[17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];

/** Error-correction blocks, by level (L, M, Q, H) then version 1–40 (ISO/IEC 18004 Table 9). */
const EC_BLOCK_COUNT: readonly (readonly number[])[] = [
	[1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
	[1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
	[1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
	[1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];

/** A row of a per-version table, for one level. */
function levelRow(table: readonly (readonly number[])[], level: QrErrorCorrectionLevel, tableName: string): readonly number[] {
	const row = table.at(QR_ERROR_CORRECTION_LEVEL_ORDINAL[level]);
	if (row === undefined) throw new RangeError(`QR table "${tableName}" has no row for level ${level}`);
	return row;
}

/** Edge length of a symbol of `version`, in modules (21 for version 1, 177 for version 40). */
export function qrSizeForVersion(version: number): number {
	return VERSION_ONE_SIZE_MODULES + MODULES_PER_VERSION_STEP * version;
}

/** Alignment patterns per row/column grow by one every 7 versions, starting at 2 for version 2. */
const ALIGNMENT_VERSION_STEP = 7;
const MIN_ALIGNMENT_PATTERN_COUNT = 2;
/** Every alignment row/column list starts at module 6, on the timing pattern. */
const FIRST_ALIGNMENT_POSITION = 6;
/** The last alignment pattern sits 7 modules in from the far edge. */
const LAST_ALIGNMENT_INSET_MODULES = 7;
/** Version 32 is the one version whose spacing breaks the general formula (Annex E). */
const IRREGULAR_ALIGNMENT_VERSION = 32;
const IRREGULAR_ALIGNMENT_STEP_MODULES = 26;

/**
 * Row/column centres of the alignment patterns for `version`, ascending (ISO/IEC 18004
 * Annex E): `[]` for version 1, `[6, 18]` for version 2, `[6, 22, 38]` for version 7.
 * Patterns sit at every pairing of these, except the three overlapping the finders.
 */
export function alignmentPatternPositions(version: number): readonly number[] {
	if (version === MIN_QR_VERSION) return [];
	const count = Math.floor(version / ALIGNMENT_VERSION_STEP) + MIN_ALIGNMENT_PATTERN_COUNT;
	const step =
		version === IRREGULAR_ALIGNMENT_VERSION
			? IRREGULAR_ALIGNMENT_STEP_MODULES
			: 2 * Math.ceil((version * MODULES_PER_VERSION_STEP + MODULES_PER_VERSION_STEP) / (2 * count - 2));
	const last = qrSizeForVersion(version) - LAST_ALIGNMENT_INSET_MODULES;
	const descending = Array.from({ length: count - 1 }, (_: undefined, index: number): number => last - index * step);
	return [FIRST_ALIGNMENT_POSITION, ...descending.reverse()];
}

/** Modules taken by one finder pattern plus its separator (8×8), times three finders, plus the format area. */
const FINDER_AND_FORMAT_AREA_MODULES = 3 * 8 * 8 + 2 * 15 + 1;
/** Modules in one 5×5 alignment pattern. */
const ALIGNMENT_PATTERN_MODULES = 25;
/** Modules in both 6×3 version information blocks. */
const VERSION_INFO_MODULES = 36;
/** A timing pattern runs between the separators: the size minus two 8-module finder areas. */
const TIMING_PATTERN_INSET_MODULES = 16;
/** The alignment patterns that sit on a timing pattern each overlap it by five modules. */
const ALIGNMENT_TIMING_OVERLAP_MODULES = 5;

/**
 * Modules available for data and error-correction bits in `version` — the whole symbol
 * minus every function pattern (finders, separators, timing, alignment, format and version
 * information, dark module). Includes the 0–7 remainder bits that hold no codeword.
 */
export function rawDataModules(version: number): number {
	const size = qrSizeForVersion(version);
	let functionModules = FINDER_AND_FORMAT_AREA_MODULES + 2 * (size - TIMING_PATTERN_INSET_MODULES);
	const alignmentCount = alignmentPatternPositions(version).length;
	if (alignmentCount > 0) {
		// alignmentCount² patterns minus the 3 under the finders; the ones on a timing line share 5 modules with it.
		const patterns = alignmentCount * alignmentCount - 3;
		const onTimingLines = 2 * (alignmentCount - 2);
		functionModules += patterns * ALIGNMENT_PATTERN_MODULES - onTimingLines * ALIGNMENT_TIMING_OVERLAP_MODULES;
	}
	if (version >= MIN_QR_VERSION_WITH_VERSION_INFO) functionModules += VERSION_INFO_MODULES;
	return size * size - functionModules;
}

/** Codewords (data + error correction) that fit in `version`. */
export function totalCodewords(version: number): number {
	return Math.floor(rawDataModules(version) / QR_CODEWORD_BITS);
}

/** Error-correction codewords in each block of `version` at `level`. */
export function ecCodewordsPerBlock(version: number, level: QrErrorCorrectionLevel): number {
	return readTableEntry(levelRow(EC_CODEWORDS_PER_BLOCK, level, "ec-codewords-per-block"), version - MIN_QR_VERSION, "ec-codewords-per-block");
}

/** Error-correction blocks in `version` at `level`. */
export function ecBlockCount(version: number, level: QrErrorCorrectionLevel): number {
	return readTableEntry(levelRow(EC_BLOCK_COUNT, level, "ec-block-count"), version - MIN_QR_VERSION, "ec-block-count");
}

/** Data codewords (the payload's capacity) of `version` at `level`. */
export function dataCodewords(version: number, level: QrErrorCorrectionLevel): number {
	return totalCodewords(version) - ecCodewordsPerBlock(version, level) * ecBlockCount(version, level);
}
