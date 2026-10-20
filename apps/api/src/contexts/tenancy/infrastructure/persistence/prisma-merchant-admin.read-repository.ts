import type { TenantLifecycleState, Prisma } from "@prisma/client";
import {
	adminLocationRequestListQuery,
	adminMerchantListQuery,
	assertNever,
	epochMs,
	LIST_SLOT_INDEX,
	type AdminLocationRequestListQuery,
	type AdminLocationRequestListSortField,
	type AdminLocationRequestResponse,
	type AdminMerchantDetailResponse,
	type AdminMerchantListQuery,
	type AdminMerchantListSortField,
	type MerchantOrgResponse,
	type MerchantOrgStatus,
	type PaginatedServiceResult,
} from "@workspace/shared";

import { actingUserId, type ActorContext } from "../../../../platform/application/actor-context";
import type { SystemOperationName } from "../../../../platform/application/system-operation-names";
import { fetchListPage, mapListResult, toPaginatedServiceResult } from "../../../../platform/infrastructure/persistence/list-page";
import { timestampIdKeyset, type ListKeyset } from "../../../../platform/infrastructure/persistence/list-query/keyset-cursor";
import { buildListOrder, type ListOrder, type SortColumns } from "../../../../platform/infrastructure/persistence/list-query/list-order";
import { fieldWhere, toPrismaEqualityFilter, type PrismaEqualityFilter } from "../../../../platform/infrastructure/persistence/list-query/prisma-filter";
import type { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import { toKybDocumentRecord } from "../../application/kyb-documents";
import type { KybFileAccessPort } from "../../application/ports/kyb-files.port";
import type { MerchantAdminReadPort } from "../../application/ports/merchant-admin-read.port";
import { toMerchantDetailResponse, toMerchantOrgResponse } from "./merchant-admin.mapper";
import { mapLocationToResponse } from "./tenant-location.mapper";
import { LOCATION_ADMIN_LIST_OPERATION, MERCHANT_ADMIN_READ_OPERATION } from "../../application/ports/tenants.tokens";

const ADMIN_ORG_LIST_INCLUDE = {
	merchantProfile: true,
	memberships: {
		where: { role: "OWNER", status: "ACTIVE", isDeleted: false },
		include: { user: { select: { id: true } } },
		take: 1,
	},
} satisfies Prisma.TenantInclude;

export const ADMIN_ORG_DETAIL_INCLUDE = {
	merchantProfile: true,
	memberships: {
		where: { isDeleted: false },
		include: { user: { select: { id: true, email: true, fullName: true } } },
	},
	_count: { select: { memberships: { where: { isDeleted: false } } } },
} satisfies Prisma.TenantInclude;

export type TenantAdminListRow = Prisma.TenantGetPayload<{ include: typeof ADMIN_ORG_LIST_INCLUDE }>;
export type TenantAdminDetailRow = Prisma.TenantGetPayload<{ include: typeof ADMIN_ORG_DETAIL_INCLUDE }>;

// ── Admin merchant list query → Prisma (explicit field → column mapping; see docs/technical/api/list-queries.md) ──

const ADMIN_MERCHANT_SORT_COLUMNS: SortColumns<AdminMerchantListSortField, Prisma.TenantOrderByWithRelationInput> = {
	createdAt: (direction) => ({ createdAt: direction }),
	displayName: (direction) => ({ displayName: direction }),
};

/** Keyset for the default order (`createdAt desc, id desc`). */
const ADMIN_MERCHANT_LIST_KEYSET: ListKeyset<TenantAdminListRow, Prisma.TenantWhereInput> = timestampIdKeyset(
	(row: TenantAdminListRow) => ({ at: Number(row.createdAt), id: row.id }),
	({ at, id }): Prisma.TenantWhereInput => ({ OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: id } }] }),
);

/** Public merchant status → the tenant lifecycle state it is stored as. */
function toLifecycleState(status: MerchantOrgStatus): TenantLifecycleState {
	switch (status) {
		case "ONBOARDING":
			return "PROVISIONING";
		case "ACTIVE":
			return "ACTIVE";
		case "SUSPENDED":
			return "SUSPENDED";
		default:
			return assertNever(status, "merchant status");
	}
}

