import { describe, expect, it } from "vitest";

import {
	describeTerminalStatus,
	formatSecondsLeft,
	groupPairingCode,
	isPairingComplete,
	pairingActionLabel,
	requiresRepairConfirmation,
	secondsUntil,
	shouldKeepPollingPairing,
	summarizeTerminalPage,
	summarizeTerminals,
} from "@/lib/terminals/terminal-summary";
import { buildPairing, buildTerminal, STORE_A, STORE_B, TERMINAL_FIXTURE_NOW } from "@/test/terminals";

const ONE_MINUTE_MS = 60_000;

describe("summarizeTerminals", () => {
	it("counts terminals per status and the distinct stores with an active till", () => {
		const stats = summarizeTerminals([
			buildTerminal({ id: "00000000-0000-4000-8000-000000000001", status: "ACTIVE", pairedAt: TERMINAL_FIXTURE_NOW }),
			buildTerminal({ id: "00000000-0000-4000-8000-000000000002", status: "ACTIVE", pairedAt: TERMINAL_FIXTURE_NOW }),
			buildTerminal({ id: "00000000-0000-4000-8000-000000000003", status: "ACTIVE", pairedAt: TERMINAL_FIXTURE_NOW, locationId: STORE_B.id, locationName: STORE_B.name }),
			buildTerminal({ id: "00000000-0000-4000-8000-000000000004", status: "AWAITING_PAIRING", pairingCodeExpiresAt: TERMINAL_FIXTURE_NOW }),
			buildTerminal({ id: "00000000-0000-4000-8000-000000000005", status: "UNPAIRED", locationId: STORE_B.id }),
		]);

		expect(stats).toEqual({ active: 3, awaitingPairing: 1, unpaired: 1, storesCovered: 2 });
	});

	it("does not count a store whose only till is unpaired or awaiting pairing", () => {
		expect(summarizeTerminals([buildTerminal({ status: "AWAITING_PAIRING", locationId: STORE_A.id })]).storesCovered).toBe(0);
	});

	it("is all zero for no terminals", () => {
		expect(summarizeTerminals([])).toEqual({ active: 0, awaitingPairing: 0, unpaired: 0, storesCovered: 0 });
	});
});

describe("describeTerminalStatus", () => {
	it("gives every status a text label and a tone", () => {
		expect(describeTerminalStatus("ACTIVE")).toEqual({ label: "Active", tone: "success" });
		expect(describeTerminalStatus("AWAITING_PAIRING")).toEqual({ label: "Awaiting pairing", tone: "warning" });
		expect(describeTerminalStatus("UNPAIRED")).toEqual({ label: "Not paired", tone: "muted" });
	});
});

describe("pairing actions", () => {
	it("offers a re-pair (with confirmation) for an active till and a plain new code otherwise", () => {
		expect(pairingActionLabel("ACTIVE")).toBe("Re-pair");
		expect(requiresRepairConfirmation("ACTIVE")).toBe(true);
		expect(pairingActionLabel("AWAITING_PAIRING")).toBe("New pairing code");
		expect(requiresRepairConfirmation("AWAITING_PAIRING")).toBe(false);
		expect(pairingActionLabel("UNPAIRED")).toBe("New pairing code");
		expect(requiresRepairConfirmation("UNPAIRED")).toBe(false);
	});
});

describe("groupPairingCode", () => {
	it("splits an 8-character code into two groups of four", () => {
		expect(groupPairingCode("ABCD2345")).toBe("ABCD 2345");
	});

	it("leaves a short code as one group", () => {
		expect(groupPairingCode("ABC")).toBe("ABC");
		expect(groupPairingCode("")).toBe("");
	});
});

