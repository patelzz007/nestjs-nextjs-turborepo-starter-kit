import type { Prisma, WebhookEndpoint as WebhookEndpointRow } from "@prisma/client";
import {
	epochMs,
	WebhookEventTypeSchema,
	webhookDeliveryListQuery,
	webhookEndpointListQuery,
	type PaginatedServiceResult,
	type WebhookDeliveryListQuery,
	type WebhookDeliveryListSortField,
	type WebhookEndpointListSortField,
	type WebhookDeliverySummary,
	type WebhookEndpointListQuery,
	type WebhookEndpointSummary,
} from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import { fetchListPage, mapListResult, toPaginatedServiceResult } from "../../../../../platform/infrastructure/persistence/list-page";
import { timestampIdKeyset } from "../../../../../platform/infrastructure/persistence/list-query/keyset-cursor";
import { buildListOrder, type SortColumns } from "../../../../../platform/infrastructure/persistence/list-query/list-order";
import { fieldWhere, toPrismaEqualityFilter } from "../../../../../platform/infrastructure/persistence/list-query/prisma-filter";
import type { PrismaReadExecutor } from "../../../../../platform/infrastructure/unit-of-work/prisma-read-executor";
import type { WebhooksReadPort } from "../../application/ports/webhooks-read.port";
import { webhookEndpointSummaryOf } from "../../application/services/webhook-endpoint-summary";
import { webhookEndpointOf } from "./prisma-webhooks.repositories";

const DELIVERY_WITH_URL = { endpoint: { select: { url: true } } } satisfies Prisma.WebhookDeliveryInclude;
type DeliveryWithUrl = Prisma.WebhookDeliveryGetPayload<{ include: typeof DELIVERY_WITH_URL }>;

const ENDPOINT_SORT_COLUMNS: SortColumns<WebhookEndpointListSortField, Prisma.WebhookEndpointOrderByWithRelationInput> = {
	createdAt: (direction) => ({ createdAt: direction }),
};
const DELIVERY_SORT_COLUMNS: SortColumns<WebhookDeliveryListSortField, Prisma.WebhookDeliveryOrderByWithRelationInput> = {
	createdAt: (direction) => ({ createdAt: direction }),
};

const ENDPOINT_KEYSET = timestampIdKeyset(
	(row: WebhookEndpointRow) => ({ at: Number(row.createdAt), id: row.id }),
	({ at, id }): Prisma.WebhookEndpointWhereInput => ({ OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: id } }] }),
);
const DELIVERY_KEYSET = timestampIdKeyset(
	(row: DeliveryWithUrl) => ({ at: Number(row.createdAt), id: row.id }),
	({ at, id }): Prisma.WebhookDeliveryWhereInput => ({ OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: id } }] }),
);

function nullableEpoch(value: bigint | null): ReturnType<typeof epochMs> | null {
	return value === null ? null : epochMs(Number(value));
}

export function webhookDeliverySummaryOf(row: DeliveryWithUrl): WebhookDeliverySummary {
	return {
		id: row.id,
		endpointId: row.endpointId,
		endpointUrl: row.endpoint.url,
		eventId: row.eventId,
		eventType: WebhookEventTypeSchema.parse(row.eventType),
		status: row.status,
		attempts: row.attempts,
		nextAttemptAt: nullableEpoch(row.nextAttemptAt),
		lastAttemptAt: nullableEpoch(row.lastAttemptAt),
		lastStatusCode: row.lastStatusCode,
		lastError: row.lastError,
		lastDurationMs: row.lastDurationMs,
		deliveredAt: nullableEpoch(row.deliveredAt),
		createdAt: epochMs(Number(row.createdAt)),
	};
}

/** Endpoints and the delivery log, read under the member's RLS session (tenant isolation is the database's too). */
export class PrismaWebhooksReadRepository implements WebhooksReadPort {
	public constructor(private readonly reads: PrismaReadExecutor<Prisma.TransactionClient>) {}

