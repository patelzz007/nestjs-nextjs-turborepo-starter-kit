import { z } from "zod";

import { type QrErrorCorrectionLevel } from "./qr-error-correction";
import { qrFormatBits } from "./qr-format-info";
import { drawFormatInfo } from "./qr-function-patterns";
import { type QrModuleGrid } from "./qr-module-grid";

/** The eight data masks are numbered 0–7 (ISO/IEC 18004 §7.8.2). */
export const MIN_QR_MASK = 0;
export const MAX_QR_MASK = 7;

/** A data-mask pattern reference, 0–7. */
export const QrMaskSchema = z.int().min(MIN_QR_MASK).max(MAX_QR_MASK);

export type QrMask = z.infer<typeof QrMaskSchema>;

/** Every mask, in order — the candidates the automatic selection scores. */
export const QR_MASKS: readonly QrMask[] = Array.from({ length: MAX_QR_MASK - MIN_QR_MASK + 1 }, (_: undefined, index: number): QrMask => MIN_QR_MASK + index);

/**
 * The mask conditions of ISO/IEC 18004 Table 10, for module `(row, column)`: where the
 * condition holds, a data module is inverted. Written exactly as the standard states them
 * (i = row, j = column), so the literals are the standard's, not tuning values.
 */
const MASK_CONDITIONS: readonly ((row: number, column: number) => boolean)[] = [
	(row: number, column: number): boolean => (row + column) % 2 === 0,
	(row: number): boolean => row % 2 === 0,
	(_row: number, column: number): boolean => column % 3 === 0,
	(row: number, column: number): boolean => (row + column) % 3 === 0,
	(row: number, column: number): boolean => (Math.floor(row / 2) + Math.floor(column / 3)) % 2 === 0,
	(row: number, column: number): boolean => ((row * column) % 2) + ((row * column) % 3) === 0,
	(row: number, column: number): boolean => (((row * column) % 2) + ((row * column) % 3)) % 2 === 0,
	(row: number, column: number): boolean => (((row + column) % 2) + ((row * column) % 3)) % 2 === 0,
];

/** `true` when `mask` inverts the module at `(row, column)`. */
export function isMaskedModule(mask: QrMask, row: number, column: number): boolean {
	const condition = MASK_CONDITIONS.at(mask);
	if (condition === undefined) throw new RangeError(`QR mask ${String(mask)} does not exist`);
	return condition(row, column);
}

/** Inverts every data module of `grid` that `mask` selects (function modules are never masked). Applying it twice undoes it. */
export function applyMask(grid: QrModuleGrid, mask: QrMask): void {
	for (let row = 0; row < grid.size; row += 1) {
		for (let column = 0; column < grid.size; column += 1) {
			if (!grid.isFunction(row, column) && isMaskedModule(mask, row, column)) grid.toggle(row, column);
		}
	}
}

/** Penalty weights N1–N4 (ISO/IEC 18004 §7.8.3.1, Table 11). */
export const QR_PENALTY_N1 = 3;
export const QR_PENALTY_N2 = 3;
export const QR_PENALTY_N3 = 40;
export const QR_PENALTY_N4 = 10;

/** Rule 1 starts scoring at a run of 5 same-coloured modules. */
const MIN_PENALISED_RUN = 5;

/** Rule 3's finder-like patterns: dark-light-dark×3-light-dark with 4 light modules on one side (1011101 0000 and 0000 1011101). */
const FINDER_LIKE_WINDOW_MODULES = 11;
const FINDER_LIKE_PATTERNS: readonly number[] = [0b10111010000, 0b00001011101];
const FINDER_LIKE_WINDOW_MASK = (1 << FINDER_LIKE_WINDOW_MODULES) - 1;

/** Rule 4 scores each full 5 % step that the dark share deviates from 50 %. */
const DARK_SHARE_STEP_PERCENT = 5;
const PERCENT = 100;
const BALANCED_DARK_PERCENT = 50;

/** One line of modules — a row, or a column read top to bottom. */
type ModuleLine = (position: number) => boolean;

/** Every row and every column of `grid`, as readers of their modules. */
function gridLines(grid: QrModuleGrid): readonly ModuleLine[] {
	const lines: ModuleLine[] = [];
	for (let index = 0; index < grid.size; index += 1) {
		lines.push((position: number): boolean => grid.isDark(index, position));
		lines.push((position: number): boolean => grid.isDark(position, index));
	}
	return lines;
}

