import { Injectable } from "@nestjs/common";
import type { Prisma, PrismaClient } from "@prisma/client";

import { merchantTerminalListQuery, type MerchantTerminalListQuery, type MerchantTerminalListSortField } from "@workspace/shared";

import { fetchListPage } from "../../../platform/persistence/list-page";
import { timestampIdKeyset, type ListKeyset } from "../../../platform/persistence/list-query/keyset-cursor";
import { buildListOrder, type ListOrder, type SortColumns } from "../../../platform/persistence/list-query/list-order";
import type { RepositoryListResult } from "../../../platform/persistence/types";
import { PrismaService } from "../../../prisma/prisma.service";
import type { MerchantLocationScope } from "../types/merchant-location-scope";
import { locationIdInFilter } from "../utils/merchant-location-scope.util";
import { terminalStatusWhere } from "../utils/pos-terminal.util";

export type MerchantTerminalDbClient = Pick<PrismaClient, "organizationTerminal" | "organizationMerchantProfile">;

/** A transaction client that can also take row locks. */
export type MerchantTerminalLockingClient = MerchantTerminalDbClient & Pick<PrismaClient, "$queryRaw">;

const TERMINAL_INCLUDE = {
	location: { select: { name: true } },
	apiKey: { select: { revokedAt: true } },
} satisfies Prisma.OrganizationTerminalInclude;

export type OrganizationTerminalRow = Prisma.OrganizationTerminalGetPayload<{ include: typeof TERMINAL_INCLUDE }>;

const PAIRING_INCLUDE = {
	location: { select: { name: true } },
	organization: { select: { slug: true, displayName: true, lifecycleState: true, isDeleted: true } },
} satisfies Prisma.OrganizationTerminalInclude;

/** A terminal whose pairing code was just consumed — everything the pairing response and the new key need. */
export type PairingTerminalRow = Prisma.OrganizationTerminalGetPayload<{ include: typeof PAIRING_INCLUDE }>;

// ── List query → Prisma (explicit field → column mapping; see docs/technical/api/list-queries.md) ──

const TERMINAL_SORT_COLUMNS: SortColumns<MerchantTerminalListSortField, Prisma.OrganizationTerminalOrderByWithRelationInput> = {
	createdAt: (direction) => ({ createdAt: direction }),
	name: (direction) => ({ label: direction }),
};

/** Keyset for the default order (`createdAt desc, id desc`). */
const TERMINAL_LIST_KEYSET: ListKeyset<OrganizationTerminalRow, Prisma.OrganizationTerminalWhereInput> = timestampIdKeyset(
	(row: OrganizationTerminalRow) => ({ at: Number(row.createdAt), id: row.id }),
	({ at, id }): Prisma.OrganizationTerminalWhereInput => ({ OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: id } }] }),
);

/** The organization's live terminals within the caller's stores. Both scopes come from the service, never raw input. */
export function buildTerminalListWhere(organizationId: string, scope: MerchantLocationScope): Prisma.OrganizationTerminalWhereInput {
	const locationFilter = locationIdInFilter(scope);
	return { AND: [{ organizationId, isDeleted: false }, ...(locationFilter !== undefined ? [{ locationId: locationFilter }] : [])] };
}

export function buildTerminalListOrder(query: MerchantTerminalListQuery): ListOrder<Prisma.OrganizationTerminalOrderByWithRelationInput> {
	return buildListOrder(merchantTerminalListQuery.resolveSort(query.sort), {
		columns: TERMINAL_SORT_COLUMNS,
		tieBreaker: (direction) => ({ id: direction }),
	});
}

/** Live terminal counts for the status summary; `UNPAIRED` = `total − awaitingPairing − active`. */
export interface TerminalStatusCounts {
	readonly total: number;
	readonly awaitingPairing: number;
	readonly active: number;
	readonly storesWithTerminals: number;
}

