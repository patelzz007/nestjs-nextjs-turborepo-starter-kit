import { Module } from "@nestjs/common";

import { IdempotencyRecordRepository } from "./idempotency-record.repository";
import { IdempotencyRetentionProcessor, IdempotencyRetentionScheduler } from "./idempotency-retention.processor";
import { IdempotencyRetentionService } from "./idempotency-retention.service";

/**
 * BullMQ scheduler + worker for idempotency-record retention (requires Redis —
 * imported by `PlatformResourceModule` only when `REDIS_URL` is set, like
 * every other BullMQ module). Without Redis no retention runs; expired rows
 * stay harmless (they are taken over in place) until Redis is configured.
 */
@Module({
	providers: [IdempotencyRecordRepository, IdempotencyRetentionService, IdempotencyRetentionScheduler, IdempotencyRetentionProcessor],
})
export class IdempotencyRetentionQueueModule {}
