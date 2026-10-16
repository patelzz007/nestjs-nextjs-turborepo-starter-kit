import { z } from "zod";

import { QR_CODEWORD_BITS } from "./qr-bit-buffer";
import { addErrorCorrectionAndInterleave, buildDataCodewords } from "./qr-codewords";
import { DEFAULT_QR_ERROR_CORRECTION_LEVEL, QrErrorCorrectionLevelSchema, strongerErrorCorrectionLevels, type QrErrorCorrectionLevel } from "./qr-error-correction";
import { QrDataTooLongError, QrInvalidOptionsError } from "./qr-errors";
import { buildFunctionPatterns, placeCodewords } from "./qr-function-patterns";
import { QrMaskSchema, selectBestMask, withMask, type QrMask } from "./qr-mask";
import { type QrModuleGrid } from "./qr-module-grid";
import { makeSegment, segmentsBitLength, type QrSegment } from "./qr-segment";
import { dataCodewords, MAX_QR_VERSION, MIN_QR_VERSION } from "./qr-version-table";

/** A QR Model 2 version number, 1–40. */
export const QrVersionSchema = z.int().min(MIN_QR_VERSION).max(MAX_QR_VERSION);

/** How to encode: every field is optional and has a default. */
export const QrEncodeOptionsSchema = z
	.object({
		/** The minimum error-correction level. Defaults to `M`. */
		errorCorrectionLevel: QrErrorCorrectionLevelSchema.default(DEFAULT_QR_ERROR_CORRECTION_LEVEL),
		/** The smallest version to consider (default 1). Set `minVersion` = `maxVersion` to force a version. */
		minVersion: QrVersionSchema.default(MIN_QR_VERSION),
		/** The largest version to consider (default 40); text that does not fit throws {@link QrDataTooLongError}. */
		maxVersion: QrVersionSchema.default(MAX_QR_VERSION),
		/** Force one data mask (0–7) instead of picking the lowest-penalty one — for tests and reproducible output. */
		mask: QrMaskSchema.optional(),
		/**
		 * Raise the error-correction level as far as the text still fits in the SAME version
		 * (default `true`): extra damage tolerance at no cost in size.
		 */
		boostErrorCorrection: z.boolean().default(true),
	})
	.strict()
	.refine((options: { readonly minVersion: number; readonly maxVersion: number }): boolean => options.minVersion <= options.maxVersion, {
		message: "minVersion must not exceed maxVersion",
		path: ["minVersion"],
	});

/** The options a caller passes (all optional). */
export type QrEncodeOptions = z.input<typeof QrEncodeOptionsSchema>;

/** The options after defaults are applied. */
export type ResolvedQrEncodeOptions = z.output<typeof QrEncodeOptionsSchema>;

/** A finished QR symbol: its parameters and its modules, addressed `(row, column)` from the top-left. */
export class QrMatrix {
	public constructor(
		/** Version 1–40. */
		public readonly version: number,
		/** The level actually used (it can be higher than requested when boosted). */
		public readonly errorCorrectionLevel: QrErrorCorrectionLevel,
		/** The data mask applied, 0–7. */
		public readonly mask: QrMask,
		private readonly _grid: QrModuleGrid,
	) {}

	/** Edge length in modules (21 for version 1, 177 for version 40), without a quiet zone. */
	public get size(): number {
		return this._grid.size;
	}

	/** `true` when the module at `(row, column)` is dark. Anything outside the symbol (the quiet zone) is light. */
	public isDark(row: number, column: number): boolean {
		return this._grid.isDark(row, column);
	}
}

/** Validates the options, or throws {@link QrInvalidOptionsError} naming what is wrong. */
export function resolveQrEncodeOptions(options: QrEncodeOptions): ResolvedQrEncodeOptions {
	const parsed = QrEncodeOptionsSchema.safeParse(options);
	if (!parsed.success) throw new QrInvalidOptionsError(z.prettifyError(parsed.error), { cause: parsed.error });
	return parsed.data;
}

/** The chosen version and level for `segments`. */
interface QrSymbolParameters {
	readonly version: number;
	readonly errorCorrectionLevel: QrErrorCorrectionLevel;
}

/** `true` when `segments` fit in `version` at `level`. */
function fits(segments: readonly QrSegment[], version: number, level: QrErrorCorrectionLevel): boolean {
	const bits = segmentsBitLength(segments, version);
	return bits !== undefined && bits <= dataCodewords(version, level) * QR_CODEWORD_BITS;
}

/** The smallest allowed version that holds `segments`, then the strongest level that still fits in it (when boosting). */
function chooseSymbolParameters(segments: readonly QrSegment[], options: ResolvedQrEncodeOptions): QrSymbolParameters {
	const { errorCorrectionLevel, minVersion, maxVersion, boostErrorCorrection } = options;
	for (let version = minVersion; version <= maxVersion; version += 1) {
		if (!fits(segments, version, errorCorrectionLevel)) continue;
		const boosted = boostErrorCorrection
			? strongerErrorCorrectionLevels(errorCorrectionLevel)
					.filter((level: QrErrorCorrectionLevel): boolean => fits(segments, version, level))
					.at(-1)
			: undefined;
		return { version, errorCorrectionLevel: boosted ?? errorCorrectionLevel };
	}
	const requiredBits = segmentsBitLength(segments, maxVersion) ?? Number.POSITIVE_INFINITY;
	throw new QrDataTooLongError(requiredBits, dataCodewords(maxVersion, errorCorrectionLevel) * QR_CODEWORD_BITS, maxVersion, errorCorrectionLevel);
}

/**
 * Encodes `text` as a QR Model 2 symbol (ISO/IEC 18004): one segment in the densest mode
 * that holds the whole text (numeric, alphanumeric, else UTF-8 bytes), the smallest version
 * that fits, Reed–Solomon error correction, and the lowest-penalty mask unless one is forced.
 *
 * @throws QrInvalidOptionsError when the options are out of range.
 * @throws QrDataTooLongError when the text does not fit in `maxVersion`.
 */
export function encodeQr(text: string, options: QrEncodeOptions = {}): QrMatrix {
	const resolved = resolveQrEncodeOptions(options);
	// An empty text is a valid symbol with no segments: just the terminator and padding.
	const segments: readonly QrSegment[] = text.length === 0 ? [] : [makeSegment(text)];
	const { version, errorCorrectionLevel } = chooseSymbolParameters(segments, resolved);
	const codewords = addErrorCorrectionAndInterleave(buildDataCodewords(segments, version, errorCorrectionLevel), version, errorCorrectionLevel);
	const unmasked = buildFunctionPatterns(version, errorCorrectionLevel);
	placeCodewords(unmasked, codewords);
	const mask = resolved.mask ?? selectBestMask(unmasked, errorCorrectionLevel);
	return new QrMatrix(version, errorCorrectionLevel, mask, withMask(unmasked, errorCorrectionLevel, mask));
}
