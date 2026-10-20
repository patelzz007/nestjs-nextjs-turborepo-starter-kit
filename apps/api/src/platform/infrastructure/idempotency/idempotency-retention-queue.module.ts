import { Module } from "@nestjs/common";

import { IdempotencyCoreModule } from "./idempotency-core.module";
import { IdempotencyRetentionProcessor, IdempotencyRetentionScheduler } from "./idempotency-retention.processor";

/** Retention via ONE cluster-wide BullMQ job scheduler (Redis configured — always in production). */
@Module({
	imports: [IdempotencyCoreModule],
	providers: [IdempotencyRetentionScheduler, IdempotencyRetentionProcessor],
})
export class IdempotencyRetentionQueueModule {}