describe("secondsUntil", () => {
	it("rounds partial seconds up so the countdown never shows 00:00 while the code still works", () => {
		expect(secondsUntil(TERMINAL_FIXTURE_NOW + 1_500, TERMINAL_FIXTURE_NOW)).toBe(2);
		expect(secondsUntil(TERMINAL_FIXTURE_NOW + ONE_MINUTE_MS, TERMINAL_FIXTURE_NOW)).toBe(60);
	});

	it("is zero once the moment has passed", () => {
		expect(secondsUntil(TERMINAL_FIXTURE_NOW, TERMINAL_FIXTURE_NOW)).toBe(0);
		expect(secondsUntil(TERMINAL_FIXTURE_NOW - ONE_MINUTE_MS, TERMINAL_FIXTURE_NOW)).toBe(0);
	});
});

describe("formatSecondsLeft", () => {
	it("formats minutes and seconds as a two-digit clock", () => {
		expect(formatSecondsLeft(899)).toBe("14:59");
		expect(formatSecondsLeft(65)).toBe("01:05");
		expect(formatSecondsLeft(0)).toBe("00:00");
	});

	it("never shows a negative time", () => {
		expect(formatSecondsLeft(-5)).toBe("00:00");
	});
});

describe("isPairingComplete", () => {
	const issuedFresh = buildTerminal({ status: "AWAITING_PAIRING", pairingCodeExpiresAt: TERMINAL_FIXTURE_NOW + ONE_MINUTE_MS });

	it("is true once a never-paired till turns active", () => {
		expect(isPairingComplete(issuedFresh, buildTerminal({ status: "ACTIVE", pairedAt: TERMINAL_FIXTURE_NOW }))).toBe(true);
	});

	it("is false while the till is still waiting, or when it is missing from the list", () => {
		expect(isPairingComplete(issuedFresh, issuedFresh)).toBe(false);
		expect(isPairingComplete(issuedFresh, undefined)).toBe(false);
	});

	it("waits for a newer pairing when an active till is re-paired", () => {
		const issuedRepair = buildTerminal({ status: "ACTIVE", pairedAt: TERMINAL_FIXTURE_NOW });

		expect(isPairingComplete(issuedRepair, issuedRepair)).toBe(false);
		expect(isPairingComplete(issuedRepair, buildTerminal({ status: "ACTIVE", pairedAt: TERMINAL_FIXTURE_NOW + ONE_MINUTE_MS }))).toBe(true);
	});
});

describe("summarizeTerminalPage", () => {
	const page = [buildTerminal({ status: "ACTIVE", pairedAt: TERMINAL_FIXTURE_NOW })];

	it("is exact when the page holds every terminal of the filter", () => {
		expect(summarizeTerminalPage(page, 1)).toEqual({ kind: "exact", stats: summarizeTerminals(page) });
	});

	it("is unavailable instead of a page-sized undercount when more terminals exist", () => {
		expect(summarizeTerminalPage(page, 140)).toEqual({ kind: "unavailable" });
	});
});

describe("shouldKeepPollingPairing", () => {
	const waiting = buildTerminal({ status: "AWAITING_PAIRING", pairingCodeExpiresAt: TERMINAL_FIXTURE_NOW + ONE_MINUTE_MS });
	const issued = buildPairing(waiting);
	const beforeExpiry = issued.pairingCodeExpiresAt - ONE_MINUTE_MS;

	it("polls until the first answer and while the till has not paired", () => {
		expect(shouldKeepPollingPairing(issued, { terminals: undefined }, beforeExpiry)).toBe(true);
		expect(shouldKeepPollingPairing(issued, { terminals: [waiting] }, beforeExpiry)).toBe(true);
	});

	it("stops once the till paired", () => {
		const paired = buildTerminal({ status: "ACTIVE", pairedAt: TERMINAL_FIXTURE_NOW });
		expect(shouldKeepPollingPairing(issued, { terminals: [paired] }, beforeExpiry)).toBe(false);
	});

	it("stops once the code expired", () => {
		expect(shouldKeepPollingPairing(issued, { terminals: [waiting] }, issued.pairingCodeExpiresAt)).toBe(false);
	});

	it("stops when the terminal is not on the polled page (removed, or beyond the first page)", () => {
		expect(shouldKeepPollingPairing(issued, { terminals: [] }, beforeExpiry)).toBe(false);
	});
});