export interface CreateTerminalInput {
	readonly organizationId: string;
	readonly locationId: string;
	readonly terminalId: string;
	readonly name: string;
	readonly createdByUserId: string;
	readonly pairingCodeHash: string;
	readonly pairingCodeExpiresAt: number;
	readonly pairingCodeIssuedAt: number;
}

@Injectable()
export class MerchantTerminalRepository {
	public constructor(private readonly prisma: PrismaService) {}

	/** One page of the organization's live terminals within the AUTHORIZED store scope. */
	public async listByOrgId(
		organizationId: string,
		scope: MerchantLocationScope,
		query: MerchantTerminalListQuery,
		db: MerchantTerminalDbClient,
	): Promise<RepositoryListResult<OrganizationTerminalRow>> {
		return fetchListPage(query, {
			where: buildTerminalListWhere(organizationId, scope),
			order: buildTerminalListOrder(query),
			keyset: TERMINAL_LIST_KEYSET,
			and: (left, right) => ({ AND: [left, right] }),
			count: (where) => db.organizationTerminal.count({ where }),
			findMany: (args): Promise<OrganizationTerminalRow[]> => db.organizationTerminal.findMany({ ...args, include: TERMINAL_INCLUDE }),
		});
	}

	/**
	 * Live terminals within the AUTHORIZED store scope, counted per derived status by the database
	 * (`terminalStatusWhere`), plus how many stores have at least one live terminal.
	 */
	public async countStatusSummary(organizationId: string, scope: MerchantLocationScope, now: number, db: MerchantTerminalDbClient): Promise<TerminalStatusCounts> {
		const live = buildTerminalListWhere(organizationId, scope);
		const [total, awaitingPairing, active, stores] = await Promise.all([
			db.organizationTerminal.count({ where: live }),
			db.organizationTerminal.count({ where: { AND: [live, terminalStatusWhere("AWAITING_PAIRING", now)] } }),
			db.organizationTerminal.count({ where: { AND: [live, terminalStatusWhere("ACTIVE", now)] } }),
			db.organizationTerminal.groupBy({ by: ["locationId"], where: live }),
		]);
		return { total, awaitingPairing, active, storesWithTerminals: stores.length };
	}

	public async terminalIdExists(organizationId: string, terminalId: string, db: MerchantTerminalDbClient): Promise<boolean> {
		// Soft-deleted rows count too, so a generated id never reuses a retired till's id (its sales keep
		// pointing at one till). The (organization, terminal id) unique index itself covers live rows only.
		const existing = await db.organizationTerminal.findFirst({ where: { organizationId, terminalId }, select: { id: true } });
		return existing !== null;
	}

	public async create(input: CreateTerminalInput, db: MerchantTerminalDbClient): Promise<OrganizationTerminalRow> {
		return db.organizationTerminal.create({
			data: {
				organizationId: input.organizationId,
				locationId: input.locationId,
				terminalId: input.terminalId,
				label: input.name,
				createdByUserId: input.createdByUserId,
				pairingCodeHash: input.pairingCodeHash,
				pairingCodeExpiresAt: input.pairingCodeExpiresAt,
				// The registering member issues the first code.
				pairingCodeIssuedByUserId: input.createdByUserId,
				pairingCodeIssuedAt: input.pairingCodeIssuedAt,
			},
			include: TERMINAL_INCLUDE,
		});
	}

	public async findLiveByIdAndOrg(id: string, organizationId: string, db: MerchantTerminalDbClient): Promise<OrganizationTerminalRow | null> {
		return db.organizationTerminal.findFirst({ where: { id, organizationId, isDeleted: false }, include: TERMINAL_INCLUDE });
	}

	/**
	 * The live terminal, read after taking its row lock (`SELECT … FOR UPDATE`) for the rest of the
	 * caller's transaction. A concurrent pairing (which updates the same row) either finished first —
	 * and the row read here already carries its new key — or waits until this transaction commits and
	 * then finds the terminal deleted.
	 */
	public async findLiveByIdAndOrgForUpdate(id: string, organizationId: string, db: MerchantTerminalLockingClient): Promise<OrganizationTerminalRow | null> {
		await db.$queryRaw`SELECT id FROM organization_terminals WHERE id = ${id} AND organization_id = ${organizationId} AND is_deleted = false FOR UPDATE`;
		return this.findLiveByIdAndOrg(id, organizationId, db);
	}

