import { Injectable } from "@nestjs/common";
import type { OrganizationApiKey, OrganizationApiKeyScope, Prisma, PrismaClient } from "@prisma/client";

import { merchantApiKeyListQuery, type MerchantApiKeyListQuery, type MerchantApiKeyListSortField } from "@workspace/shared";

import { fetchListPage } from "../../../platform/persistence/list-page";
import { timestampIdKeyset, type ListKeyset } from "../../../platform/persistence/list-query/keyset-cursor";
import { buildListOrder, type ListOrder, type SortColumns } from "../../../platform/persistence/list-query/list-order";
import { fieldWhere, toPrismaNullableComparableFilter } from "../../../platform/persistence/list-query/prisma-filter";
import type { RepositoryListResult } from "../../../platform/persistence/types";
import { PrismaService } from "../../../prisma/prisma.service";
import type { MerchantLocationScope } from "../types/merchant-location-scope";
import { locationIdInFilter } from "../utils/merchant-location-scope.util";

export type MerchantApiKeyDbClient = Pick<PrismaClient, "organizationApiKey">;

/**
 * Rounds of "increment the live window, else open a new one". The second round
 * always finds the window a concurrent request just opened; a third would mean
 * the key row vanished.
 */
const CODE_FAILURE_WINDOW_ATTEMPTS = 2;

const API_KEY_LIST_INCLUDE = {
	location: { select: { name: true } },
} satisfies Prisma.OrganizationApiKeyInclude;

const VERIFIED_API_KEY_INCLUDE = {
	terminal: { select: { id: true, terminalId: true, locationId: true, isDeleted: true } },
	organization: { select: { lifecycleState: true, isDeleted: true, merchantProfile: { select: { requireRegisteredTerminals: true } } } },
} satisfies Prisma.OrganizationApiKeyInclude;

export type VerifiedApiKeyRow = Prisma.OrganizationApiKeyGetPayload<{ include: typeof VERIFIED_API_KEY_INCLUDE }>;

export type OrganizationApiKeyListRow = Prisma.OrganizationApiKeyGetPayload<{ include: typeof API_KEY_LIST_INCLUDE }>;

// ── List query → Prisma (explicit field → column mapping; see docs/technical/api/list-queries.md) ──

const API_KEY_SORT_COLUMNS: SortColumns<MerchantApiKeyListSortField, Prisma.OrganizationApiKeyOrderByWithRelationInput> = {
	createdAt: (direction) => ({ createdAt: direction }),
	name: (direction) => ({ name: direction }),
};

/** Keyset for the default order (`createdAt desc, id desc`). */
const API_KEY_LIST_KEYSET: ListKeyset<OrganizationApiKeyListRow, Prisma.OrganizationApiKeyWhereInput> = timestampIdKeyset(
	(row: OrganizationApiKeyListRow) => ({ at: Number(row.createdAt), id: row.id }),
	({ at, id }): Prisma.OrganizationApiKeyWhereInput => ({ OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: id } }] }),
);

/**
 * The organization's live keys within the caller's stores + the filter AST. Both scopes come from the service,
 * never raw input; a store-limited scope excludes organization-wide keys (`location_id IS NULL`).
 */
export function buildApiKeyListWhere(organizationId: string, scope: MerchantLocationScope, query: MerchantApiKeyListQuery): Prisma.OrganizationApiKeyWhereInput {
	const locationFilter = locationIdInFilter(scope);
	return {
		AND: [
			{ organizationId, isDeleted: false },
			...(locationFilter !== undefined ? [{ locationId: locationFilter }] : []),
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

	/** One page of the organization's live keys within the AUTHORIZED store scope. */
	public async listByOrgId(
		organizationId: string,
		scope: MerchantLocationScope,
		query: MerchantApiKeyListQuery,
		db: MerchantApiKeyDbClient = this.prisma,
	): Promise<RepositoryListResult<OrganizationApiKeyListRow>> {
		return fetchListPage(query, {
			where: buildApiKeyListWhere(organizationId, scope, query),
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
			readonly scope: OrganizationApiKeyScope;
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
				scope: input.scope,
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

	/** Until when POS code redemption with this key is locked (`null` = never locked). */
	public async findCodeLockedUntil(keyId: string): Promise<bigint | null> {
		const row = await this.prisma.organizationApiKey.findUnique({ where: { id: keyId }, select: { codeLockedUntil: true } });
		return row?.codeLockedUntil ?? null;
	}

	/**
	 * Adds `failures` unknown-code attempts to the key's current window, race-safe:
	 * both statements are single conditional UPDATEs, so concurrent requests
	 * either increment the live window or (exactly one of them) open a new one.
	 * Returns the failures counted in the live window after this call.
	 */
	public async addCodeFailures(keyId: string, failures: number, now: number, windowMs: number): Promise<number> {
		const windowOpenAfter = now - windowMs;
		for (let attempt = 0; attempt < CODE_FAILURE_WINDOW_ATTEMPTS; attempt += 1) {
			const incremented = await this.prisma.organizationApiKey.updateMany({
				where: { id: keyId, codeFailureWindowStartedAt: { gt: windowOpenAfter } },
				data: { codeFailureCount: { increment: failures } },
			});
			const counted =
				incremented.count === 1 ||
				(
					await this.prisma.organizationApiKey.updateMany({
						where: { id: keyId, OR: [{ codeFailureWindowStartedAt: null }, { codeFailureWindowStartedAt: { lte: windowOpenAfter } }] },
						data: { codeFailureCount: failures, codeFailureWindowStartedAt: now },
					})
				).count === 1;
			if (counted) {
				const row = await this.prisma.organizationApiKey.findUniqueOrThrow({ where: { id: keyId }, select: { codeFailureCount: true } });
				return row.codeFailureCount;
			}
			// Neither matched: a concurrent request opened the window between the two statements — count into it.
		}
		throw new Error(`Could not record POS code failures for API key ${keyId}`);
	}

	/** Locks the key until `lockedUntil` unless it is already locked; `true` when THIS call set the lock. */
	public async lockCodeRedemption(keyId: string, now: number, lockedUntil: number): Promise<boolean> {
		const locked = await this.prisma.organizationApiKey.updateMany({
			where: { id: keyId, OR: [{ codeLockedUntil: null }, { codeLockedUntil: { lte: now } }] },
			data: { codeLockedUntil: lockedUntil, codeFailureCount: 0, codeFailureWindowStartedAt: null },
		});
		return locked.count === 1;
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
