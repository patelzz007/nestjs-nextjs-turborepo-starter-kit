import type { TenantTerminal as TenantTerminalRow, Prisma } from "@prisma/client";
import { epochMs, type EpochMs } from "@workspace/shared";

import { isUniqueViolationOf } from "../../../../platform/infrastructure/persistence/unique-violation";
import { TenantTerminal, type TerminalPairingCode } from "../../domain/aggregates/tenant-terminal.aggregate";
import { TerminalIdTakenError } from "../../domain/errors/pos.errors";
import type { TenantTerminalRepository } from "../../domain/repositories/pos.repositories";

/** The partial unique index on `(tenant_id, terminal_id)` among live terminals. */
export const LIVE_TERMINAL_ID_INDEX = "TenantTerminal_tenantId_terminalId_key";

/** A loaded terminal was added, one was saved with nothing to write, or its row vanished under the lock: a programming error. */
export class TerminalNotSavedError extends Error {
	public constructor(terminalRowId: string) {
		super(`Terminal ${terminalRowId} was not written`);
		this.name = "TerminalNotSavedError";
	}
}

function pairingCodeOf(row: TenantTerminalRow): TerminalPairingCode | null {
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

function toTerminal(row: TenantTerminalRow): TenantTerminal {
	return TenantTerminal.rehydrate({
		id: row.id,
		tenantId: row.tenantId,
		locationId: row.locationId,
		terminalId: row.terminalId,
		label: row.label,
		apiKeyId: row.apiKeyId,
		pairingCode: pairingCodeOf(row),
		pairedAt: row.pairedAt === null ? null : epochMs(Number(row.pairedAt)),
	});
}

/** POS terminals (`TenantTerminal`) on one unit-of-work transaction. */
export class PrismaTenantTerminalRepository implements TenantTerminalRepository {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async add(terminal: TenantTerminal): Promise<void> {
		const state = terminal.snapshot();
		const code = state.pairingCode;
		const createdByUserId = terminal.registrant;
		if (createdByUserId === null) {
			throw new TerminalNotSavedError(terminal.id);
		}
		try {
			await this.db.tenantTerminal.create({
				data: {
					id: state.id,
					tenantId: state.tenantId,
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

	public async terminalIdExists(tenantId: string, terminalId: string): Promise<boolean> {
		// Soft-deleted rows count too, so a generated id never reuses a retired till's id (its sales keep
		// pointing at one till). The (tenant, terminal id) unique index itself covers live rows only.
		return (await this.db.tenantTerminal.count({ where: { tenantId, terminalId } })) > 0;
	}

	public async lockLive(id: string, tenantId: string): Promise<TenantTerminal | null> {
		await this.db.$queryRaw`SELECT id FROM "TenantTerminal" WHERE id = ${id} AND "tenantId" = ${tenantId} AND "isDeleted" = false FOR UPDATE`;
		const row = await this.db.tenantTerminal.findFirst({ where: { id, tenantId, isDeleted: false } });
		return row === null ? null : toTerminal(row);
	}

	public async consumePairingCode(codeHashes: readonly string[], now: EpochMs): Promise<TenantTerminal | null> {
		const row = await this.db.tenantTerminal.findFirst({ where: { pairingCodeHash: { in: [...codeHashes] } } });
		if (row === null || row.isDeleted || row.pairingCodeExpiresAt === null || Number(row.pairingCodeExpiresAt) < now) {
			return null;
		}
		const consumed = await this.db.tenantTerminal.updateMany({
			where: { id: row.id, pairingCodeHash: row.pairingCodeHash, isDeleted: false },
			data: { pairingCodeHash: null, pairingCodeExpiresAt: null },
		});
		return consumed.count === 1 ? toTerminal(row) : null;
	}

	public async save(terminal: TenantTerminal): Promise<void> {
		const change = terminal.pendingChange;
		if (change === null) {
			throw new TerminalNotSavedError(terminal.id);
		}
		const where: Prisma.TenantTerminalWhereInput = { id: terminal.id, isDeleted: false };
		const data: Prisma.TenantTerminalUncheckedUpdateManyInput = ((): Prisma.TenantTerminalUncheckedUpdateManyInput => {
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
		const updated = await this.db.tenantTerminal.updateMany({ where, data });
		if (updated.count !== 1) {
			throw new TerminalNotSavedError(terminal.id);
		}
	}
}
