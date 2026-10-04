import { describe, expect, it } from "vitest";
import { PosPairingCodeSchema, PosTerminalIdSchema } from "@workspace/shared";

import { generatePairingCode, generateTerminalId, terminalStatus, terminalStatusWhere } from "./pos-terminal.util";

const NOW = 1_790_000_000_000;
const MINUTE_MS = 60_000;

function terminal(overrides: Partial<Parameters<typeof terminalStatus>[0]> = {}): Parameters<typeof terminalStatus>[0] {
	return { pairingCodeHash: null, pairingCodeExpiresAt: null, pairedAt: null, apiKey: null, ...overrides };
}

describe("generated identifiers", () => {
	it("makes terminal ids the POS header accepts", () => {
		const id = generateTerminalId();

		expect(id).toMatch(/^TERM-[A-HJ-NP-Z2-9]{8}$/u);
		expect(PosTerminalIdSchema.safeParse(id).success).toBe(true);
	});

	it("makes pairing codes from the unambiguous alphabet", () => {
		expect(PosPairingCodeSchema.safeParse(generatePairingCode()).success).toBe(true);
	});
});

describe("terminalStatus", () => {
	it("is awaiting pairing while a code is live", () => {
		expect(terminalStatus(terminal({ pairingCodeHash: "h", pairingCodeExpiresAt: BigInt(NOW + MINUTE_MS) }), NOW)).toBe("AWAITING_PAIRING");
	});

	it("is active once paired with an unrevoked key", () => {
		expect(terminalStatus(terminal({ pairedAt: BigInt(NOW), apiKey: { revokedAt: null } }), NOW)).toBe("ACTIVE");
	});

	it("shows a re-pair in progress as awaiting, and falls back to active when that code expires", () => {
		const paired = { pairedAt: BigInt(NOW), apiKey: { revokedAt: null } };

		expect(terminalStatus(terminal({ ...paired, pairingCodeHash: "h", pairingCodeExpiresAt: BigInt(NOW + MINUTE_MS) }), NOW)).toBe("AWAITING_PAIRING");
		expect(terminalStatus(terminal({ ...paired, pairingCodeHash: "h", pairingCodeExpiresAt: BigInt(NOW - 1) }), NOW)).toBe("ACTIVE");
	});

	it("is unpaired with an expired code, a revoked key, or no pairing at all", () => {
		expect(terminalStatus(terminal({ pairingCodeHash: "h", pairingCodeExpiresAt: BigInt(NOW - 1) }), NOW)).toBe("UNPAIRED");
		expect(terminalStatus(terminal({ pairedAt: BigInt(NOW), apiKey: { revokedAt: BigInt(NOW) } }), NOW)).toBe("UNPAIRED");
		expect(terminalStatus(terminal(), NOW)).toBe("UNPAIRED");
	});
});

describe("terminalStatusWhere", () => {
	it("filters awaiting tills exactly as terminalStatus derives them: a live, unexpired code", () => {
		expect(terminalStatusWhere("AWAITING_PAIRING", NOW)).toEqual({ pairingCodeHash: { not: null }, pairingCodeExpiresAt: { gte: NOW } });
	});

	it("filters active tills as paired with an unrevoked key and no live code (null-safe, so the remainder is UNPAIRED)", () => {
		expect(terminalStatusWhere("ACTIVE", NOW)).toEqual({
			AND: [
				{ OR: [{ pairingCodeHash: null }, { pairingCodeExpiresAt: null }, { pairingCodeExpiresAt: { lt: NOW } }] },
				{ pairedAt: { not: null } },
				{ apiKey: { is: { revokedAt: null } } },
			],
		});
	});
});