/** Maps a translated status filter onto lifecycle states, operator by operator. */
function toLifecycleStateFilter(filter: PrismaEqualityFilter<MerchantOrgStatus>): PrismaEqualityFilter<TenantLifecycleState> {
	return {
		...(filter.equals !== undefined ? { equals: toLifecycleState(filter.equals) } : {}),
		...(filter.not !== undefined ? { not: toLifecycleState(filter.not) } : {}),
		...(filter.in !== undefined ? { in: filter.in.map(toLifecycleState) } : {}),
		...(filter.notIn !== undefined ? { notIn: filter.notIn.map(toLifecycleState) } : {}),
	};
}

/** Live merchant tenants + the filter AST + search. */
export function buildAdminMerchantListWhere(query: AdminMerchantListQuery): Prisma.TenantWhereInput {
	const filter = query.filter;
	return {
		AND: [
			{ isDeleted: false, merchantProfile: { isNot: null } },
			...fieldWhere(toPrismaEqualityFilter(filter?.city), (city): Prisma.TenantWhereInput => ({ merchantProfile: { is: { city } } })),
			...fieldWhere(toPrismaEqualityFilter(filter?.kybStatus), (kybStatus): Prisma.TenantWhereInput => ({ merchantProfile: { is: { kybStatus } } })),
			...fieldWhere(toPrismaEqualityFilter(filter?.status), (status): Prisma.TenantWhereInput => ({ lifecycleState: toLifecycleStateFilter(status) })),
			...(query.search !== undefined
				? [
						{
							OR: [
								{ displayName: { contains: query.search, mode: "insensitive" } },
								{ slug: { contains: query.search, mode: "insensitive" } },
								{ merchantProfile: { is: { legalName: { contains: query.search, mode: "insensitive" } } } },
							],
						} satisfies Prisma.TenantWhereInput,
					]
				: []),
		],
	};
}

export function buildAdminMerchantListOrder(query: AdminMerchantListQuery): ListOrder<Prisma.TenantOrderByWithRelationInput> {
	return buildListOrder(adminMerchantListQuery.resolveSort(query.sort), {
		columns: ADMIN_MERCHANT_SORT_COLUMNS,
		tieBreaker: (direction) => ({ id: direction }),
	});
}

const ADMIN_LOCATION_REQUEST_INCLUDE = {
	tenant: {
		select: {
			id: true,
			slug: true,
			displayName: true,
		},
	},
} satisfies Prisma.LocationInclude;

export type AdminLocationRequestRow = Prisma.LocationGetPayload<{ include: typeof ADMIN_LOCATION_REQUEST_INCLUDE }>;

// ── Admin location-request list query → Prisma (see docs/technical/api/list-queries.md) ──

const ADMIN_LOCATION_REQUEST_SORT_COLUMNS: SortColumns<AdminLocationRequestListSortField, Prisma.LocationOrderByWithRelationInput> = {
	createdAt: (direction) => ({ createdAt: direction }),
	name: (direction) => ({ name: direction }),
};

/** Keyset for the default order (`createdAt asc, id asc` — oldest request first). */
const ADMIN_LOCATION_REQUEST_LIST_KEYSET: ListKeyset<AdminLocationRequestRow, Prisma.LocationWhereInput> = timestampIdKeyset(
	(row: AdminLocationRequestRow) => ({ at: Number(row.createdAt), id: row.id }),
	({ at, id }): Prisma.LocationWhereInput => ({ OR: [{ createdAt: { gt: at } }, { createdAt: at, id: { gt: id } }] }),
);

/** Live, non-primary locations (store requests) + the filter AST. */
export function buildAdminLocationRequestListWhere(query: AdminLocationRequestListQuery): Prisma.LocationWhereInput {
	return {
		AND: [{ isDeleted: false, isPrimary: false }, ...fieldWhere(toPrismaEqualityFilter(query.filter?.status), (status) => ({ status }))],
	};
}

export function buildAdminLocationRequestListOrder(query: AdminLocationRequestListQuery): ListOrder<Prisma.LocationOrderByWithRelationInput> {
	return buildListOrder(adminLocationRequestListQuery.resolveSort(query.sort), {
		columns: ADMIN_LOCATION_REQUEST_SORT_COLUMNS,
		tieBreaker: (direction) => ({ id: direction }),
	});
}

