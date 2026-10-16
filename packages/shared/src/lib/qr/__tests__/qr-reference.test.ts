import { describe, expect, it } from "vitest";
import { z } from "zod";

import { encodeQr, QrVersionSchema, type QrMatrix } from "../qr-encode";
import { QrErrorCorrectionLevelSchema } from "../qr-error-correction";
import { penaltyAdjacentRuns, penaltyDarkBalance, penaltyFinderLikePatterns, penaltySameColourBlocks, QR_MASKS, QrMaskSchema, type QrMask } from "../qr-mask";
import { QrModuleGrid } from "../qr-module-grid";
import referenceMatrices from "../qr-reference-matrices.json";
import { QrModeSchema, selectQrMode } from "../qr-segment";

/**
 * Bit-for-bit conformance against an independent encoder. `qr-reference-matrices.json` was
 * produced once by the `qrcode` npm package (v1.5.4, see its `generator` field) for the same
 * text, mode, version, level and mask; the file is data read from disk, so it is parsed.
 *
 * Automatic mask choice: `qrcode` scores penalty rule 4 (dark-module balance) off-centre —
 * 50–55 % dark already costs 10 points, where ISO/IEC 18004 Table 11 scores 45–55 % as 0 —
 * and this encoder follows the standard. Rules 1–3 are scored identically. A one-off
 * comparison over 600 random numeric / alphanumeric / UTF-8 inputs at every level found the
 * same minimum version and bit-identical forced-mask matrices for all of them, and 7
 * different automatic masks, every one of which disappeared with `qrcode`'s rule 4 swapped
 * in. So the tests below assert forced-mask equality, and that `qrcode`'s automatic pick is
 * exactly what this encoder's rules 1–3 plus `qrcode`'s rule 4 select.
 */
const ReferenceMatricesSchema = z
	.object({
		generator: z.string(),
		fixtures: z.array(
			z
				.object({
					name: z.string(),
					text: z.string(),
					mode: QrModeSchema,
					errorCorrectionLevel: QrErrorCorrectionLevelSchema,
					version: QrVersionSchema,
					mask: QrMaskSchema,
					referenceAutoMask: QrMaskSchema,
					referenceMinimalVersion: QrVersionSchema,
					rows: z.array(z.string().regex(/^[01]+$/u)),
				})
				.strict(),
		),
	})
	.strict();

const { fixtures } = ReferenceMatricesSchema.parse(referenceMatrices);

/** `qrcode`'s rule 4 (lib/core/mask-pattern.js `getPenaltyN4`), reproduced only to explain its automatic mask. */
const QRCODE_N4_WEIGHT = 10;
const QRCODE_N4_STEP_PERCENT = 5;
const QRCODE_N4_CENTRE_STEPS = 10;
const PERCENT = 100;

function qrcodePackageDarkBalance(grid: QrModuleGrid): number {
	const darkPercent = (grid.darkCount() * PERCENT) / (grid.size * grid.size);
	return Math.abs(Math.ceil(darkPercent / QRCODE_N4_STEP_PERCENT) - QRCODE_N4_CENTRE_STEPS) * QRCODE_N4_WEIGHT;
}

/** The matrix as rows of `1` (dark) and `0` (light) — the fixture's notation. */
function toRows(matrix: QrMatrix): string[] {
	return Array.from({ length: matrix.size }, (_: undefined, row: number): string =>
		Array.from({ length: matrix.size }, (__: undefined, column: number): string => (matrix.isDark(row, column) ? "1" : "0")).join(""),
	);
}

/** A finished matrix copied into a grid, so the penalty rules can score it. */
function toGrid(matrix: QrMatrix): QrModuleGrid {
	const grid = new QrModuleGrid(matrix.size);
	for (let row = 0; row < matrix.size; row += 1) for (let column = 0; column < matrix.size; column += 1) grid.setFunctionModule(row, column, matrix.isDark(row, column));
	return grid;
}

/** One mask's penalty under this encoder's rules and under `qrcode`'s rule 4. */
interface MaskScore {
	readonly mask: QrMask;
	readonly ours: number;
	readonly theirs: number;
}

/** The lowest-scoring mask by `key`, the lower number on a tie (both encoders break ties that way). */
function lowestMask(scores: readonly MaskScore[], key: "ours" | "theirs"): QrMask | undefined {
	let best: MaskScore | undefined;
	for (const score of scores) if (best === undefined || score[key] < best[key]) best = score;
	return best?.mask;
}

describe("encodeQr against the qrcode reference matrices", () => {
	it("covers every mask, every level and versions with and without version information", () => {
		expect(new Set(fixtures.map((fixture): number => fixture.mask)).size).toBe(8);
		expect(new Set(fixtures.map((fixture): string => fixture.errorCorrectionLevel))).toEqual(new Set(["L", "M", "Q", "H"]));
		expect(fixtures.some((fixture): boolean => fixture.version >= 7)).toBe(true);
		expect(fixtures.some((fixture): boolean => fixture.version >= 10)).toBe(true);
	});

	describe.each(fixtures)("$name ($mode, version $version-$errorCorrectionLevel, mask $mask)", (fixture) => {
		const fixed = { errorCorrectionLevel: fixture.errorCorrectionLevel, minVersion: fixture.version, maxVersion: fixture.version, boostErrorCorrection: false };

		it("picks the same single mode", () => {
			expect(selectQrMode(fixture.text)).toBe(fixture.mode);
		});

		it("reproduces the reference matrix bit for bit with the same forced version, level and mask", () => {
			const matrix = encodeQr(fixture.text, { ...fixed, mask: fixture.mask });
			expect(matrix.version).toBe(fixture.version);
			expect(matrix.errorCorrectionLevel).toBe(fixture.errorCorrectionLevel);
			expect(matrix.mask).toBe(fixture.mask);
			expect(toRows(matrix)).toEqual(fixture.rows);
		});

		it("explains qrcode's automatic mask with the same rules 1–3 (rule 4 being the only difference)", () => {
			const scores = QR_MASKS.map((mask: QrMask): MaskScore => {
				const grid = toGrid(encodeQr(fixture.text, { ...fixed, mask }));
				const sharedRules = penaltyAdjacentRuns(grid) + penaltySameColourBlocks(grid) + penaltyFinderLikePatterns(grid);
				return { mask, ours: sharedRules + penaltyDarkBalance(grid), theirs: sharedRules + qrcodePackageDarkBalance(grid) };
			});
			expect(lowestMask(scores, "theirs")).toBe(fixture.referenceAutoMask);
			expect(encodeQr(fixture.text, fixed).mask).toBe(lowestMask(scores, "ours"));
		});

		it("chooses the same minimum version", () => {
			const matrix = encodeQr(fixture.text, { errorCorrectionLevel: fixture.errorCorrectionLevel, boostErrorCorrection: false });
			expect(matrix.version).toBe(fixture.referenceMinimalVersion);
		});
	});
});
