import { Module, type DynamicModule } from "@nestjs/common";

import { getApiConfig } from "../../config/api-config";
import { IdempotencyCoreModule } from "./idempotency-core.module";
import { IdempotencyRetentionIntervalModule } from "./idempotency-retention-interval.module";
import { IdempotencyRetentionQueueModule } from "./idempotency-retention-queue.module";

/** The retention strategy for the validated config — retention ALWAYS runs, with or without Redis. */
function retentionModule(): typeof IdempotencyRetentionQueueModule | typeof IdempotencyRetentionIntervalModule {
	return getApiConfig().messaging.redisUrl !== undefined ? IdempotencyRetentionQueueModule : IdempotencyRetentionIntervalModule;
}

/**
 * `Idempotency-Key` support (docs/technical/api/routes.md → "Idempotency"). Retention
 * wiring is decided from the validated config (parsed by main.ts first), like
 * every other queue module. `IdempotencyInterceptor` is registered as an
 * `APP_INTERCEPTOR` in `AppModule`.
 */
@Module({})
export class IdempotencyModule {
	public static register(): DynamicModule {
		return { module: IdempotencyModule, imports: [IdempotencyCoreModule, retentionModule()], exports: [IdempotencyCoreModule] };
	}
}