	public listEndpoints(actor: ActorContext, tenantId: string, query: WebhookEndpointListQuery): Promise<PaginatedServiceResult<WebhookEndpointSummary>> {
		return this.reads.read(actor, async (db: Prisma.TransactionClient): Promise<PaginatedServiceResult<WebhookEndpointSummary>> => {
			const page = await fetchListPage(query, {
				where: { AND: [{ tenantId, isDeleted: false }, ...fieldWhere(toPrismaEqualityFilter(query.filter?.status), (status) => ({ status }))] },
				order: buildListOrder(webhookEndpointListQuery.resolveSort(query.sort), {
					columns: ENDPOINT_SORT_COLUMNS,
					tieBreaker: (direction): Prisma.WebhookEndpointOrderByWithRelationInput => ({ id: direction }),
				}),
				keyset: ENDPOINT_KEYSET,
				and: (left: Prisma.WebhookEndpointWhereInput, right: Prisma.WebhookEndpointWhereInput): Prisma.WebhookEndpointWhereInput => ({ AND: [left, right] }),
				count: (where: Prisma.WebhookEndpointWhereInput): Promise<number> => db.webhookEndpoint.count({ where }),
				findMany: (args): Promise<WebhookEndpointRow[]> => db.webhookEndpoint.findMany(args),
			});
			return toPaginatedServiceResult(
				mapListResult(page, (row: WebhookEndpointRow): WebhookEndpointSummary => webhookEndpointSummaryOf(webhookEndpointOf(row).snapshot)),
				query,
			);
		});
	}

	public findEndpoint(actor: ActorContext, tenantId: string, endpointId: string): Promise<WebhookEndpointSummary | null> {
		return this.reads.read(actor, async (db: Prisma.TransactionClient): Promise<WebhookEndpointSummary | null> => {
			const row = await db.webhookEndpoint.findFirst({ where: { id: endpointId, tenantId, isDeleted: false } });
			return row === null ? null : webhookEndpointSummaryOf(webhookEndpointOf(row).snapshot);
		});
	}

	public listDeliveries(actor: ActorContext, tenantId: string, query: WebhookDeliveryListQuery): Promise<PaginatedServiceResult<WebhookDeliverySummary>> {
		return this.reads.read(actor, async (db: Prisma.TransactionClient): Promise<PaginatedServiceResult<WebhookDeliverySummary>> => {
			const page = await fetchListPage(query, {
				where: {
					AND: [
						{ tenantId, isDeleted: false },
						...fieldWhere(toPrismaEqualityFilter(query.filter?.status), (status) => ({ status })),
						...fieldWhere(toPrismaEqualityFilter(query.filter?.eventType), (eventType) => ({ eventType })),
						...fieldWhere(toPrismaEqualityFilter(query.filter?.endpointId), (endpointId) => ({ endpointId })),
					],
				},
				order: buildListOrder(webhookDeliveryListQuery.resolveSort(query.sort), {
					columns: DELIVERY_SORT_COLUMNS,
					tieBreaker: (direction): Prisma.WebhookDeliveryOrderByWithRelationInput => ({ id: direction }),
				}),
				keyset: DELIVERY_KEYSET,
				and: (left: Prisma.WebhookDeliveryWhereInput, right: Prisma.WebhookDeliveryWhereInput): Prisma.WebhookDeliveryWhereInput => ({ AND: [left, right] }),
				count: (where: Prisma.WebhookDeliveryWhereInput): Promise<number> => db.webhookDelivery.count({ where }),
				findMany: (args): Promise<DeliveryWithUrl[]> => db.webhookDelivery.findMany({ ...args, include: DELIVERY_WITH_URL }),
			});
			return toPaginatedServiceResult(mapListResult(page, webhookDeliverySummaryOf), query);
		});
	}

	public findDelivery(actor: ActorContext, tenantId: string, deliveryId: string): Promise<WebhookDeliverySummary | null> {
		return this.reads.read(actor, async (db: Prisma.TransactionClient): Promise<WebhookDeliverySummary | null> => {
			const row = await db.webhookDelivery.findFirst({ where: { id: deliveryId, tenantId, isDeleted: false }, include: DELIVERY_WITH_URL });
			return row === null ? null : webhookDeliverySummaryOf(row);
		});
	}
}
