import { describe, expect, it } from "vitest";

import {
	DEFAULT_QR_ERROR_CORRECTION_LEVEL,
	QR_ERROR_CORRECTION_FORMAT_BITS,
	QR_ERROR_CORRECTION_LEVEL_ORDINAL,
	QR_ERROR_CORRECTION_LEVELS,
	QrErrorCorrectionLevelSchema,
	strongerErrorCorrectionLevels,
} from "./qr-error-correction";

describe("QrErrorCorrectionLevelSchema", () => {
	it("accepts the four levels and nothing else", () => {
		expect(QR_ERROR_CORRECTION_LEVELS).toEqual(["L", "M", "Q", "H"]);
		expect(QrErrorCorrectionLevelSchema.safeParse("Q").success).toBe(true);
		expect(QrErrorCorrectionLevelSchema.safeParse("m").success).toBe(false);
		expect(QrErrorCorrectionLevelSchema.safeParse("X").success).toBe(false);
	});

	it("defaults to M", () => {
		expect(DEFAULT_QR_ERROR_CORRECTION_LEVEL).toBe("M");
	});
});

describe("level tables", () => {
	it("orders the levels weakest first", () => {
		expect(QR_ERROR_CORRECTION_LEVEL_ORDINAL).toEqual({ L: 0, M: 1, Q: 2, H: 3 });
	});

	it("uses the format indicator bits of Table 12 (L 01, M 00, Q 11, H 10)", () => {
		expect(QR_ERROR_CORRECTION_FORMAT_BITS).toEqual({ L: 0b01, M: 0b00, Q: 0b11, H: 0b10 });
	});
});

describe("strongerErrorCorrectionLevels", () => {
	it("lists the stronger levels weakest first", () => {
		expect(strongerErrorCorrectionLevels("L")).toEqual(["M", "Q", "H"]);
		expect(strongerErrorCorrectionLevels("Q")).toEqual(["H"]);
		expect(strongerErrorCorrectionLevels("H")).toEqual([]);
	});
});
