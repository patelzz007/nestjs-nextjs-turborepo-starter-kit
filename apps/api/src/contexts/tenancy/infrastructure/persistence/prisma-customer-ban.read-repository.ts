import type { Prisma } from "@prisma/client";
import {
	epochMs,
	tenantCustomerBanListQuery,
	type PaginatedServiceResult,
	type TenantCustomerBanListQuery,
	type TenantCustomerBanListSortField,
	type TenantCustomerBanResponse,
} from "@workspace/shared";

import { fetchListPage, mapListResult, toPaginatedServiceResult } from "../../../../platform/infrastructure/persistence/list-page";
import { timestampIdKeyset, type ListKeyset } from "../../../../platform/infrastructure/persistence/list-query/keyset-cursor";
import { buildListOrder, type SortColumns } from "../../../../platform/infrastructure/persistence/list-query/list-order";
import type { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import type { CustomerBanReadPort } from "../../application/ports/customer-ban-read.port";
import { TENANT_CUSTOMER_BAN_READ_OPERATION } from "../../application/ports/tenants.tokens";

const BAN_RESPONSE_SELECT = {
	id: true,
	reason: true,
	bannedAt: true,
	createdAt: true,
	bannedBy: { select: { id: true, fullName: true } },
	sourceRedemption: { select: { id: true, redeemedAt: true, claim: { select: { reward: { select: { title: true } } } } } },
} satisfies Prisma.TenantCustomerBanSelect;

type BanRow = Prisma.TenantCustomerBanGetPayload<{ select: typeof BAN_RESPONSE_SELECT }>;

const BAN_SORT_COLUMNS: SortColumns<TenantCustomerBanListSortField, Prisma.TenantCustomerBanOrderByWithRelationInput> = {
	bannedAt: (direction) => ({ bannedAt: direction }),
};

/** Keyset for the default order (`bannedAt desc, id desc`). */
const BAN_LIST_KEYSET: ListKeyset<BanRow, Prisma.TenantCustomerBanWhereInput> = timestampIdKeyset(
	(row: BanRow) => ({ at: Number(row.bannedAt), id: row.id }),
	({ at, id }): Prisma.TenantCustomerBanWhereInput => ({ OR: [{ bannedAt: { lt: at } }, { bannedAt: at, id: { lt: id } }] }),
);

function toBanResponse(row: BanRow): TenantCustomerBanResponse {
	const source = row.sourceRedemption;
	return {
		id: row.id,
		reason: row.reason,
		bannedAt: epochMs(Number(row.bannedAt)),
		bannedBy: row.bannedBy,
		source: source === null ? null : { redemptionId: source.id, rewardTitle: source.claim.reward.title, redeemedAt: epochMs(Number(source.redeemedAt)) },
	};
}

/**
 * The tenant's customer bans under `tenant.customer_ban.read`: the ban, the member who made it and
 * the redemption it was made from (other members' names and the redemption's reward are outside a
 * member's own RLS view). Called only after the route's capability check.
 */
export class PrismaCustomerBanReadRepository implements CustomerBanReadPort {
	public constructor(private readonly transactions: TenantTransactionService) {}

	public listActive(tenantId: string, query: TenantCustomerBanListQuery): Promise<PaginatedServiceResult<TenantCustomerBanResponse>> {
		return this.transactions.withSystemOperation(
			{ operation: TENANT_CUSTOMER_BAN_READ_OPERATION, reason: "List a tenant's active customer bans", actorUserId: null },
			async (db) => {
				const page = await fetchListPage(query, {
					where: { tenantId, liftedAt: null, isDeleted: false },
					order: buildListOrder(tenantCustomerBanListQuery.resolveSort(query.sort), { columns: BAN_SORT_COLUMNS, tieBreaker: (direction) => ({ id: direction }) }),
					keyset: BAN_LIST_KEYSET,
					and: (left: Prisma.TenantCustomerBanWhereInput, right: Prisma.TenantCustomerBanWhereInput): Prisma.TenantCustomerBanWhereInput => ({ AND: [left, right] }),
					count: (where) => db.tenantCustomerBan.count({ where }),
					findMany: (args): Promise<BanRow[]> => db.tenantCustomerBan.findMany({ ...args, select: BAN_RESPONSE_SELECT }),
				});
				return toPaginatedServiceResult(mapListResult(page, toBanResponse), query);
			},
		);
	}

	public findById(tenantId: string, banId: string): Promise<TenantCustomerBanResponse | null> {
		return this.transactions.withSystemOperation({ operation: TENANT_CUSTOMER_BAN_READ_OPERATION, reason: "Read one customer ban", actorUserId: null }, async (db) => {
			const row = await db.tenantCustomerBan.findFirst({ where: { id: banId, tenantId, isDeleted: false }, select: BAN_RESPONSE_SELECT });
			return row === null ? null : toBanResponse(row);
		});
	}
}
