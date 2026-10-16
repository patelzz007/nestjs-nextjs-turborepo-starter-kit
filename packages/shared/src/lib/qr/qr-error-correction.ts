import { z } from "zod";

/**
 * The four QR error-correction levels (ISO/IEC 18004 §7.5.1), weakest first. Each recovers
 * roughly this share of damaged codewords: L 7 %, M 15 %, Q 25 %, H 30 %.
 */
export const QrErrorCorrectionLevelSchema = z.enum(["L", "M", "Q", "H"]);

export type QrErrorCorrectionLevel = z.infer<typeof QrErrorCorrectionLevelSchema>;

/** The level used when the caller names none: a balance of density and damage tolerance. */
export const DEFAULT_QR_ERROR_CORRECTION_LEVEL: QrErrorCorrectionLevel = "M";

/** Every level, weakest first — the order {@link QR_ERROR_CORRECTION_LEVEL_ORDINAL} counts in. */
export const QR_ERROR_CORRECTION_LEVELS: readonly QrErrorCorrectionLevel[] = QrErrorCorrectionLevelSchema.options;

/** Position of each level in the capacity tables (`qr-version-table.ts`), weakest first. */
export const QR_ERROR_CORRECTION_LEVEL_ORDINAL: Readonly<Record<QrErrorCorrectionLevel, number>> = { L: 0, M: 1, Q: 2, H: 3 };

/**
 * The 2-bit level indicator written into the format information (ISO/IEC 18004 Table 12).
 * It is deliberately NOT the ordinal: L = 01, M = 00, Q = 11, H = 10.
 */
export const QR_ERROR_CORRECTION_FORMAT_BITS: Readonly<Record<QrErrorCorrectionLevel, number>> = { L: 1, M: 0, Q: 3, H: 2 };

/** The levels strictly stronger than `level`, weakest first — the candidates for an error-correction boost. */
export function strongerErrorCorrectionLevels(level: QrErrorCorrectionLevel): readonly QrErrorCorrectionLevel[] {
	return QR_ERROR_CORRECTION_LEVELS.filter(
		(candidate: QrErrorCorrectionLevel): boolean => QR_ERROR_CORRECTION_LEVEL_ORDINAL[candidate] > QR_ERROR_CORRECTION_LEVEL_ORDINAL[level],
	);
}
