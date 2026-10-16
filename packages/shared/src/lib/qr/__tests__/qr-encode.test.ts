import { describe, expect, it } from "vitest";

import { encodeQr, QrMatrix, resolveQrEncodeOptions } from "../qr-encode";
import { QrDataTooLongError, QrInvalidOptionsError } from "../qr-errors";
import { maskPenalty, QR_MASKS, type QrMask } from "../qr-mask";
import { QrModuleGrid } from "../qr-module-grid";

describe("resolveQrEncodeOptions", () => {
	it("applies the defaults: level M, versions 1–40, automatic mask, boost on", () => {
		expect(resolveQrEncodeOptions({})).toEqual({ errorCorrectionLevel: "M", minVersion: 1, maxVersion: 40, boostErrorCorrection: true });
	});

	it("rejects out-of-range versions and masks, inverted version bounds and unknown keys", () => {
		expect(() => resolveQrEncodeOptions({ minVersion: 0 })).toThrow(QrInvalidOptionsError);
		expect(() => resolveQrEncodeOptions({ maxVersion: 41 })).toThrow(QrInvalidOptionsError);
		expect(() => resolveQrEncodeOptions({ minVersion: 5, maxVersion: 4 })).toThrow(/minVersion must not exceed maxVersion/u);
		expect(() => resolveQrEncodeOptions({ mask: 8 })).toThrow(QrInvalidOptionsError);
		expect(() => resolveQrEncodeOptions({ minVersion: 2.5 })).toThrow(QrInvalidOptionsError);
	});
});

describe("encodeQr", () => {
	it("encodes short text in version 1 (21×21)", () => {
		const matrix = encodeQr("HELLO WORLD", { boostErrorCorrection: false });
		expect(matrix).toBeInstanceOf(QrMatrix);
		expect([matrix.version, matrix.size, matrix.errorCorrectionLevel]).toEqual([1, 21, "M"]);
	});

	it("draws the finder patterns in three corners", () => {
		const matrix = encodeQr("finder");
		const corner = (top: number, left: number): boolean[] => [0, 1, 2, 3, 4, 5, 6].map((offset: number): boolean => matrix.isDark(top, left + offset));
		expect(corner(0, 0)).toEqual([true, true, true, true, true, true, true]);
		expect(corner(0, matrix.size - 7)).toEqual(corner(0, 0));
		expect(corner(matrix.size - 1, 0)).toEqual(corner(0, 0));
		expect(matrix.isDark(1, 1)).toBe(false);
	});

	it("treats everything outside the symbol as light (the quiet zone)", () => {
		const matrix = encodeQr("quiet");
		expect([matrix.isDark(-1, 0), matrix.isDark(0, -1), matrix.isDark(matrix.size, 0), matrix.isDark(0, matrix.size)]).toEqual([false, false, false, false]);
	});

	it("chooses the smallest version that fits, and respects minVersion", () => {
		expect(encodeQr("a".repeat(14), { errorCorrectionLevel: "M", boostErrorCorrection: false }).version).toBe(1);
		expect(encodeQr("a".repeat(15), { errorCorrectionLevel: "M", boostErrorCorrection: false }).version).toBe(2);
		expect(encodeQr("a", { minVersion: 5 }).version).toBe(5);
	});

	it("boosts the level as far as the text still fits in the same version", () => {
		// 7 bytes fit version 1-H (7 bytes max), so M is boosted to H; 8 bytes fit only up to Q.
		expect(encodeQr("abcdefg").errorCorrectionLevel).toBe("H");
		expect(encodeQr("abcdefgh").errorCorrectionLevel).toBe("Q");
		expect(encodeQr("abcdefg", { boostErrorCorrection: false }).errorCorrectionLevel).toBe("M");
	});

	it("never boosts above the version that the requested level chose", () => {
		const boosted = encodeQr("a".repeat(15), { errorCorrectionLevel: "L" });
		expect(boosted.version).toBe(1);
		expect(boosted.errorCorrectionLevel).toBe("L");
	});

	it("uses a forced mask, and otherwise the lowest-penalty one", () => {
		expect(encodeQr("mask", { mask: 6 }).mask).toBe(6);
		const automatic = encodeQr("pick the best mask", { minVersion: 2, maxVersion: 2, errorCorrectionLevel: "Q", boostErrorCorrection: false });
		const penalty = (mask: QrMask): number => {
			const forced = encodeQr("pick the best mask", { minVersion: 2, maxVersion: 2, errorCorrectionLevel: "Q", boostErrorCorrection: false, mask });
			const grid = new QrModuleGrid(forced.size);
			for (let row = 0; row < forced.size; row += 1) for (let column = 0; column < forced.size; column += 1) grid.setFunctionModule(row, column, forced.isDark(row, column));
			return maskPenalty(grid);
		};
		const penalties = QR_MASKS.map(penalty);
		expect(penalties.indexOf(Math.min(...penalties))).toBe(automatic.mask);
	});

	it("encodes the empty string as a valid version 1 symbol", () => {
		const matrix = encodeQr("");
		expect(matrix.version).toBe(1);
	});

	it("reaches version 40 and stops there", () => {
		// 2953 bytes is version 40-L's byte capacity.
		expect(encodeQr("a".repeat(2953), { errorCorrectionLevel: "L" }).version).toBe(40);
		expect(() => encodeQr("a".repeat(2954), { errorCorrectionLevel: "L" })).toThrow(QrDataTooLongError);
	});

	it("throws QrDataTooLongError with the sizes when the text exceeds maxVersion", () => {
		let caught: QrDataTooLongError | undefined;
		try {
			encodeQr("a".repeat(30), { maxVersion: 1, errorCorrectionLevel: "M" });
		} catch (error: unknown) {
			if (error instanceof QrDataTooLongError) caught = error;
		}
		expect(caught?.requiredBits).toBe(4 + 8 + 30 * 8);
		expect(caught?.capacityBits).toBe(16 * 8);
		expect([caught?.maxVersion, caught?.errorCorrectionLevel]).toEqual([1, "M"]);
	});

	it("is deterministic", () => {
		const first = encodeQr("otpauth://totp/x?secret=ABC");
		const second = encodeQr("otpauth://totp/x?secret=ABC");
		expect([first.version, first.mask, first.errorCorrectionLevel]).toEqual([second.version, second.mask, second.errorCorrectionLevel]);
		for (let row = 0; row < first.size; row += 1) for (let column = 0; column < first.size; column += 1) expect(first.isDark(row, column)).toBe(second.isDark(row, column));
	});
});