	/**
	 * Issues a fresh code (replacing any live one) and records who issued it and when. The terminal's
	 * creator is immutable and never rewritten here: the issuer is a separate fact (it becomes the
	 * creator of the API key minted when this code is used).
	 */
	public async setPairingCode(
		id: string,
		input: { readonly pairingCodeHash: string; readonly pairingCodeExpiresAt: number; readonly issuedByUserId: string; readonly issuedAt: number },
		db: MerchantTerminalDbClient,
	): Promise<OrganizationTerminalRow> {
		return db.organizationTerminal.update({
			where: { id },
			data: {
				pairingCodeHash: input.pairingCodeHash,
				pairingCodeExpiresAt: input.pairingCodeExpiresAt,
				pairingCodeIssuedByUserId: input.issuedByUserId,
				pairingCodeIssuedAt: input.issuedAt,
			},
			include: TERMINAL_INCLUDE,
		});
	}

	public async softDelete(id: string, deletedBy: string, deletedAt: number, db: MerchantTerminalDbClient): Promise<void> {
		await db.organizationTerminal.update({
			where: { id },
			data: { isDeleted: true, deletedAt, deletedBy, pairingCodeHash: null, pairingCodeExpiresAt: null },
		});
	}

	/**
	 * Consumes a live pairing code exactly once. The conditional update makes a
	 * concurrent second use of the same code find nothing (`null`), so only one
	 * till can ever pair with it.
	 */
	public async consumePairingCode(pairingCodeHashes: readonly string[], now: number, db: MerchantTerminalDbClient): Promise<PairingTerminalRow | null> {
		const terminal = await db.organizationTerminal.findFirst({ where: { pairingCodeHash: { in: [...pairingCodeHashes] } }, include: PAIRING_INCLUDE });
		if (terminal === null || terminal.isDeleted || terminal.pairingCodeExpiresAt === null || Number(terminal.pairingCodeExpiresAt) < now) {
			return null;
		}
		const consumed = await db.organizationTerminal.updateMany({
			where: { id: terminal.id, pairingCodeHash: terminal.pairingCodeHash, isDeleted: false },
			data: { pairingCodeHash: null, pairingCodeExpiresAt: null },
		});
		return consumed.count === 1 ? terminal : null;
	}

	/** A live terminal of the organization by the id the till sends (`X-Terminal-Id`). */
	public async findLiveByTerminalId(organizationId: string, terminalId: string): Promise<{ readonly id: string; readonly locationId: string } | null> {
		return this.prisma.organizationTerminal.findFirst({ where: { organizationId, terminalId, isDeleted: false }, select: { id: true, locationId: true } });
	}

	/** Records that a registered till just called the POS API. */
	public async touchLastSeen(id: string, lastSeenAt: number): Promise<void> {
		await this.prisma.organizationTerminal.update({ where: { id }, data: { lastSeenAt } });
	}

	public async bindApiKey(id: string, apiKeyId: string, pairedAt: number, db: MerchantTerminalDbClient): Promise<void> {
		await db.organizationTerminal.update({ where: { id }, data: { apiKeyId, pairedAt } });
	}

	public async getRequireRegisteredTerminals(organizationId: string, db: MerchantTerminalDbClient): Promise<boolean | null> {
		const profile = await db.organizationMerchantProfile.findUnique({ where: { organizationId }, select: { requireRegisteredTerminals: true } });
		return profile?.requireRegisteredTerminals ?? null;
	}

	public async setRequireRegisteredTerminals(organizationId: string, requireRegisteredTerminals: boolean, db: MerchantTerminalDbClient): Promise<number> {
		const updated = await db.organizationMerchantProfile.updateMany({ where: { organizationId }, data: { requireRegisteredTerminals } });
		return updated.count;
	}
}
