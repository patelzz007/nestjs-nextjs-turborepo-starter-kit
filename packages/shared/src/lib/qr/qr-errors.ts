import type { QrErrorCorrectionLevel } from "./qr-error-correction";

/** The text does not fit in any QR version allowed by the options, at the requested error-correction level. */
export class QrDataTooLongError extends Error {
	public constructor(
		/** Bits the encoded text needs (mode + character count + data) in the largest allowed version. */
		public readonly requiredBits: number,
		/** Data bits the largest allowed version holds at `errorCorrectionLevel`. */
		public readonly capacityBits: number,
		public readonly maxVersion: number,
		public readonly errorCorrectionLevel: QrErrorCorrectionLevel,
	) {
		super(`QR data too long: needs ${String(requiredBits)} bits, version ${String(maxVersion)}-${errorCorrectionLevel} holds ${String(capacityBits)}`);
		this.name = "QrDataTooLongError";
	}
}

/** The encode options are out of range (version outside 1–40, `minVersion > maxVersion`, mask outside 0–7). */
export class QrInvalidOptionsError extends Error {
	public constructor(message: string, options?: ErrorOptions) {
		super(`Invalid QR options: ${message}`, options);
		this.name = "QrInvalidOptionsError";
	}
}

/**
 * A lookup past the end of one of the encoder's own fixed tables. It cannot happen for
 * validated options; it exists so a table read is never silently `undefined`.
 */
export class QrTableLookupError extends Error {
	public constructor(
		public readonly table: string,
		public readonly index: number,
	) {
		super(`QR table "${table}" has no entry at index ${String(index)}`);
		this.name = "QrTableLookupError";
	}
}
