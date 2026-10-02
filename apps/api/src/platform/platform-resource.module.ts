import { Module } from "@nestjs/common";

import { getApiConfig } from "../config/api-config";
import { PlatformOutboxService } from "../infrastructure/outbox/platform-outbox.service";

import { IdempotencyRecordRepository } from "./idempotency/idempotency-record.repository";
import { IdempotencyRetentionQueueModule } from "./idempotency/idempotency-retention-queue.module";
import { IdempotencyInterceptor } from "./idempotency/idempotency.interceptor";
import { PlatformResourceAuditService, PlatformResourceIdempotencyService, PlatformResourceMutationService } from "./platform-resource.services";

// Queue wiring is decided at load time from the validated config (parsed by main.ts first),
// exactly like the rewards / storage / notifications queue modules.
const redisUrl: string | undefined = getApiConfig().messaging.redisUrl;
const retentionQueueImports = redisUrl !== undefined ? [IdempotencyRetentionQueueModule] : [];

@Module({
	imports: [...retentionQueueImports],
	providers: [
		PlatformResourceAuditService,
		PlatformResourceIdempotencyService,
		PlatformResourceMutationService,
		PlatformOutboxService,
		IdempotencyRecordRepository,
		IdempotencyInterceptor,
	],
	exports: [PlatformResourceAuditService, PlatformResourceIdempotencyService, PlatformResourceMutationService, PlatformOutboxService, IdempotencyInterceptor],
})
export class PlatformResourceModule {}
