import { EpochMsSchema, PosPairingCodeSchema, PosTerminalIdSchema, type MerchantTerminalSummary, type PosPairingCode, type PosTerminalStatus } from "@workspace/shared";

import type { OrganizationTerminalRow } from "../repositories/merchant-terminal.repository";
import { generateBackupCode } from "./reward-crypto.util";

/** Prefix of every generated terminal id (`TERM-7F3K9QX2`). */
const TERMINAL_ID_PREFIX = "TERM-";

/** A new terminal id: the prefix + 8 unambiguous characters (≈ 1.1 × 10¹² values per organization). */
export function generateTerminalId(): string {
	return PosTerminalIdSchema.parse(`${TERMINAL_ID_PREFIX}${generateBackupCode()}`);
}

/** A one-time pairing code: 8 characters from the backup-code alphabet (no 0/O/1/I). */
export function generatePairingCode(): PosPairingCode {
	return PosPairingCodeSchema.parse(generateBackupCode());
}

type TerminalStatusFields = Pick<OrganizationTerminalRow, "pairingCodeHash" | "pairingCodeExpiresAt" | "pairedAt" | "apiKey">;

/**
 * Derived, never stored. A live code wins (a re-pair in progress shows as
 * awaiting even while the old key still works); otherwise a paired terminal
 * whose key is unrevoked is active; everything else is unpaired.
 */
export function terminalStatus(terminal: TerminalStatusFields, now: number): PosTerminalStatus {
	if (terminal.pairingCodeHash !== null && terminal.pairingCodeExpiresAt !== null && Number(terminal.pairingCodeExpiresAt) >= now) {
		return "AWAITING_PAIRING";
	}
	if (terminal.pairedAt !== null && terminal.apiKey !== null && terminal.apiKey.revokedAt === null) {
		return "ACTIVE";
	}
	return "UNPAIRED";
}

function epochOrNull(value: bigint | null): MerchantTerminalSummary["pairedAt"] {
	return value === null ? null : EpochMsSchema.parse(Number(value));
}

export function toTerminalSummary(terminal: OrganizationTerminalRow, now: number): MerchantTerminalSummary {
	const status = terminalStatus(terminal, now);
	return {
		id: terminal.id,
		terminalId: PosTerminalIdSchema.parse(terminal.terminalId),
		name: terminal.label ?? terminal.terminalId,
		locationId: terminal.locationId,
		locationName: terminal.location.name,
		status,
		pairingCodeExpiresAt: status === "AWAITING_PAIRING" ? epochOrNull(terminal.pairingCodeExpiresAt) : null,
		pairedAt: epochOrNull(terminal.pairedAt),
		lastSeenAt: epochOrNull(terminal.lastSeenAt),
		createdAt: EpochMsSchema.parse(Number(terminal.createdAt)),
		updatedAt: EpochMsSchema.parse(Number(terminal.updatedAt)),
		isDeleted: terminal.isDeleted,
		deletedAt: epochOrNull(terminal.deletedAt),
	};
}
