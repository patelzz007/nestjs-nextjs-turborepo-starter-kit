import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import {
	epochMs,
	supportAccessGrantListQuery,
	SupportAccessGrantDetailSchema,
	TENANT_SUPPORT_ACCESS_LIST_LIMIT,
	UuidParamSchema,
	type PaginatedServiceResult,
	type SupportAccessGrantDetail,
	type SupportAccessGrantListQuery,
	type SupportAccessGrantListSortField,
} from "@workspace/shared";

import { actingUserId, type ActorContext } from "../../../../platform/application/actor-context";
import type { SystemOperationName } from "../../../../platform/application/system-operation-names";
import { fetchListPage, mapListResult, toPaginatedServiceResult } from "../../../../platform/infrastructure/persistence/list-page";
import { timestampIdKeyset, type ListKeyset } from "../../../../platform/infrastructure/persistence/list-query/keyset-cursor";
import { buildListOrder, type SortColumns } from "../../../../platform/infrastructure/persistence/list-query/list-order";
import { fieldWhere, toPrismaEqualityFilter } from "../../../../platform/infrastructure/persistence/list-query/prisma-filter";
import { systemRlsContext } from "../../../../prisma/rls-context";
import { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import type { SupportAccessReadPort } from "../../application/ports/support-access-read.port";
import { SUPPORT_ACCESS_ADMIN_READ_OPERATION, SUPPORT_ACCESS_TENANT_READ_OPERATION } from "../../application/ports/authorization.tokens";

const PERSON_SELECT = { select: { id: true, fullName: true, email: true } } satisfies Prisma.UserDefaultArgs;

const GRANT_DETAIL_INCLUDE = {
	tenant: { select: { id: true, slug: true, displayName: true } },
	supportUser: PERSON_SELECT,
} satisfies Prisma.SupportAccessGrantInclude;

type GrantDetailRow = Prisma.SupportAccessGrantGetPayload<{ include: typeof GRANT_DETAIL_INCLUDE }>;

const SORT_COLUMNS: SortColumns<SupportAccessGrantListSortField, Prisma.SupportAccessGrantOrderByWithRelationInput> = {
	createdAt: (direction) => ({ createdAt: direction }),
};

/** Keyset for the default order (`createdAt desc, id desc`). */
const GRANT_LIST_KEYSET: ListKeyset<GrantDetailRow, Prisma.SupportAccessGrantWhereInput> = timestampIdKeyset(
	(row: GrantDetailRow) => ({ at: Number(row.createdAt), id: row.id }),
	({ at, id }): Prisma.SupportAccessGrantWhereInput => ({ OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: id } }] }),
);

export function buildSupportAccessGrantListWhere(query: SupportAccessGrantListQuery): Prisma.SupportAccessGrantWhereInput {
	const filter = query.filter;
	return {
		AND: [
			{ isDeleted: false },
			...fieldWhere(toPrismaEqualityFilter(filter?.status), (status) => ({ status })),
			...fieldWhere(toPrismaEqualityFilter(filter?.tenantId), (tenantId) => ({ tenantId })),
		],
	};
}

/**
 * Support access grants as both lists show them. The approver's name comes from the same batch of
 * account reads as the support users', so a page is a fixed number of queries (no N+1).
 */
@Injectable()
export class PrismaSupportAccessReadRepository implements SupportAccessReadPort {
	public constructor(private readonly transactions: TenantTransactionService) {}

	public listForAdmin(actor: ActorContext, query: SupportAccessGrantListQuery): Promise<PaginatedServiceResult<SupportAccessGrantDetail>> {
		return this.read(actor, SUPPORT_ACCESS_ADMIN_READ_OPERATION, async (db) => {
			const result = await fetchListPage(query, {
				where: buildSupportAccessGrantListWhere(query),
				order: buildListOrder(supportAccessGrantListQuery.resolveSort(query.sort), { columns: SORT_COLUMNS, tieBreaker: (direction) => ({ id: direction }) }),
				keyset: GRANT_LIST_KEYSET,
				and: (left, right) => ({ AND: [left, right] }),
				count: (where) => db.supportAccessGrant.count({ where }),
				findMany: (args): Promise<GrantDetailRow[]> => db.supportAccessGrant.findMany({ ...args, include: GRANT_DETAIL_INCLUDE }),
			});
			const approvers = await this.approversOf(db, result.items);
			return toPaginatedServiceResult(
				mapListResult(result, (row) => toDetail(row, approvers)),
				query,
			);
		});
	}

	public listForTenantOwner(actor: ActorContext, routeKey: string, userId: string): Promise<readonly SupportAccessGrantDetail[] | null> {
		return this.read(actor, SUPPORT_ACCESS_TENANT_READ_OPERATION, async (db) => {
			const tenant = await db.tenant.findFirst({
				where: {
					isDeleted: false,
					OR: [{ slug: routeKey }, { slugHistory: { some: { slug: routeKey } } }, ...(UuidParamSchema.safeParse(routeKey).success ? [{ id: routeKey }] : [])],
					memberships: { some: { userId, role: "OWNER", status: "ACTIVE", isDeleted: false, user: { isActive: true, isDeleted: false } } },
				},
				select: { id: true },
			});
			if (tenant === null) {
				return null;
			}
			const rows = await db.supportAccessGrant.findMany({
				where: { tenantId: tenant.id, isDeleted: false },
				orderBy: [{ createdAt: "desc" }, { id: "desc" }],
				take: TENANT_SUPPORT_ACCESS_LIST_LIMIT,
				include: GRANT_DETAIL_INCLUDE,
			});
			const approvers = await this.approversOf(db, rows);
			return rows.map((row) => toDetail(row, approvers));
		});
	}

	private async approversOf(db: Prisma.TransactionClient, rows: readonly GrantDetailRow[]): Promise<ReadonlyMap<string, SupportAccessGrantDetail["approvedBy"]>> {
		const ids = [...new Set(rows.flatMap((row) => (row.tenantApprovedById === null ? [] : [row.tenantApprovedById])))];
		if (ids.length === 0) {
			return new Map();
		}
		const users = await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true, email: true } });
		return new Map(users.map((user) => [user.id, user]));
	}

	private read<TResult>(actor: ActorContext, operation: SystemOperationName, work: (db: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult> {
		return this.transactions.withRlsContext({ context: systemRlsContext(operation, actingUserId(actor), actor.tenantId), reason: operation }, work);
	}
}

function toDetail(row: GrantDetailRow, approvers: ReadonlyMap<string, SupportAccessGrantDetail["approvedBy"]>): SupportAccessGrantDetail {
	return SupportAccessGrantDetailSchema.parse({
		id: row.id,
		tenantId: row.tenantId,
		mode: row.mode,
		status: row.status,
		expiresAt: epochMs(Number(row.expiresAt)),
		createdAt: epochMs(Number(row.createdAt)),
		tenant: row.tenant,
		supportUser: row.supportUser,
		approvedBy: row.tenantApprovedById === null ? null : (approvers.get(row.tenantApprovedById) ?? null),
		reason: row.reason,
		ticketRef: row.ticketRef,
		revokedAt: row.revokedAt === null ? null : epochMs(Number(row.revokedAt)),
	});
}
