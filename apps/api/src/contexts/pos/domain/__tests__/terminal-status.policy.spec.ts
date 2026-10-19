import { epochMs } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { terminalStatus, type TerminalStatusFacts } from "../policies/terminal-status.policy";
import { NOW } from "./pos-domain.fixture";

const UNPAIRED: TerminalStatusFacts = { pairingCodeHash: null, pairingCodeExpiresAt: null, pairedAt: null, hasLiveApiKey: false };

describe("terminalStatus", () => {
	it("is awaiting pairing while a code is live (even during a re-pair with a working key)", () => {
		expect(terminalStatus({ ...UNPAIRED, pairingCodeHash: "hash", pairingCodeExpiresAt: NOW }, NOW)).toBe("AWAITING_PAIRING");
		expect(terminalStatus({ pairingCodeHash: "hash", pairingCodeExpiresAt: epochMs(NOW + 1), pairedAt: NOW, hasLiveApiKey: true }, NOW)).toBe("AWAITING_PAIRING");
	});

	it("is active when paired with an unrevoked key and no live code", () => {
		expect(terminalStatus({ ...UNPAIRED, pairedAt: NOW, hasLiveApiKey: true }, NOW)).toBe("ACTIVE");
		expect(terminalStatus({ pairingCodeHash: "hash", pairingCodeExpiresAt: epochMs(NOW - 1), pairedAt: NOW, hasLiveApiKey: true }, NOW)).toBe("ACTIVE");
	});

	it("is unpaired otherwise (never paired, expired code, revoked key)", () => {
		expect(terminalStatus(UNPAIRED, NOW)).toBe("UNPAIRED");
		expect(terminalStatus({ ...UNPAIRED, pairingCodeHash: "hash", pairingCodeExpiresAt: epochMs(NOW - 1) }, NOW)).toBe("UNPAIRED");
		expect(terminalStatus({ ...UNPAIRED, pairedAt: NOW, hasLiveApiKey: false }, NOW)).toBe("UNPAIRED");
	});
});
