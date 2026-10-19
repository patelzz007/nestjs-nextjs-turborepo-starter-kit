import type { OrganizationLifecycleState, Prisma } from "@prisma/client";
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

import type { ActorContext } from "../../../../platform/application/actor-context";
import { fetchListPage, mapListResult, toPaginatedServiceResult } from "../../../../platform/infrastructure/persistence/list-page";
import { timestampIdKeyset, type ListKeyset } from "../../../../platform/infrastructure/persistence/list-query/keyset-cursor";
import { buildListOrder, type ListOrder, type SortColumns } from "../../../../platform/infrastructure/persistence/list-query/list-order";
import { fieldWhere, toPrismaEqualityFilter, type PrismaEqualityFilter } from "../../../../platform/infrastructure/persistence/list-query/prisma-filter";
import type { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import { toKybDocumentRecord } from "../../application/kyb-documents";
import type { KybFileAccessPort } from "../../application/ports/kyb-files.port";
import type { MerchantAdminReadPort } from "../../application/ports/merchant-admin-read.port";
import { toMerchantDetailResponse, toMerchantOrgResponse } from "./merchant-admin.mapper";
import { mapOrganizationLocationToResponse } from "./organization-location.mapper";

/** Allowlisted system operation of the admin merchant reads (cross-tenant, after the LIST MERCHANT_ORG check). */
const MERCHANT_ADMIN_READ_OPERATION = "organization.merchant.admin_read";
/** Allowlisted system operation of the admin store-request queue. */
const LOCATION_REQUEST_LIST_OPERATION = "organization.location.admin_list";

const ADMIN_ORG_LIST_INCLUDE = {
	merchantProfile: true,
	memberships: {
		where: { role: "OWNER", status: "ACTIVE", isDeleted: false },
		include: { user: { select: { id: true } } },
		take: 1,
	},
} satisfies Prisma.OrganizationInclude;

export const ADMIN_ORG_DETAIL_INCLUDE = {
	merchantProfile: true,
	memberships: {
		where: { isDeleted: false },
		include: { user: { select: { id: true, email: true, fullName: true } } },
	},
	_count: { select: { memberships: { where: { isDeleted: false } } } },
} satisfies Prisma.OrganizationInclude;

export type OrganizationAdminListRow = Prisma.OrganizationGetPayload<{ include: typeof ADMIN_ORG_LIST_INCLUDE }>;
export type OrganizationAdminDetailRow = Prisma.OrganizationGetPayload<{ include: typeof ADMIN_ORG_DETAIL_INCLUDE }>;

// ── Admin merchant list query → Prisma (explicit field → column mapping; see docs/technical/api/list-queries.md) ──

const ADMIN_MERCHANT_SORT_COLUMNS: SortColumns<AdminMerchantListSortField, Prisma.OrganizationOrderByWithRelationInput> = {
	createdAt: (direction) => ({ createdAt: direction }),
	displayName: (direction) => ({ displayName: direction }),
};

/** Keyset for the default order (`createdAt desc, id desc`). */
const ADMIN_MERCHANT_LIST_KEYSET: ListKeyset<OrganizationAdminListRow, Prisma.OrganizationWhereInput> = timestampIdKeyset(
	(row: OrganizationAdminListRow) => ({ at: Number(row.createdAt), id: row.id }),
	({ at, id }): Prisma.OrganizationWhereInput => ({ OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: id } }] }),
);

