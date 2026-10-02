import {
	MerchantTerminalPairingSchema,
	MerchantTerminalSummarySchema,
	POS_PAIRING_CODE_TTL_MS,
	type MerchantTerminalPairing,
	type MerchantTerminalSummary,
	type PosTerminalStatus,
} from "@workspace/shared";

/** Fixed clock for terminal fixtures (2026-10-01T00:00:00Z). */
export const TERMINAL_FIXTURE_NOW = 1_790_812_800_000;

export const STORE_A = { id: "0f0f0f0f-0000-4000-8000-00000000000a", name: "Bangsar" };
export const STORE_B = { id: "0f0f0f0f-0000-4000-8000-00000000000b", name: "Mont Kiara" };

/** Every field a test may override, as plain (unbranded) values. */
export interface TerminalFixtureOverrides {
	readonly id?: string;
	readonly terminalId?: string;
	readonly name?: string;
	readonly locationId?: string;
	readonly locationName?: string;
	readonly status?: PosTerminalStatus;
	readonly pairingCodeExpiresAt?: number | null;
	readonly pairedAt?: number | null;
	readonly lastSeenAt?: number | null;
}

/** A terminal parsed through the shared contract — defaults to an unpaired till at store A. */
export function buildTerminal(overrides: TerminalFixtureOverrides = {}): MerchantTerminalSummary {
	return MerchantTerminalSummarySchema.parse({
		id: "4d9a3f5e-2f6b-4c55-8f0c-9a4b1c2d3e4f",
		terminalId: "TERM-7F3K9QX2",
		name: "Front counter",
		locationId: STORE_A.id,
		locationName: STORE_A.name,
		status: "UNPAIRED",
		pairingCodeExpiresAt: null,
		pairedAt: null,
		lastSeenAt: null,
		createdAt: TERMINAL_FIXTURE_NOW,
		updatedAt: TERMINAL_FIXTURE_NOW,
		isDeleted: false,
		deletedAt: null,
		...overrides,
	});
}

/** The create / new-code response for `terminal`, with a code that expires after the standard TTL. */
export function buildPairing(terminal: MerchantTerminalSummary, pairingCode = "ABCD2345"): MerchantTerminalPairing {
	const pairingCodeExpiresAt = TERMINAL_FIXTURE_NOW + POS_PAIRING_CODE_TTL_MS;
	return MerchantTerminalPairingSchema.parse({
		terminal: { ...terminal, status: "AWAITING_PAIRING", pairingCodeExpiresAt },
		pairingCode,
		pairingCodeExpiresAt,
	});
}
