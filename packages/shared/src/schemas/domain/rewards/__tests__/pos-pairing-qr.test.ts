import { describe, expect, it } from "vitest";

import { buildPosPairingQrPayload, POS_PAIRING_QR_PREFIX, PosPairingQrPayloadSchema } from "./pos-pairing-qr";

const PAIRING_CODE = "ABCD2345";

describe("buildPosPairingQrPayload", () => {
	it("prefixes the pairing code with the versioned marker", () => {
		expect(buildPosPairingQrPayload(PAIRING_CODE)).toBe(`${POS_PAIRING_QR_PREFIX}${PAIRING_CODE}`);
	});
});

describe("PosPairingQrPayloadSchema", () => {
	it("parses a built payload back to its pairing code (round trip)", () => {
		expect(PosPairingQrPayloadSchema.parse(buildPosPairingQrPayload(PAIRING_CODE))).toBe(PAIRING_CODE);
	});

	it("tolerates surrounding whitespace a scanner may add", () => {
		expect(PosPairingQrPayloadSchema.parse(`  ${buildPosPairingQrPayload(PAIRING_CODE)}\n`)).toBe(PAIRING_CODE);
	});

	it("rejects a customer's redemption token (no prefix)", () => {
		expect(PosPairingQrPayloadSchema.safeParse("t".repeat(32)).success).toBe(false);
	});

	it("rejects another version of the format", () => {
		expect(PosPairingQrPayloadSchema.safeParse(`pos-pair:v2:${PAIRING_CODE}`).success).toBe(false);
	});

	it("rejects a code outside the pairing alphabet or length", () => {
		expect(PosPairingQrPayloadSchema.safeParse(`${POS_PAIRING_QR_PREFIX}ABCD1234`).success).toBe(false);
		expect(PosPairingQrPayloadSchema.safeParse(`${POS_PAIRING_QR_PREFIX}ABCD234`).success).toBe(false);
		expect(PosPairingQrPayloadSchema.safeParse(POS_PAIRING_QR_PREFIX).success).toBe(false);
	});
});
