import type { Prisma } from "@prisma/client";
import { epochMs, PosTerminalIdSchema, type EpochMs, type MerchantTerminalSummary } from "@workspace/shared";

import { terminalStatus } from "../../domain/policies/terminal-status.policy";

/** What a terminal summary reads: the row, its store's name and whether its key is revoked. */
export const TERMINAL_SUMMARY_INCLUDE = {
	location: { select: { name: true } },
	apiKey: { select: { revokedAt: true } },
} satisfies Prisma.OrganizationTerminalInclude;

export type TerminalSummaryRow = Prisma.OrganizationTerminalGetPayload<{ include: typeof TERMINAL_SUMMARY_INCLUDE }>;

function epochOrNull(value: bigint | null): EpochMs | null {
	return value === null ? null : epochMs(Number(value));
}

/** A terminal as the merchant console shows it; its status is derived at `now`, never stored. */
export function toTerminalSummary(row: TerminalSummaryRow, now: EpochMs): MerchantTerminalSummary {
	const pairingCodeExpiresAt = epochOrNull(row.pairingCodeExpiresAt);
	const status = terminalStatus(
		{ pairingCodeHash: row.pairingCodeHash, pairingCodeExpiresAt, pairedAt: epochOrNull(row.pairedAt), hasLiveApiKey: row.apiKey !== null && row.apiKey.revokedAt === null },
		now,
	);
	return {
		id: row.id,
		terminalId: PosTerminalIdSchema.parse(row.terminalId),
		name: row.label ?? row.terminalId,
		locationId: row.locationId,
		locationName: row.location.name,
		status,
		pairingCodeExpiresAt: status === "AWAITING_PAIRING" ? pairingCodeExpiresAt : null,
		pairedAt: epochOrNull(row.pairedAt),
		lastSeenAt: epochOrNull(row.lastSeenAt),
		createdAt: epochMs(Number(row.createdAt)),
		updatedAt: epochMs(Number(row.updatedAt)),
		isDeleted: row.isDeleted,
		deletedAt: epochOrNull(row.deletedAt),
	};
}

/**
 * The same status derivation as Prisma filters, so counts per status are computed by the database
 * instead of loading every terminal. `UNPAIRED` is the remainder (statuses partition the rows).
 */
export function terminalStatusWhere(status: "AWAITING_PAIRING" | "ACTIVE", now: EpochMs): Prisma.OrganizationTerminalWhereInput {
	const awaiting: Prisma.OrganizationTerminalWhereInput = { pairingCodeHash: { not: null }, pairingCodeExpiresAt: { gte: now } };
	if (status === "AWAITING_PAIRING") {
		return awaiting;
	}
	return {
		AND: [
			{ OR: [{ pairingCodeHash: null }, { pairingCodeExpiresAt: null }, { pairingCodeExpiresAt: { lt: now } }] },
			{ pairedAt: { not: null } },
			{ apiKey: { is: { revokedAt: null } } },
		],
	};
}
