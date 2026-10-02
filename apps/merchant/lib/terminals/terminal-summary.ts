import type { MerchantTerminalSummary, PosTerminalStatus } from "@workspace/shared";

/** Headline numbers for the POS terminals page — computed from the terminals the page loaded. */
export interface TerminalStats {
	readonly active: number;
	readonly awaitingPairing: number;
	readonly unpaired: number;
	/** Distinct stores with at least one active (paired) terminal. */
	readonly storesCovered: number;
}

/** Colour family of a status badge — always rendered next to its text label, never alone. */
export type TerminalStatusTone = "success" | "warning" | "muted";

export interface TerminalStatusPresentation {
	readonly label: string;
	readonly tone: TerminalStatusTone;
}

const TERMINAL_STATUS_PRESENTATION: Readonly<Record<PosTerminalStatus, TerminalStatusPresentation>> = {
	ACTIVE: { label: "Active", tone: "success" },
	AWAITING_PAIRING: { label: "Awaiting pairing", tone: "warning" },
	UNPAIRED: { label: "Not paired", tone: "muted" },
};

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
/** Clock fields are always two digits (`04:09`). */
const CLOCK_FIELD_WIDTH = 2;
/** Pairing codes are shown as two groups of four (`ABCD 2345`) — easier to read out and type. */
const PAIRING_CODE_GROUP_SIZE = 4;

export function summarizeTerminals(terminals: readonly MerchantTerminalSummary[]): TerminalStats {
	const active = terminals.filter((terminal) => terminal.status === "ACTIVE");
	return {
		active: active.length,
		awaitingPairing: terminals.filter((terminal) => terminal.status === "AWAITING_PAIRING").length,
		unpaired: terminals.filter((terminal) => terminal.status === "UNPAIRED").length,
		storesCovered: new Set(active.map((terminal) => terminal.locationId)).size,
	};
}

export function describeTerminalStatus(status: PosTerminalStatus): TerminalStatusPresentation {
	return TERMINAL_STATUS_PRESENTATION[status];
}

/** A paired till gets "Re-pair" (its current key is replaced); any other till simply gets a new code. */
export function pairingActionLabel(status: PosTerminalStatus): string {
	return status === "ACTIVE" ? "Re-pair" : "New pairing code";
}

/** Re-pairing an active till replaces its key once the new code is used — the merchant confirms that first. */
export function requiresRepairConfirmation(status: PosTerminalStatus): boolean {
	return status === "ACTIVE";
}

/** `ABCD2345` → `ABCD 2345` for display. Copy always uses the raw code. */
export function groupPairingCode(code: string): string {
	const groups: string[] = [];
	for (let index = 0; index < code.length; index += PAIRING_CODE_GROUP_SIZE) {
		groups.push(code.slice(index, index + PAIRING_CODE_GROUP_SIZE));
	}
	return groups.join(" ");
}

/** Whole seconds from `nowEpochMs` until `expiresAtEpochMs` (rounded up, never negative). */
export function secondsUntil(expiresAtEpochMs: number, nowEpochMs: number): number {
	return Math.max(0, Math.ceil((expiresAtEpochMs - nowEpochMs) / MS_PER_SECOND));
}

/** `899` → `14:59`. Negative input reads as `00:00`. */
export function formatSecondsLeft(totalSeconds: number): string {
	const safe = Math.max(0, Math.floor(totalSeconds));
	const minutes = Math.floor(safe / SECONDS_PER_MINUTE);
	const seconds = safe % SECONDS_PER_MINUTE;
	return `${String(minutes).padStart(CLOCK_FIELD_WIDTH, "0")}:${String(seconds).padStart(CLOCK_FIELD_WIDTH, "0")}`;
}

/**
 * Whether the till that received `issued`'s code has paired: the terminal is
 * `ACTIVE` with a pairing newer than the one it had when the code was issued
 * (a re-paired till is already `ACTIVE` with its old key, so status alone is not enough).
 */
export function isPairingComplete(issued: MerchantTerminalSummary, current: MerchantTerminalSummary | undefined): boolean {
	if (current?.status !== "ACTIVE" || current.pairedAt === null) {
		return false;
	}
	return issued.pairedAt === null || current.pairedAt > issued.pairedAt;
}
