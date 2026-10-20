import type { Prisma } from "@prisma/client";
import {
	epochMs,
	ownMembershipListQuery,
	type TenantRewardMembershipResponse,
	type OwnMembershipListQuery,
	type OwnMembershipListSortField,
	type PaginatedServiceResult,
} from "@workspace/shared";

import { fetchListPage, mapListResult, toPaginatedServiceResult } from "../../../../platform/infrastructure/persistence/list-page";
import { timestampIdKeyset, type ListKeyset } from "../../../../platform/infrastructure/persistence/list-query/keyset-cursor";
import { buildListOrder, type ListOrder, type SortColumns } from "../../../../platform/infrastructure/persistence/list-query/list-order";
import type { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";

/** Allowlisted system operation: a user's memberships spa tenants, so no single tenant session can read them. */
export const LIST_OWN_MEMBERSHIPS_OPERATION = "tenant.context.list_memberships";

const OWN_MEMBERSHIP_INCLUDE = { tenant: { include: { merchantProfile: true } } } satisfies Prisma.MembershipInclude;

type OwnMembershipRow = Prisma.MembershipGetPayload<{ include: typeof OWN_MEMBERSHIP_INCLUDE }>;

const OWN_MEMBERSHIP_SORT_COLUMNS: SortColumns<OwnMembershipListSortField, Prisma.MembershipOrderByWithRelationInput> = {
	createdAt: (direction) => ({ createdAt: direction }),
	displayName: (direction) => ({ tenant: { displayName: direction } }),
};

/** Keyset for the default order (`createdAt asc, id asc` — the order the user joined). */
const OWN_MEMBERSHIP_LIST_KEYSET: ListKeyset<OwnMembershipRow, Prisma.MembershipWhereInput> = timestampIdKeyset(
	(row: OwnMembershipRow) => ({ at: Number(row.createdAt), id: row.id }),
	({ at, id }): Prisma.MembershipWhereInput => ({ OR: [{ createdAt: { gt: at } }, { createdAt: at, id: { gt: id } }] }),
);

/** The user's live ACTIVE memberships of live tenants, narrowed by `search` (the tenant's name or slug). */
export function buildOwnMembershipListWhere(userId: string, query: OwnMembershipListQuery): Prisma.MembershipWhereInput {
	const search = query.search;
	return {
		userId,
		status: "ACTIVE",
		isDeleted: false,
		tenant: {
			isDeleted: false,
			...(search === undefined ? {} : { OR: [{ displayName: { contains: search, mode: "insensitive" } }, { slug: { contains: search, mode: "insensitive" } }] }),
		},
	};
}

export function buildOwnMembershipListOrder(query: OwnMembershipListQuery): ListOrder<Prisma.MembershipOrderByWithRelationInput> {
	return buildListOrder(ownMembershipListQuery.resolveSort(query.sort), { columns: OWN_MEMBERSHIP_SORT_COLUMNS, tieBreaker: (direction) => ({ id: direction }) });
}

function toOwnMembership(row: OwnMembershipRow): TenantRewardMembershipResponse {
	return {
		tenantId: row.tenantId,
		tenantSlug: row.tenant.slug,
		displayName: row.tenant.displayName,
		role: row.role,
		kybStatus: row.tenant.merchantProfile?.kybStatus ?? "PENDING",
		lifecycleState: row.tenant.lifecycleState,
		createdAt: epochMs(Number(row.createdAt)),
	};
}

/** The signed-in user's own memberships, one page at a time (the merchant app's store switcher and stores page). */
export class PrismaOwnMembershipsReadRepository {
	public constructor(private readonly transactions: TenantTransactionService) {}

	public list(userId: string, query: OwnMembershipListQuery): Promise<PaginatedServiceResult<TenantRewardMembershipResponse>> {
		return this.transactions.withSystemOperation(
			{ operation: LIST_OWN_MEMBERSHIPS_OPERATION, reason: "List the caller's tenant memberships", actorUserId: userId },
			async (tx) => {
				const page = await fetchListPage(query, {
					where: buildOwnMembershipListWhere(userId, query),
					order: buildOwnMembershipListOrder(query),
					keyset: OWN_MEMBERSHIP_LIST_KEYSET,
					and: (left, right) => ({ AND: [left, right] }),
					count: (where) => tx.membership.count({ where }),
					findMany: (args): Promise<OwnMembershipRow[]> => tx.membership.findMany({ ...args, include: OWN_MEMBERSHIP_INCLUDE }),
				});
				return toPaginatedServiceResult(mapListResult(page, toOwnMembership), query);
			},
		);
	}
}
