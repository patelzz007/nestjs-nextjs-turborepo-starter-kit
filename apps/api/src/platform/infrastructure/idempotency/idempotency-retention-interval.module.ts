import { Module } from "@nestjs/common";

import { IdempotencyCoreModule } from "./idempotency-core.module";
import { IdempotencyRetentionIntervalScheduler } from "./idempotency-retention-interval.scheduler";

/** Retention via an in-process interval (no Redis: development / single instance). */
@Module({
	imports: [IdempotencyCoreModule],
	providers: [IdempotencyRetentionIntervalScheduler],
})
export class IdempotencyRetentionIntervalModule {}