/** Public merchant status → the organization lifecycle state it is stored as. */
function toLifecycleState(status: MerchantOrgStatus): OrganizationLifecycleState {
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
function toLifecycleStateFilter(filter: PrismaEqualityFilter<MerchantOrgStatus>): PrismaEqualityFilter<OrganizationLifecycleState> {
	return {
		...(filter.equals !== undefined ? { equals: toLifecycleState(filter.equals) } : {}),
		...(filter.not !== undefined ? { not: toLifecycleState(filter.not) } : {}),
		...(filter.in !== undefined ? { in: filter.in.map(toLifecycleState) } : {}),
		...(filter.notIn !== undefined ? { notIn: filter.notIn.map(toLifecycleState) } : {}),
	};
}

/** Live merchant organizations + the filter AST + search. */
export function buildAdminMerchantListWhere(query: AdminMerchantListQuery): Prisma.OrganizationWhereInput {
	const filter = query.filter;
	return {
		AND: [
			{ isDeleted: false, merchantProfile: { isNot: null } },
			...fieldWhere(toPrismaEqualityFilter(filter?.city), (city): Prisma.OrganizationWhereInput => ({ merchantProfile: { is: { city } } })),
			...fieldWhere(toPrismaEqualityFilter(filter?.kybStatus), (kybStatus): Prisma.OrganizationWhereInput => ({ merchantProfile: { is: { kybStatus } } })),
			...fieldWhere(toPrismaEqualityFilter(filter?.status), (status): Prisma.OrganizationWhereInput => ({ lifecycleState: toLifecycleStateFilter(status) })),
			...(query.search !== undefined
				? [
						{
							OR: [
								{ displayName: { contains: query.search, mode: "insensitive" } },
								{ slug: { contains: query.search, mode: "insensitive" } },
								{ merchantProfile: { is: { legalName: { contains: query.search, mode: "insensitive" } } } },
							],
						} satisfies Prisma.OrganizationWhereInput,
					]
				: []),
		],
	};
}

export function buildAdminMerchantListOrder(query: AdminMerchantListQuery): ListOrder<Prisma.OrganizationOrderByWithRelationInput> {
	return buildListOrder(adminMerchantListQuery.resolveSort(query.sort), {
		columns: ADMIN_MERCHANT_SORT_COLUMNS,
		tieBreaker: (direction) => ({ id: direction }),
	});
}

const ADMIN_LOCATION_REQUEST_INCLUDE = {
	organization: {
		select: {
			id: true,
			slug: true,
			displayName: true,
		},
	},
} satisfies Prisma.OrganizationLocationInclude;

export type AdminLocationRequestRow = Prisma.OrganizationLocationGetPayload<{ include: typeof ADMIN_LOCATION_REQUEST_INCLUDE }>;

// ── Admin location-request list query → Prisma (see docs/technical/api/list-queries.md) ──

const ADMIN_LOCATION_REQUEST_SORT_COLUMNS: SortColumns<AdminLocationRequestListSortField, Prisma.OrganizationLocationOrderByWithRelationInput> = {
	createdAt: (direction) => ({ createdAt: direction }),
	name: (direction) => ({ name: direction }),
};

/** Keyset for the default order (`createdAt asc, id asc` — oldest request first). */
const ADMIN_LOCATION_REQUEST_LIST_KEYSET: ListKeyset<AdminLocationRequestRow, Prisma.OrganizationLocationWhereInput> = timestampIdKeyset(
	(row: AdminLocationRequestRow) => ({ at: Number(row.createdAt), id: row.id }),
	({ at, id }): Prisma.OrganizationLocationWhereInput => ({ OR: [{ createdAt: { gt: at } }, { createdAt: at, id: { gt: id } }] }),
);

/** Live, non-primary locations (store requests) + the filter AST. */
export function buildAdminLocationRequestListWhere(query: AdminLocationRequestListQuery): Prisma.OrganizationLocationWhereInput {
	return {
		AND: [{ isDeleted: false, isPrimary: false }, ...fieldWhere(toPrismaEqualityFilter(query.filter?.status), (status) => ({ status }))],
	};
}

export function buildAdminLocationRequestListOrder(query: AdminLocationRequestListQuery): ListOrder<Prisma.OrganizationLocationOrderByWithRelationInput> {
	return buildListOrder(adminLocationRequestListQuery.resolveSort(query.sort), {
		columns: ADMIN_LOCATION_REQUEST_SORT_COLUMNS,
		tieBreaker: (direction) => ({ id: direction }),
	});
}

function toLocationRequestResponse(row: AdminLocationRequestRow): AdminLocationRequestResponse {
	return {
		id: row.id,
		organizationId: row.organizationId,
		organizationSlug: row.organization.slug,
		organizationDisplayName: row.organization.displayName,
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
		const result = await this.adminRead(actor, MERCHANT_ADMIN_READ_OPERATION, "List merchant organizations", async (tx) =>
			fetchListPage(query, {
				where: buildAdminMerchantListWhere(query),
				order: buildAdminMerchantListOrder(query),
				keyset: ADMIN_MERCHANT_LIST_KEYSET,
				and: (left, right) => ({ AND: [left, right] }),
				count: (where) => tx.organization.count({ where }),
				findMany: (args): Promise<OrganizationAdminListRow[]> => tx.organization.findMany({ ...args, include: ADMIN_ORG_LIST_INCLUDE }),
			}),
		);
		return toPaginatedServiceResult(
			mapListResult(result, (row): MerchantOrgResponse => ({ ...toMerchantOrgResponse(row), ownerUserId: row.memberships[LIST_SLOT_INDEX.first]?.userId ?? null })),
			query,
		);
	}

	public async getMerchantDetail(actor: ActorContext, organizationId: string): Promise<AdminMerchantDetailResponse | null> {
		const loaded = await this.adminRead(actor, MERCHANT_ADMIN_READ_OPERATION, "Read merchant organization detail for KYB review", async (tx) => {
			const org = await tx.organization.findFirst({ where: { id: organizationId, isDeleted: false }, include: ADMIN_ORG_DETAIL_INCLUDE });
			if (org === null) {
				return null;
			}
			const evidence = await tx.organizationKybFile.findMany({
				where: { organizationId, isActive: true, isDeleted: false },
				select: { fileId: true },
				orderBy: { createdAt: "asc" },
			});
			const locations = await tx.organizationLocation.findMany({ where: { organizationId, isDeleted: false }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] });
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
			loaded.locations.map((row) => mapOrganizationLocationToResponse(row)),
		);
	}

	public async listLocationRequests(actor: ActorContext, query: AdminLocationRequestListQuery): Promise<PaginatedServiceResult<AdminLocationRequestResponse>> {
		const result = await this.adminRead(actor, LOCATION_REQUEST_LIST_OPERATION, "List organization location requests", async (tx) =>
			fetchListPage(query, {
				where: buildAdminLocationRequestListWhere(query),
				order: buildAdminLocationRequestListOrder(query),
				keyset: ADMIN_LOCATION_REQUEST_LIST_KEYSET,
				and: (left, right) => ({ AND: [left, right] }),
				count: (where) => tx.organizationLocation.count({ where }),
				findMany: (args): Promise<AdminLocationRequestRow[]> => tx.organizationLocation.findMany({ ...args, include: ADMIN_LOCATION_REQUEST_INCLUDE }),
			}),
		);
		return toPaginatedServiceResult(mapListResult(result, toLocationRequestResponse), query);
	}

	private async adminRead<TResult>(
		actor: ActorContext,
		operation: typeof MERCHANT_ADMIN_READ_OPERATION | typeof LOCATION_REQUEST_LIST_OPERATION,
		reason: string,
		work: (tx: Prisma.TransactionClient) => Promise<TResult>,
	): Promise<TResult> {
		return this.transactions.withSystemOperation({ operation, reason, actorUserId: actor.kind === "user" ? actor.userId : null }, work);
	}
}
