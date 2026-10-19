import type { Prisma } from "@prisma/client";
import {
	epochMs,
	ownMembershipListQuery,
	type OrganizationRewardMembershipResponse,
	type OwnMembershipListQuery,
	type OwnMembershipListSortField,
	type PaginatedServiceResult,
} from "@workspace/shared";

import { fetchListPage, mapListResult, toPaginatedServiceResult } from "../../../../platform/infrastructure/persistence/list-page";
import { timestampIdKeyset, type ListKeyset } from "../../../../platform/infrastructure/persistence/list-query/keyset-cursor";
import { buildListOrder, type ListOrder, type SortColumns } from "../../../../platform/infrastructure/persistence/list-query/list-order";
import type { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";

/** Allowlisted system operation: a user's memberships span organizations, so no single tenant session can read them. */
export const LIST_OWN_MEMBERSHIPS_OPERATION = "organization.context.list_memberships";

const OWN_MEMBERSHIP_INCLUDE = { organization: { include: { merchantProfile: true } } } satisfies Prisma.OrganizationMembershipInclude;

type OwnMembershipRow = Prisma.OrganizationMembershipGetPayload<{ include: typeof OWN_MEMBERSHIP_INCLUDE }>;

const OWN_MEMBERSHIP_SORT_COLUMNS: SortColumns<OwnMembershipListSortField, Prisma.OrganizationMembershipOrderByWithRelationInput> = {
	createdAt: (direction) => ({ createdAt: direction }),
	displayName: (direction) => ({ organization: { displayName: direction } }),
};

/** Keyset for the default order (`createdAt asc, id asc` — the order the user joined). */
const OWN_MEMBERSHIP_LIST_KEYSET: ListKeyset<OwnMembershipRow, Prisma.OrganizationMembershipWhereInput> = timestampIdKeyset(
	(row: OwnMembershipRow) => ({ at: Number(row.createdAt), id: row.id }),
	({ at, id }): Prisma.OrganizationMembershipWhereInput => ({ OR: [{ createdAt: { gt: at } }, { createdAt: at, id: { gt: id } }] }),
);

/** The user's live ACTIVE memberships of live organizations, narrowed by `search` (the organization's name or slug). */
export function buildOwnMembershipListWhere(userId: string, query: OwnMembershipListQuery): Prisma.OrganizationMembershipWhereInput {
	const search = query.search;
	return {
		userId,
		status: "ACTIVE",
		isDeleted: false,
		organization: {
			isDeleted: false,
			...(search === undefined ? {} : { OR: [{ displayName: { contains: search, mode: "insensitive" } }, { slug: { contains: search, mode: "insensitive" } }] }),
		},
	};
}

export function buildOwnMembershipListOrder(query: OwnMembershipListQuery): ListOrder<Prisma.OrganizationMembershipOrderByWithRelationInput> {
	return buildListOrder(ownMembershipListQuery.resolveSort(query.sort), { columns: OWN_MEMBERSHIP_SORT_COLUMNS, tieBreaker: (direction) => ({ id: direction }) });
}

function toOwnMembership(row: OwnMembershipRow): OrganizationRewardMembershipResponse {
	return {
		organizationId: row.organizationId,
		organizationSlug: row.organization.slug,
		displayName: row.organization.displayName,
		role: row.role,
		kybStatus: row.organization.merchantProfile?.kybStatus ?? "PENDING",
		lifecycleState: row.organization.lifecycleState,
		createdAt: epochMs(Number(row.createdAt)),
	};
}

/** The signed-in user's own memberships, one page at a time (the merchant app's store switcher and stores page). */
export class PrismaOwnMembershipsReadRepository {
	public constructor(private readonly transactions: TenantTransactionService) {}

	public list(userId: string, query: OwnMembershipListQuery): Promise<PaginatedServiceResult<OrganizationRewardMembershipResponse>> {
		return this.transactions.withSystemOperation(
			{ operation: LIST_OWN_MEMBERSHIPS_OPERATION, reason: "List the caller's organization memberships", actorUserId: userId },
			async (tx) => {
				const page = await fetchListPage(query, {
					where: buildOwnMembershipListWhere(userId, query),
					order: buildOwnMembershipListOrder(query),
					keyset: OWN_MEMBERSHIP_LIST_KEYSET,
					and: (left, right) => ({ AND: [left, right] }),
					count: (where) => tx.organizationMembership.count({ where }),
					findMany: (args): Promise<OwnMembershipRow[]> => tx.organizationMembership.findMany({ ...args, include: OWN_MEMBERSHIP_INCLUDE }),
				});
				return toPaginatedServiceResult(mapListResult(page, toOwnMembership), query);
			},
		);
	}
}
