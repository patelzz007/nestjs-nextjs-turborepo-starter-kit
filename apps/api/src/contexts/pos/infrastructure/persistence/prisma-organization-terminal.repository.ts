import type { OrganizationTerminal as OrganizationTerminalRow, Prisma } from "@prisma/client";
import { epochMs, type EpochMs } from "@workspace/shared";

import { isUniqueViolationOf } from "../../../../platform/infrastructure/persistence/unique-violation";
import { OrganizationTerminal, type TerminalPairingCode } from "../../domain/aggregates/organization-terminal.aggregate";
import { TerminalIdTakenError } from "../../domain/errors/pos.errors";
import type { OrganizationTerminalRepository } from "../../domain/repositories/pos.repositories";

/** The partial unique index on `(organization_id, terminal_id)` among live terminals. */
export const LIVE_TERMINAL_ID_INDEX = "OrganizationTerminal_organizationId_terminalId_key";

/** A loaded terminal was added, one was saved with nothing to write, or its row vanished under the lock: a programming error. */
export class TerminalNotSavedError extends Error {
	public constructor(terminalRowId: string) {
		super(`Terminal ${terminalRowId} was not written`);
		this.name = "TerminalNotSavedError";
	}
}

function pairingCodeOf(row: OrganizationTerminalRow): TerminalPairingCode | null {
	if (row.pairingCodeHash === null || row.pairingCodeExpiresAt === null) {
		return null;
	}
	return {
		hash: row.pairingCodeHash,
		expiresAt: epochMs(Number(row.pairingCodeExpiresAt)),
		issuedByUserId: row.pairingCodeIssuedByUserId,
		issuedAt: row.pairingCodeIssuedAt === null ? null : epochMs(Number(row.pairingCodeIssuedAt)),
	};
}

function toTerminal(row: OrganizationTerminalRow): OrganizationTerminal {
	return OrganizationTerminal.rehydrate({
		id: row.id,
		organizationId: row.organizationId,
		locationId: row.locationId,
		terminalId: row.terminalId,
		label: row.label,
		apiKeyId: row.apiKeyId,
		pairingCode: pairingCodeOf(row),
		pairedAt: row.pairedAt === null ? null : epochMs(Number(row.pairedAt)),
	});
}

/** POS terminals (`OrganizationTerminal`) on one unit-of-work transaction. */
export class PrismaOrganizationTerminalRepository implements OrganizationTerminalRepository {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async add(terminal: OrganizationTerminal): Promise<void> {
		const state = terminal.snapshot();
		const code = state.pairingCode;
		const createdByUserId = terminal.registrant;
		if (createdByUserId === null) {
			throw new TerminalNotSavedError(terminal.id);
		}
		try {
			await this.db.organizationTerminal.create({
				data: {
					id: state.id,
					organizationId: state.organizationId,
					locationId: state.locationId,
					terminalId: state.terminalId,
					label: state.label,
					createdByUserId,
					pairingCodeHash: code?.hash ?? null,
					pairingCodeExpiresAt: code?.expiresAt ?? null,
					pairingCodeIssuedByUserId: code?.issuedByUserId ?? null,
					pairingCodeIssuedAt: code?.issuedAt ?? null,
				},
				select: { id: true },
			});
		} catch (error) {
			if (error instanceof Error && isUniqueViolationOf(error, LIVE_TERMINAL_ID_INDEX)) {
				throw new TerminalIdTakenError();
			}
			throw error;
		}
	}

	public async terminalIdExists(organizationId: string, terminalId: string): Promise<boolean> {
		// Soft-deleted rows count too, so a generated id never reuses a retired till's id (its sales keep
		// pointing at one till). The (organization, terminal id) unique index itself covers live rows only.
		return (await this.db.organizationTerminal.count({ where: { organizationId, terminalId } })) > 0;
	}

	public async lockLive(id: string, organizationId: string): Promise<OrganizationTerminal | null> {
		await this.db.$queryRaw`SELECT id FROM "OrganizationTerminal" WHERE id = ${id} AND "organizationId" = ${organizationId} AND "isDeleted" = false FOR UPDATE`;
		const row = await this.db.organizationTerminal.findFirst({ where: { id, organizationId, isDeleted: false } });
		return row === null ? null : toTerminal(row);
	}

	public async consumePairingCode(codeHashes: readonly string[], now: EpochMs): Promise<OrganizationTerminal | null> {
		const row = await this.db.organizationTerminal.findFirst({ where: { pairingCodeHash: { in: [...codeHashes] } } });
		if (row === null || row.isDeleted || row.pairingCodeExpiresAt === null || Number(row.pairingCodeExpiresAt) < now) {
			return null;
		}
		const consumed = await this.db.organizationTerminal.updateMany({
			where: { id: row.id, pairingCodeHash: row.pairingCodeHash, isDeleted: false },
			data: { pairingCodeHash: null, pairingCodeExpiresAt: null },
		});
		return consumed.count === 1 ? toTerminal(row) : null;
	}

	public async save(terminal: OrganizationTerminal): Promise<void> {
		const change = terminal.pendingChange;
		if (change === null) {
			throw new TerminalNotSavedError(terminal.id);
		}
		const where: Prisma.OrganizationTerminalWhereInput = { id: terminal.id, isDeleted: false };
		const data: Prisma.OrganizationTerminalUncheckedUpdateManyInput = ((): Prisma.OrganizationTerminalUncheckedUpdateManyInput => {
			switch (change.kind) {
				case "pairing_code_issued":
					return {
						pairingCodeHash: change.code.hash,
						pairingCodeExpiresAt: change.code.expiresAt,
						pairingCodeIssuedByUserId: change.code.issuedByUserId,
						pairingCodeIssuedAt: change.code.issuedAt,
						updatedAt: change.code.issuedAt,
					};
				case "removed":
					return {
						isDeleted: true,
						deletedAt: change.removedAt,
						deletedBy: change.removedByUserId,
						pairingCodeHash: null,
						pairingCodeExpiresAt: null,
						updatedAt: change.removedAt,
					};
				case "paired":
					return { apiKeyId: change.apiKeyId, pairedAt: change.pairedAt, updatedAt: change.pairedAt };
			}
		})();
		const updated = await this.db.organizationTerminal.updateMany({ where, data });
		if (updated.count !== 1) {
			throw new TerminalNotSavedError(terminal.id);
		}
	}
}