function toLocationRequestResponse(row: AdminLocationRequestRow): AdminLocationRequestResponse {
	return {
		id: row.id,
		tenantId: row.tenantId,
		tenantSlug: row.tenant.slug,
		tenantDisplayName: row.tenant.displayName,
		name: row.name,
		code: row.code,
		addressText: row.addressText,
		city: row.city,
		contactPhone: row.contactPhone,
		status: row.status,
		rejectionReason: row.rejectionReason,
		isPrimary: row.isPrimary,
		requestedByUserId: row.requestedByUserId,
		createdAt: epochMs(Number(row.createdAt)),
	};
}

/** Platform-admin merchant reads, each one system-operation transaction (no N+1: owners and counts are joined). */
export class PrismaMerchantAdminReadRepository implements MerchantAdminReadPort {
	public constructor(
		private readonly transactions: TenantTransactionService,
		private readonly files: KybFileAccessPort,
	) {}

	public async listMerchants(actor: ActorContext, query: AdminMerchantListQuery): Promise<PaginatedServiceResult<MerchantOrgResponse>> {
		const result = await this.adminRead(actor, MERCHANT_ADMIN_READ_OPERATION, "List merchant tenants", async (tx) =>
			fetchListPage(query, {
				where: buildAdminMerchantListWhere(query),
				order: buildAdminMerchantListOrder(query),
				keyset: ADMIN_MERCHANT_LIST_KEYSET,
				and: (left, right) => ({ AND: [left, right] }),
				count: (where) => tx.tenant.count({ where }),
				findMany: (args): Promise<TenantAdminListRow[]> => tx.tenant.findMany({ ...args, include: ADMIN_ORG_LIST_INCLUDE }),
			}),
		);
		return toPaginatedServiceResult(
			mapListResult(result, (row): MerchantOrgResponse => ({ ...toMerchantOrgResponse(row), ownerUserId: row.memberships[LIST_SLOT_INDEX.first]?.userId ?? null })),
			query,
		);
	}

	public async getMerchantDetail(actor: ActorContext, tenantId: string): Promise<AdminMerchantDetailResponse | null> {
		const loaded = await this.adminRead(actor, MERCHANT_ADMIN_READ_OPERATION, "Read merchant tenant detail for KYB review", async (tx) => {
			const org = await tx.tenant.findFirst({ where: { id: tenantId, isDeleted: false }, include: ADMIN_ORG_DETAIL_INCLUDE });
			if (org === null) {
				return null;
			}
			const evidence = await tx.tenantKybFile.findMany({
				where: { tenantId, isActive: true, isDeleted: false },
				select: { fileId: true },
				orderBy: { createdAt: "asc" },
			});
			const locations = await tx.location.findMany({ where: { tenantId, isDeleted: false }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] });
			return { org, evidenceFileIds: evidence.map((row) => row.fileId), locations };
		});
		if (loaded === null) {
			return null;
		}
		const files = await this.files.describe(loaded.evidenceFileIds);
		const documents = loaded.evidenceFileIds.flatMap((fileId) => files.filter((file) => file.id === fileId).map(toKybDocumentRecord));
		return toMerchantDetailResponse(
			loaded.org,
			documents,
			loaded.locations.map((row) => mapLocationToResponse(row)),
		);
	}

	public async listLocationRequests(actor: ActorContext, query: AdminLocationRequestListQuery): Promise<PaginatedServiceResult<AdminLocationRequestResponse>> {
		const result = await this.adminRead(actor, LOCATION_ADMIN_LIST_OPERATION, "List tenant location requests", async (tx) =>
			fetchListPage(query, {
				where: buildAdminLocationRequestListWhere(query),
				order: buildAdminLocationRequestListOrder(query),
				keyset: ADMIN_LOCATION_REQUEST_LIST_KEYSET,
				and: (left, right) => ({ AND: [left, right] }),
				count: (where) => tx.location.count({ where }),
				findMany: (args): Promise<AdminLocationRequestRow[]> => tx.location.findMany({ ...args, include: ADMIN_LOCATION_REQUEST_INCLUDE }),
			}),
		);
		return toPaginatedServiceResult(mapListResult(result, toLocationRequestResponse), query);
	}

	private async adminRead<TResult>(
		actor: ActorContext,
		operation: SystemOperationName,
		reason: string,
		work: (tx: Prisma.TransactionClient) => Promise<TResult>,
	): Promise<TResult> {
		return this.transactions.withSystemOperation({ operation, reason, actorUserId: actingUserId(actor) }, work);
	}
}