/** Rule 1 score of one line: N1 + (run − 5) for every run of 5 or more same-coloured modules. */
function runPenalty(line: ModuleLine, size: number): number {
	let penalty = 0;
	let runLength = 0;
	let runIsDark = false;
	const scoreRun = (): void => {
		if (runLength >= MIN_PENALISED_RUN) penalty += QR_PENALTY_N1 + (runLength - MIN_PENALISED_RUN);
	};
	for (let position = 0; position < size; position += 1) {
		const isDark = line(position);
		if (position > 0 && isDark === runIsDark) {
			runLength += 1;
		} else {
			scoreRun();
			runIsDark = isDark;
			runLength = 1;
		}
	}
	scoreRun();
	return penalty;
}

/** Rule 3 score of one line: N3 for every 11-module window, inside the symbol, that matches a finder-like pattern. */
function finderLikePenalty(line: ModuleLine, size: number): number {
	let penalty = 0;
	let window = 0;
	for (let position = 0; position < size; position += 1) {
		window = ((window << 1) & FINDER_LIKE_WINDOW_MASK) | (line(position) ? 1 : 0);
		if (position >= FINDER_LIKE_WINDOW_MODULES - 1 && FINDER_LIKE_PATTERNS.includes(window)) penalty += QR_PENALTY_N3;
	}
	return penalty;
}

/** Penalty rule 1 (§7.8.3.1, feature "adjacent modules in row/column in same colour") over every row and column. */
export function penaltyAdjacentRuns(grid: QrModuleGrid): number {
	return gridLines(grid).reduce((total: number, line: ModuleLine): number => total + runPenalty(line, grid.size), 0);
}

/** Penalty rule 2: N2 for every 2×2 block of one colour (overlapping blocks each count — the standard's (m−1)(n−1) per m×n block). */
export function penaltySameColourBlocks(grid: QrModuleGrid): number {
	let penalty = 0;
	for (let row = 0; row < grid.size - 1; row += 1) {
		for (let column = 0; column < grid.size - 1; column += 1) {
			const colour = grid.isDark(row, column);
			if (grid.isDark(row, column + 1) === colour && grid.isDark(row + 1, column) === colour && grid.isDark(row + 1, column + 1) === colour) penalty += QR_PENALTY_N2;
		}
	}
	return penalty;
}

/**
 * Penalty rule 3: N3 for every 1:1:3:1:1 finder-like pattern with 4 light modules before or
 * after it, in any row or column. Only windows fully inside the symbol count — the quiet
 * zone is not part of the matrix being scored (the same reading as the `qrcode` npm package).
 */
export function penaltyFinderLikePatterns(grid: QrModuleGrid): number {
	return gridLines(grid).reduce((total: number, line: ModuleLine): number => total + finderLikePenalty(line, grid.size), 0);
}

/**
 * Penalty rule 4: N4 × k, where k counts the full 5 % steps by which the share of dark
 * modules falls outside 45–55 % (45–55 % scores 0, 40–45 % or 55–60 % scores 10, …), as
 * Table 11 states it. The `qrcode` npm package scores this rule off-centre (anything over
 * 50 % dark already costs 10), which is the one reason its automatic mask choice can differ.
 */
export function penaltyDarkBalance(grid: QrModuleGrid): number {
	const totalModules = grid.size * grid.size;
	// |dark% − 50%| in units of 5 %, kept in integers (scaled by totalModules) so no rounding error moves a boundary.
	const scaledDeviation = Math.abs(grid.darkCount() * PERCENT - totalModules * BALANCED_DARK_PERCENT);
	const steps = Math.max(0, Math.ceil(scaledDeviation / (totalModules * DARK_SHARE_STEP_PERCENT)) - 1);
	return steps * QR_PENALTY_N4;
}

/** The total penalty score of a finished (masked, format-drawn) symbol: rules 1–4. */
export function maskPenalty(grid: QrModuleGrid): number {
	return penaltyAdjacentRuns(grid) + penaltySameColourBlocks(grid) + penaltyFinderLikePatterns(grid) + penaltyDarkBalance(grid);
}

/** `grid` (codewords placed, unmasked) with `mask` applied and the format information for `level` + `mask` drawn. */
export function withMask(grid: QrModuleGrid, level: QrErrorCorrectionLevel, mask: QrMask): QrModuleGrid {
	const masked = grid.clone();
	applyMask(masked, mask);
	drawFormatInfo(masked, qrFormatBits(level, mask));
	return masked;
}

/** The mask whose finished symbol scores the lowest penalty; ties go to the lower-numbered mask. */
export function selectBestMask(grid: QrModuleGrid, level: QrErrorCorrectionLevel): QrMask {
	let bestMask: QrMask = MIN_QR_MASK;
	let bestPenalty = Number.POSITIVE_INFINITY;
	for (const mask of QR_MASKS) {
		const penalty = maskPenalty(withMask(grid, level, mask));
		if (penalty < bestPenalty) {
			bestPenalty = penalty;
			bestMask = mask;
		}
	}
	return bestMask;
}
