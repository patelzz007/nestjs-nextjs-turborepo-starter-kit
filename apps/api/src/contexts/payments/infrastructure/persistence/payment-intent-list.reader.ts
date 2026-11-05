import type { PaymentIntent as PaymentIntentRow, Prisma } from "@prisma/client";
import { paymentIntentListQuery, type PaginatedServiceResult, type PaymentIntentListQuery } from "@workspace/shared";

import { fetchListPage, mapListResult, toPaginatedServiceResult } from "../../../../platform/infrastructure/persistence/list-page";
import { timestampIdKeyset, type ListKeyset } from "../../../../platform/infrastructure/persistence/list-query/keyset-cursor";
import { buildListOrder, type SortColumns } from "../../../../platform/infrastructure/persistence/list-query/list-order";
import { fieldWhere, toPrismaEqualityFilter } from "../../../../platform/infrastructure/persistence/list-query/prisma-filter";
import type { PaymentIntent } from "../../domain/aggregates/payment-intent.aggregate";
import { toPaymentIntent } from "./prisma-payment-intent.repository";

const PAYMENT_COLUMNS: SortColumns<"createdAt", Prisma.PaymentIntentOrderByWithRelationInput> = { createdAt: (direction) => ({ createdAt: direction }) };
const PAYMENT_KEYSET: ListKeyset<PaymentIntentRow, Prisma.PaymentIntentWhereInput> = timestampIdKeyset(
	(row: PaymentIntentRow) => ({ at: Number(row.createdAt), id: row.id }),
	({ at, id }): Prisma.PaymentIntentWhereInput => ({ OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: id } }] }),
);

/** One page of a tenant's payments, newest first, filtered by status and gateway (offset or keyset, like every list). */
export async function listTenantPayments(db: Prisma.TransactionClient, tenantId: string, query: PaymentIntentListQuery): Promise<PaginatedServiceResult<PaymentIntent>> {
	const where: Prisma.PaymentIntentWhereInput = {
		AND: [
			{ tenantId, isDeleted: false },
			...fieldWhere(toPrismaEqualityFilter(query.filter?.status), (status): Prisma.PaymentIntentWhereInput => ({ status })),
			...fieldWhere(toPrismaEqualityFilter(query.filter?.provider), (provider): Prisma.PaymentIntentWhereInput => ({ provider })),
		],
	};
	const page = await fetchListPage(query, {
		where,
		order: buildListOrder(paymentIntentListQuery.resolveSort(query.sort), {
			columns: PAYMENT_COLUMNS,
			tieBreaker: (direction): Prisma.PaymentIntentOrderByWithRelationInput => ({ id: direction }),
		}),
		keyset: PAYMENT_KEYSET,
		and: (left, right): Prisma.PaymentIntentWhereInput => ({ AND: [left, right] }),
		count: (filter): Promise<number> => db.paymentIntent.count({ where: filter }),
		findMany: (args): Promise<PaymentIntentRow[]> => db.paymentIntent.findMany(args),
	});
	return toPaginatedServiceResult(mapListResult(page, toPaymentIntent), query);
}
