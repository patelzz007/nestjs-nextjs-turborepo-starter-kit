import { Injectable } from "@nestjs/common";
import type { OrganizationApiKey, Prisma, PrismaClient } from "@prisma/client";

import { merchantApiKeyListQuery, type MerchantApiKeyListQuery, type MerchantApiKeyListSortField } from "@workspace/shared";

import { fetchListPage } from "../../../platform/persistence/list-page";
import { timestampIdKeyset, type ListKeyset } from "../../../platform/persistence/list-query/keyset-cursor";
import { buildListOrder, type ListOrder, type SortColumns } from "../../../platform/persistence/list-query/list-order";
import { fieldWhere, toPrismaNullableComparableFilter } from "../../../platform/persistence/list-query/prisma-filter";
import type { RepositoryListResult } from "../../../platform/persistence/types";
import { PrismaService } from "../../../prisma/prisma.service";

export type MerchantApiKeyDbClient = Pick<PrismaClient, "organizationApiKey">;

const API_KEY_LIST_INCLUDE = {
	location: { select: { name: true } },
} satisfies Prisma.OrganizationApiKeyInclude;

const VERIFIED_API_KEY_INCLUDE = {
	terminal: { select: { id: true, terminalId: true, locationId: true, isDeleted: true } },
	organization: { select: { merchantProfile: { select: { requireRegisteredTerminals: true } } } },
} satisfies Prisma.OrganizationApiKeyInclude;

export type VerifiedApiKeyRow = Prisma.OrganizationApiKeyGetPayload<{ include: typeof VERIFIED_API_KEY_INCLUDE }>;

export type OrganizationApiKeyListRow = Prisma.OrganizationApiKeyGetPayload<{ include: typeof API_KEY_LIST_INCLUDE }>;

// ── List query → Prisma (explicit field → column mapping; see docs/list-queries.md) ──

const API_KEY_SORT_COLUMNS: SortColumns<MerchantApiKeyListSortField, Prisma.OrganizationApiKeyOrderByWithRelationInput> = {
	createdAt: (direction) => ({ createdAt: direction }),
	name: (direction) => ({ name: direction }),
};

/** Keyset for the default order (`createdAt desc, id desc`). */
const API_KEY_LIST_KEYSET: ListKeyset<OrganizationApiKeyListRow, Prisma.OrganizationApiKeyWhereInput> = timestampIdKeyset(
	(row: OrganizationApiKeyListRow) => ({ at: Number(row.createdAt), id: row.id }),
	({ at, id }): Prisma.OrganizationApiKeyWhereInput => ({ OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: id } }] }),
);

/** The organization's (optionally one store's) live keys + the filter AST. Both scopes come from the service, never raw input. */
export function buildApiKeyListWhere(organizationId: string, locationId: string | undefined, query: MerchantApiKeyListQuery): Prisma.OrganizationApiKeyWhereInput {
	return {
		AND: [
			{ organizationId, isDeleted: false },
			...(locationId !== undefined ? [{ locationId }] : []),
			...fieldWhere(toPrismaNullableComparableFilter<number>(query.filter?.revokedAt), (revokedAt) => ({ revokedAt })),
		],
	};
}

export function buildApiKeyListOrder(query: MerchantApiKeyListQuery): ListOrder<Prisma.OrganizationApiKeyOrderByWithRelationInput> {
	return buildListOrder(merchantApiKeyListQuery.resolveSort(query.sort), {
		columns: API_KEY_SORT_COLUMNS,
		tieBreaker: (direction) => ({ id: direction }),
	});
}

@Injectable()
export class MerchantApiKeyRepository {
	public constructor(private readonly prisma: PrismaService) {}

	/** One page of the organization's live keys; `locationId` is the AUTHORIZED store scope, or `undefined` for every store. */
	public async listByOrgId(
		organizationId: string,
		locationId: string | undefined,
		query: MerchantApiKeyListQuery,
		db: MerchantApiKeyDbClient = this.prisma,
	): Promise<RepositoryListResult<OrganizationApiKeyListRow>> {
		return fetchListPage(query, {
			where: buildApiKeyListWhere(organizationId, locationId, query),
			order: buildApiKeyListOrder(query),
			keyset: API_KEY_LIST_KEYSET,
			and: (left, right) => ({ AND: [left, right] }),
			count: (where) => db.organizationApiKey.count({ where }),
			findMany: (args): Promise<OrganizationApiKeyListRow[]> => db.organizationApiKey.findMany({ ...args, include: API_KEY_LIST_INCLUDE }),
		});
	}

	public async create(
		input: {
			readonly organizationId: string;
			readonly locationId?: string | undefined;
			readonly name: string;
			readonly keyHash: string;
			readonly keyPrefix: string;
			readonly createdByUserId: string;
		},
		db: MerchantApiKeyDbClient = this.prisma,
	): Promise<OrganizationApiKey> {
		return db.organizationApiKey.create({
			data: {
				organizationId: input.organizationId,
				locationId: input.locationId ?? null,
				name: input.name,
				keyHash: input.keyHash,
				keyPrefix: input.keyPrefix,
				createdByUserId: input.createdByUserId,
			},
		});
	}

	/** An unrevoked key by hash, with the terminal it was paired to (if any) and its organization's POS policy. */
	public async findActiveByHash(keyHash: string): Promise<VerifiedApiKeyRow | null> {
		return this.prisma.organizationApiKey.findFirst({
			where: {
				keyHash,
				isDeleted: false,
				revokedAt: null,
			},
			include: VERIFIED_API_KEY_INCLUDE,
		});
	}

	public async findActiveByIdAndOrg(keyId: string, organizationId: string, db: MerchantApiKeyDbClient = this.prisma): Promise<OrganizationApiKey | null> {
		return db.organizationApiKey.findFirst({
			where: { id: keyId, organizationId, isDeleted: false },
		});
	}

	public async touchLastUsed(keyId: string, lastUsedAt: number): Promise<void> {
		await this.prisma.organizationApiKey.update({
			where: { id: keyId },
			data: { lastUsedAt },
		});
	}

	public async revoke(keyId: string, revokedAt: number, db: MerchantApiKeyDbClient = this.prisma): Promise<void> {
		await db.organizationApiKey.update({
			where: { id: keyId },
			data: { revokedAt },
		});
	}
}
