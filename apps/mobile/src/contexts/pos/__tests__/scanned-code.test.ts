import { buildPosPairingQrPayload } from "@workspace/shared";

import { classifyScannedCode } from "../scanned-code";

const TOKEN = "k3J9xQ2mV8pL1tR6wZ4bN7cY0dF5gH2s";

describe("classifyScannedCode", () => {
	it("reads a customer's redemption QR as its token", () => {
		expect(classifyScannedCode(TOKEN)).toEqual({ kind: "redemption", code: { token: TOKEN } });
	});

	it("trims what the scanner may add around the token", () => {
		expect(classifyScannedCode(` ${TOKEN}\n`)).toEqual({ kind: "redemption", code: { token: TOKEN } });
	});

	it("reads the merchant console's pairing QR as its pairing code", () => {
		expect(classifyScannedCode(buildPosPairingQrPayload("ABCD2345"))).toEqual({ kind: "pairing", pairingCode: "ABCD2345" });
	});

	it("rejects text too short to be a token", () => {
		expect(classifyScannedCode("hello")).toEqual({ kind: "unrecognised" });
		expect(classifyScannedCode("")).toEqual({ kind: "unrecognised" });
	});
});
