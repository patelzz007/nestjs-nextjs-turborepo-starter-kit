import { describe, expect, it } from "vitest";

import { QrDataTooLongError, QrInvalidOptionsError, QrTableLookupError } from "./qr-errors";

describe("QrDataTooLongError", () => {
	it("carries the sizes, the version and the level, and says so in its message", () => {
		const error = new QrDataTooLongError(400, 352, 2, "H");
		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe("QrDataTooLongError");
		expect([error.requiredBits, error.capacityBits, error.maxVersion, error.errorCorrectionLevel]).toEqual([400, 352, 2, "H"]);
		expect(error.message).toBe("QR data too long: needs 400 bits, version 2-H holds 352");
	});
});

describe("QrInvalidOptionsError", () => {
	it("prefixes the message and keeps the cause", () => {
		const cause = new Error("bad");
		const error = new QrInvalidOptionsError("minVersion must not exceed maxVersion", { cause });
		expect(error.name).toBe("QrInvalidOptionsError");
		expect(error.message).toBe("Invalid QR options: minVersion must not exceed maxVersion");
		expect(error.cause).toBe(cause);
	});
});

describe("QrTableLookupError", () => {
	it("names the table and the index", () => {
		const error = new QrTableLookupError("ec-block-count", 40);
		expect(error.name).toBe("QrTableLookupError");
		expect([error.table, error.index]).toEqual(["ec-block-count", 40]);
	});
});
