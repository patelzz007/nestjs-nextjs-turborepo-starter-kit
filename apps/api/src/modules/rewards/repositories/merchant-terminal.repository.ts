import { Injectable } from "@nestjs/common";
import type { Prisma, PrismaClient } from "@prisma/client";

import { merchantTerminalListQuery, type MerchantTerminalListQuery, type MerchantTerminalListSortField } from "@workspace/shared";

import { fetchListPage } from "../../../platform/persistence/list-page";
import { timestampIdKeyset, type ListKeyset } from "../../../platform/persistence/list-query/keyset-cursor";
import { buildListOrder, type ListOrder, type SortColumns } from "../../../platform/persistence/list-query/list-order";
import type { RepositoryListResult } from "../../../platform/persistence/types";
import { PrismaService } from "../../../prisma/prisma.service";

export type MerchantTerminalDbClient = Pick<PrismaClient, "organizationTerminal" | "organizationMerchantProfile">;

const TERMINAL_INCLUDE = {
	location: { select: { name: true } },
	apiKey: { select: { revokedAt: true } },
} satisfies Prisma.OrganizationTerminalInclude;

export type OrganizationTerminalRow = Prisma.OrganizationTerminalGetPayload<{ include: typeof TERMINAL_INCLUDE }>;

const PAIRING_INCLUDE = {
	location: { select: { name: true } },
	organization: { select: { slug: true, displayName: true } },
} satisfies Prisma.OrganizationTerminalInclude;

/** A terminal whose pairing code was just consumed — everything the pairing response and the new key need. */
export type PairingTerminalRow = Prisma.OrganizationTerminalGetPayload<{ include: typeof PAIRING_INCLUDE }>;

// ── List query → Prisma (explicit field → column mapping; see docs/list-queries.md) ──

const TERMINAL_SORT_COLUMNS: SortColumns<MerchantTerminalListSortField, Prisma.OrganizationTerminalOrderByWithRelationInput> = {
	createdAt: (direction) => ({ createdAt: direction }),
	name: (direction) => ({ label: direction }),
};

/** Keyset for the default order (`createdAt desc, id desc`). */
const TERMINAL_LIST_KEYSET: ListKeyset<OrganizationTerminalRow, Prisma.OrganizationTerminalWhereInput> = timestampIdKeyset(
	(row: OrganizationTerminalRow) => ({ at: Number(row.createdAt), id: row.id }),
	({ at, id }): Prisma.OrganizationTerminalWhereInput => ({ OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: id } }] }),
);

/** The organization's (optionally one store's) live terminals. Both scopes come from the service, never raw input. */
export function buildTerminalListWhere(organizationId: string, locationId: string | undefined): Prisma.OrganizationTerminalWhereInput {
	return { AND: [{ organizationId, isDeleted: false }, ...(locationId !== undefined ? [{ locationId }] : [])] };
}

export function buildTerminalListOrder(query: MerchantTerminalListQuery): ListOrder<Prisma.OrganizationTerminalOrderByWithRelationInput> {
	return buildListOrder(merchantTerminalListQuery.resolveSort(query.sort), {
		columns: TERMINAL_SORT_COLUMNS,
		tieBreaker: (direction) => ({ id: direction }),
	});
}

export interface CreateTerminalInput {
	readonly organizationId: string;
	readonly locationId: string;
	readonly terminalId: string;
	readonly name: string;
	readonly createdByUserId: string;
	readonly pairingCodeHash: string;
	readonly pairingCodeExpiresAt: number;
}

@Injectable()
export class MerchantTerminalRepository {
	public constructor(private readonly prisma: PrismaService) {}

	/** Runs `work` in one transaction (the pairing flow: consume code → mint key → bind). */
	public async transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
		return this.prisma.$transaction(work);
	}

	/** One page of the organization's live terminals; `locationId` is the AUTHORIZED store scope, or `undefined` for every store. */
	public async listByOrgId(
		organizationId: string,
		locationId: string | undefined,
		query: MerchantTerminalListQuery,
		db: MerchantTerminalDbClient,
	): Promise<RepositoryListResult<OrganizationTerminalRow>> {
		return fetchListPage(query, {
			where: buildTerminalListWhere(organizationId, locationId),
			order: buildTerminalListOrder(query),
			keyset: TERMINAL_LIST_KEYSET,
			and: (left, right) => ({ AND: [left, right] }),
			count: (where) => db.organizationTerminal.count({ where }),
			findMany: (args): Promise<OrganizationTerminalRow[]> => db.organizationTerminal.findMany({ ...args, include: TERMINAL_INCLUDE }),
		});
	}

	public async terminalIdExists(organizationId: string, terminalId: string, db: MerchantTerminalDbClient): Promise<boolean> {
		// Soft-deleted rows count too: the (organization, terminal id) unique index covers them.
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
			},
			include: TERMINAL_INCLUDE,
		});
	}

	public async findLiveByIdAndOrg(id: string, organizationId: string, db: MerchantTerminalDbClient): Promise<OrganizationTerminalRow | null> {
		return db.organizationTerminal.findFirst({ where: { id, organizationId, isDeleted: false }, include: TERMINAL_INCLUDE });
	}

	/** Issues a fresh code (replacing any live one). A seeded terminal with no creator is claimed by the member issuing the code. */
	public async setPairingCode(
		id: string,
		input: { readonly pairingCodeHash: string; readonly pairingCodeExpiresAt: number; readonly issuedByUserId: string; readonly createdByUserId: string | null },
		db: MerchantTerminalDbClient,
	): Promise<OrganizationTerminalRow> {
		return db.organizationTerminal.update({
			where: { id },
			data: {
				pairingCodeHash: input.pairingCodeHash,
				pairingCodeExpiresAt: input.pairingCodeExpiresAt,
				createdByUserId: input.createdByUserId ?? input.issuedByUserId,
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
	public async consumePairingCode(pairingCodeHash: string, now: number, db: MerchantTerminalDbClient): Promise<PairingTerminalRow | null> {
		const terminal = await db.organizationTerminal.findUnique({ where: { pairingCodeHash }, include: PAIRING_INCLUDE });
		if (terminal === null || terminal.isDeleted || terminal.pairingCodeExpiresAt === null || Number(terminal.pairingCodeExpiresAt) < now) {
			return null;
		}
		const consumed = await db.organizationTerminal.updateMany({
			where: { id: terminal.id, pairingCodeHash, isDeleted: false },
			data: { pairingCodeHash: null, pairingCodeExpiresAt: null },
		});
		return consumed.count === 1 ? terminal : null;
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
