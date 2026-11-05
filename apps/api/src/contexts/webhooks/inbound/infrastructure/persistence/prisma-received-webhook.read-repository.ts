// ============================================
// prisma-received-webhook.read-repository.ts - The admin viewer's reads (ADR 081)
// ============================================
// `ReceivedWebhook` SELECT is bypass-only, so both reads run as `webhooks.inbound.read` (that table
// alone) after the route's AUDIT_LOG check. One count + one page query per list request, whatever
// the page size (no N+1).

import { Injectable } from "@nestjs/common";
import type { Prisma, ReceivedWebhook as ReceivedWebhookRow } from "@prisma/client";
import {
	epochMs,
	receivedWebhookListQuery,
	ReceivedWebhookDetailSchema,
	ReceivedWebhookHeadersSchema,
	ReceivedWebhookSummarySchema,
	type PaginatedServiceResult,
	type ReceivedWebhookDetail,
	type ReceivedWebhookListQuery,
	type ReceivedWebhookListSortField,
	type ReceivedWebhookSummary,
} from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import { fetchListPage, mapListResult, toPaginatedServiceResult } from "../../../../../platform/infrastructure/persistence/list-page";
import { timestampIdKeyset, type ListKeyset } from "../../../../../platform/infrastructure/persistence/list-query/keyset-cursor";
import { buildListOrder, type ListOrder, type SortColumns } from "../../../../../platform/infrastructure/persistence/list-query/list-order";
import { fieldWhere, toPrismaComparableFilter, toPrismaEqualityFilter } from "../../../../../platform/infrastructure/persistence/list-query/prisma-filter";
import { PrismaReadExecutor } from "../../../../../platform/infrastructure/unit-of-work/prisma-read-executor";
import { TenantTransactionService } from "../../../../../prisma/tenant-transaction.service";
import type { ReceivedWebhookReadPort } from "../../application/ports/received-webhook-read.port";
import { WEBHOOKS_INBOUND_READ_OPERATION } from "../../application/ports/webhooks-inbound.tokens";

const SORT_COLUMNS: SortColumns<ReceivedWebhookListSortField, Prisma.ReceivedWebhookOrderByWithRelationInput> = {
	receivedAt: (direction) => ({ receivedAt: direction }),
};

/** Keyset for the default order (`receivedAt desc, id desc`). */
const LIST_KEYSET: ListKeyset<ReceivedWebhookRow, Prisma.ReceivedWebhookWhereInput> = timestampIdKeyset(
	(row: ReceivedWebhookRow) => ({ at: Number(row.receivedAt), id: row.id }),
	({ at, id }): Prisma.ReceivedWebhookWhereInput => ({ OR: [{ receivedAt: { lt: at } }, { receivedAt: at, id: { lt: id } }] }),
);

/** The filter AST + search (delivery id / event / correlation id), one explicit column per whitelisted field. */
export function buildReceivedWebhookListWhere(query: ReceivedWebhookListQuery): Prisma.ReceivedWebhookWhereInput {
	const filter = query.filter;
	return {
		AND: [
			...fieldWhere(toPrismaEqualityFilter(filter?.provider), (provider) => ({ provider })),
			...fieldWhere(toPrismaEqualityFilter(filter?.outcome), (outcome) => ({ outcome })),
			...fieldWhere(toPrismaEqualityFilter(filter?.verification), (verification) => ({ verification })),
			...fieldWhere(toPrismaComparableFilter(filter?.receivedAt), (receivedAt) => ({ receivedAt })),
			...(query.search !== undefined
				? [
						{
							OR: [
								{ providerDeliveryId: { contains: query.search, mode: "insensitive" } },
								{ eventType: { contains: query.search, mode: "insensitive" } },
								{ correlationId: { equals: query.search } },
							],
						} satisfies Prisma.ReceivedWebhookWhereInput,
					]
				: []),
		],
	};
}

export function buildReceivedWebhookListOrder(query: ReceivedWebhookListQuery): ListOrder<Prisma.ReceivedWebhookOrderByWithRelationInput> {
	return buildListOrder(receivedWebhookListQuery.resolveSort(query.sort), { columns: SORT_COLUMNS, tieBreaker: (direction) => ({ id: direction }) });
}

function nullableEpochMs(value: bigint | null): number | null {
	return value === null ? null : epochMs(Number(value));
}

/** Row → the list contract. */
export function toReceivedWebhookSummary(row: ReceivedWebhookRow): ReceivedWebhookSummary {
	return ReceivedWebhookSummarySchema.parse({
		id: row.id,
		provider: row.provider,
		providerDeliveryId: row.providerDeliveryId,
		eventType: row.eventType,
		verification: row.verification,
		outcome: row.outcome,
		httpStatus: row.httpStatus,
		attempts: row.attempts,
		duplicateCount: row.duplicateCount,
		receivedAt: epochMs(Number(row.receivedAt)),
		lastReceivedAt: epochMs(Number(row.lastReceivedAt)),
		completedAt: nullableEpochMs(row.completedAt),
		correlationId: row.correlationId,
	});
}

/** Row → the detail contract. Stored headers are re-validated: a row is never trusted to be well-formed. */
export function toReceivedWebhookDetail(row: ReceivedWebhookRow): ReceivedWebhookDetail {
	return ReceivedWebhookDetailSchema.parse({
		...toReceivedWebhookSummary(row),
		payloadSha256: row.payloadSha256,
		payloadBytes: row.payloadBytes,
		headers: ReceivedWebhookHeadersSchema.parse(row.headers),
		errorSummary: row.errorSummary,
		claimedAt: nullableEpochMs(row.claimedAt),
	});
}

@Injectable()
export class PrismaReceivedWebhookReadRepository implements ReceivedWebhookReadPort {
	private readonly reads: PrismaReadExecutor<Prisma.TransactionClient>;

	public constructor(transactions: TenantTransactionService) {
		this.reads = new PrismaReadExecutor(transactions);
	}

	public async list(actor: ActorContext, query: ReceivedWebhookListQuery): Promise<PaginatedServiceResult<ReceivedWebhookSummary>> {
		const result = await this.reads.readAsSystemOperation(WEBHOOKS_INBOUND_READ_OPERATION, actor, async (db) =>
			fetchListPage(query, {
				where: buildReceivedWebhookListWhere(query),
				order: buildReceivedWebhookListOrder(query),
				keyset: LIST_KEYSET,
				and: (left, right) => ({ AND: [left, right] }),
				count: (where) => db.receivedWebhook.count({ where }),
				findMany: (args) => db.receivedWebhook.findMany(args),
			}),
		);
		return toPaginatedServiceResult(mapListResult(result, toReceivedWebhookSummary), query);
	}

	public async findById(actor: ActorContext, id: string): Promise<ReceivedWebhookDetail | null> {
		const row = await this.reads.readAsSystemOperation(WEBHOOKS_INBOUND_READ_OPERATION, actor, async (db) => db.receivedWebhook.findUnique({ where: { id } }));
		return row === null ? null : toReceivedWebhookDetail(row);
	}
}
