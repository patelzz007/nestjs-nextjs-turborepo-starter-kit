// ============================================
// prisma-received-webhook.store.ts - The received-webhook log's writes (ADR 081)
// ============================================
// `ReceivedWebhook` is bypass-only platform plumbing (prisma/rls/57-inbound-webhooks.sql), reached only
// through the allowlisted system operation `webhooks.inbound.record`. A claim is settled in one statement:
// INSERT … ON CONFLICT (provider, "providerDeliveryId") DO UPDATE … WHERE <the delivery may be processed
// again>, so two instances receiving the same delivery at once never both process it — the second waits
// for the first's claim to commit, then finds it PROCESSING and is answered "in flight".

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { TenantTransactionService } from "../../../../../prisma/tenant-transaction.service";
import type {
	DeliveryClaim,
	DeliveryClaimRequest,
	DeliveryCompletion,
	ReceivedWebhookStorePort,
	RefusedWebhookRecord,
} from "../../application/ports/received-webhook-store.port";
import { WEBHOOKS_INBOUND_RECORD_OPERATION } from "../../application/ports/webhooks-inbound.tokens";

const ClaimedRowsSchema = z.array(z.object({ id: z.string() }));
const ExistingRowsSchema = z.array(z.object({ id: z.string(), outcome: z.string() }));
const DeletedCountSchema = z.number().int().nonnegative();

/** The outcomes a redelivery may process again: the owner failed, or refused a body it could not read. */
const RETRYABLE_OUTCOMES: readonly string[] = ["FAILED", "REJECTED"];
const PROCESSING_OUTCOME = "PROCESSING";

@Injectable()
export class PrismaReceivedWebhookStore implements ReceivedWebhookStorePort {
	public constructor(private readonly tenantTx: TenantTransactionService) {}

	public async recordRefused(record: RefusedWebhookRecord): Promise<void> {
		await this.tenantTx.withSystemOperation({ operation: WEBHOOKS_INBOUND_RECORD_OPERATION, reason: "Log a refused webhook request", actorUserId: null }, async (tx) =>
			tx.receivedWebhook.create({
				data: {
					provider: record.provider,
					providerDeliveryId: null,
					eventType: null,
					verification: record.verification,
					outcome: "REJECTED",
					httpStatus: record.httpStatus,
					payloadSha256: record.payloadSha256,
					payloadBytes: record.payloadBytes,
					headers: record.headers,
					correlationId: record.correlationId,
					errorSummary: record.errorSummary,
					receivedAt: BigInt(record.receivedAt),
					lastReceivedAt: BigInt(record.receivedAt),
					completedAt: BigInt(record.receivedAt),
				},
				select: { id: true },
			}),
		);
	}

	public async claim(request: DeliveryClaimRequest): Promise<DeliveryClaim> {
		return this.tenantTx.withSystemOperation(
			{ operation: WEBHOOKS_INBOUND_RECORD_OPERATION, reason: "Claim a verified webhook delivery", actorUserId: null },
			async (tx): Promise<DeliveryClaim> => {
				const receivedAt = BigInt(request.receivedAt);
				const claimed = ClaimedRowsSchema.parse(
					await tx.$queryRaw(Prisma.sql`
						INSERT INTO public."ReceivedWebhook" (
							id, provider, "providerDeliveryId", "eventType", verification, outcome, "payloadSha256", "payloadBytes",
							headers, "correlationId", "receivedAt", "lastReceivedAt", "claimedAt"
						)
						VALUES (
							uuidv7()::text, ${request.provider}::"ReceivedWebhookProvider", ${request.providerDeliveryId}, ${request.eventType},
							'VALID'::"ReceivedWebhookVerification", 'PROCESSING'::"ReceivedWebhookOutcome", ${request.payloadSha256}, ${request.payloadBytes},
							${JSON.stringify(request.headers)}::jsonb, ${request.correlationId}, ${receivedAt}, ${receivedAt}, ${receivedAt}
						)
						ON CONFLICT (provider, "providerDeliveryId") DO UPDATE
							SET outcome = 'PROCESSING'::"ReceivedWebhookOutcome",
								attempts = "ReceivedWebhook".attempts + 1,
								"lastReceivedAt" = EXCLUDED."lastReceivedAt",
								"claimedAt" = EXCLUDED."claimedAt",
								"correlationId" = EXCLUDED."correlationId",
								"payloadSha256" = EXCLUDED."payloadSha256",
								"payloadBytes" = EXCLUDED."payloadBytes",
								headers = EXCLUDED.headers,
								"httpStatus" = NULL,
								"errorSummary" = NULL,
								"completedAt" = NULL
							WHERE "ReceivedWebhook".outcome::text = ANY(${[...RETRYABLE_OUTCOMES]}::text[])
								OR ("ReceivedWebhook".outcome = 'PROCESSING'::"ReceivedWebhookOutcome" AND "ReceivedWebhook"."claimedAt" < ${BigInt(request.staleClaimBefore)})
						RETURNING id`),
				);
				const [row] = claimed;
				if (row !== undefined) {
					return { kind: "claimed", id: row.id };
				}
				// Someone holds or has answered the delivery: count this redelivery on its row.
				const existing = ExistingRowsSchema.parse(
					await tx.$queryRaw(Prisma.sql`
						UPDATE public."ReceivedWebhook"
							SET "duplicateCount" = "duplicateCount" + 1, "lastReceivedAt" = GREATEST("lastReceivedAt", ${receivedAt})
							WHERE provider = ${request.provider}::"ReceivedWebhookProvider" AND "providerDeliveryId" = ${request.providerDeliveryId}
						RETURNING id, outcome::text AS outcome`),
				);
				const [held] = existing;
				if (held === undefined) {
					// Unreachable: the conflict above proves the row exists (rows are only pruned weeks later).
					throw new Error(`Received webhook ${request.provider} ${String(request.providerDeliveryId)} conflicted but was not found`);
				}
				return { kind: held.outcome === PROCESSING_OUTCOME ? "in_flight" : "duplicate", id: held.id };
			},
		);
	}

	public async complete(completion: DeliveryCompletion): Promise<void> {
		await this.tenantTx.withSystemOperation({ operation: WEBHOOKS_INBOUND_RECORD_OPERATION, reason: "Record a webhook delivery's outcome", actorUserId: null }, async (tx) =>
			tx.receivedWebhook.updateMany({
				where: { id: completion.id },
				data: {
					outcome: completion.outcome,
					httpStatus: completion.httpStatus,
					errorSummary: completion.errorSummary,
					completedAt: BigInt(completion.completedAt),
					...(completion.eventType === null ? {} : { eventType: completion.eventType }),
				},
			}),
		);
	}

	public async prune(beforeMs: number): Promise<number> {
		return this.tenantTx.withSystemOperation(
			{ operation: WEBHOOKS_INBOUND_RECORD_OPERATION, reason: "Prune received webhooks past their retention", actorUserId: null },
			async (tx) => DeletedCountSchema.parse((await tx.receivedWebhook.deleteMany({ where: { lastReceivedAt: { lt: BigInt(beforeMs) } } })).count),
		);
	}
}
