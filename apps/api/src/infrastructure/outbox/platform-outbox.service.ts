import { Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import {
	JsonObjectSchema,
	KafkaTopicSchema,
	OutboxEnqueueInputSchema,
	PlatformEventEnvelopeSchema,
	type KafkaTopic,
	type OutboxEnqueueInput,
	type PlatformEventEnvelope,
} from "@workspace/shared";

import { CorrelationContextService } from "../../common/context/correlation-context.service";
import { PrismaService } from "../../prisma/prisma.service";
import { runWithSystemRlsContext } from "../../prisma/rls-context";

/** The one capability `enqueue` needs from a caller's transaction. */
export interface OutboxWriter {
	readonly outboxEvent: {
		create(args: { data: Prisma.OutboxEventCreateInput }): PromiseLike<{ readonly id: string }>;
	};
}

@Injectable()
export class PlatformOutboxService {
	private readonly logger: Logger = new Logger(PlatformOutboxService.name);

	public constructor(
		private readonly prisma: PrismaService,
		private readonly correlationContext: CorrelationContextService,
	) {}

	public async enqueue(input: OutboxEnqueueInput, tx?: OutboxWriter): Promise<string> {
		const parsed = OutboxEnqueueInputSchema.parse(input);
		const data: Prisma.OutboxEventCreateInput = {
			topic: parsed.topic,
			eventType: parsed.eventType,
			partitionKey: parsed.partitionKey,
			correlationId: parsed.correlationId,
			payload: parsed.payload,
			status: "PENDING",
		};
		if (tx !== undefined) {
			// Inside a caller's transaction the transaction's own RLS session applies.
			const created = await tx.outboxEvent.create({ data });
			return created.id;
		}
		// `outbox_events` is infrastructure (bypass-only under RLS): recording an event is an
		// allowlisted system operation independent of the requesting user's row scope.
		const created = await runWithSystemRlsContext("outbox.enqueue", async () => this.prisma.outboxEvent.create({ data }));
		return created.id;
	}

	public async enqueueEnvelope(topic: KafkaTopic, envelope: PlatformEventEnvelope, partitionKey: string | null, tx?: OutboxWriter): Promise<string> {
		const validated = PlatformEventEnvelopeSchema.parse(envelope);
		const correlationId = validated.correlationId ?? this.correlationContext.get() ?? null;
		const envelopeWithCorrelation: PlatformEventEnvelope = {
			...validated,
			correlationId,
		};
		const payload = JsonObjectSchema.parse(JSON.parse(JSON.stringify(envelopeWithCorrelation)));
		return this.enqueue(
			{
				topic,
				eventType: envelopeWithCorrelation.type,
				partitionKey,
				correlationId,
				payload,
			},
			tx,
		);
	}

	public async processPendingBatch(limit: number): Promise<number> {
		const rows = await this.prisma.outboxEvent.findMany({
			where: { status: "PENDING" },
			orderBy: { createdAt: "asc" },
			take: limit,
		});

		if (rows.length === 0) {
			return 0;
		}

		this.logger.debug(`Outbox sweep claimed ${String(rows.length)} pending row(s) for Kafka publish`);
		return rows.length;
	}

	public async listPendingForPublish(limit: number): Promise<
		readonly {
			readonly id: string;
			readonly topic: KafkaTopic;
			readonly partitionKey: string | null;
			readonly envelope: PlatformEventEnvelope;
		}[]
	> {
		const rows = await this.prisma.outboxEvent.findMany({
			where: { status: "PENDING" },
			orderBy: { createdAt: "asc" },
			take: limit,
		});

		return rows.map((row) => ({
			id: row.id,
			topic: KafkaTopicSchema.parse(row.topic),
			partitionKey: row.partitionKey,
			envelope: PlatformEventEnvelopeSchema.parse(row.payload),
		}));
	}

	public async markPublished(id: string): Promise<void> {
		await this.prisma.outboxEvent.update({
			where: { id },
			data: {
				status: "PUBLISHED",
				publishedAt: Date.now(),
				lastError: null,
			},
		});
	}

	public async markFailed(id: string, errorMessage: string): Promise<void> {
		await this.prisma.outboxEvent.update({
			where: { id },
			data: {
				status: "FAILED",
				lastError: errorMessage.slice(0, 4_000),
				attempts: { increment: 1 },
			},
		});
	}

	public async markRetry(id: string, errorMessage: string): Promise<void> {
		await this.prisma.outboxEvent.update({
			where: { id },
			data: {
				lastError: errorMessage.slice(0, 4_000),
				attempts: { increment: 1 },
			},
		});
	}
}
