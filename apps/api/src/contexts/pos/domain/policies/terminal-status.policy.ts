import type { EpochMs, PosTerminalStatus } from "@workspace/shared";

/** The terminal fields its status is derived from. */
export interface TerminalStatusFacts {
	readonly pairingCodeHash: string | null;
	readonly pairingCodeExpiresAt: EpochMs | null;
	readonly pairedAt: EpochMs | null;
	/** Whether the terminal's bound key is unrevoked; false when it has none. */
	readonly hasLiveApiKey: boolean;
}

/**
 * Derived, never stored. A live code wins (a re-pair in progress shows as awaiting even while the old
 * key still works); otherwise a paired terminal whose key is unrevoked is active; everything else is
 * unpaired.
 */
export function terminalStatus(terminal: TerminalStatusFacts, now: EpochMs): PosTerminalStatus {
	if (terminal.pairingCodeHash !== null && terminal.pairingCodeExpiresAt !== null && terminal.pairingCodeExpiresAt >= now) {
		return "AWAITING_PAIRING";
	}
	if (terminal.pairedAt !== null && terminal.hasLiveApiKey) {
		return "ACTIVE";
	}
	return "UNPAIRED";
}
