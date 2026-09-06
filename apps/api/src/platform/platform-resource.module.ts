import { Module } from "@nestjs/common";

import { PlatformOutboxService } from "../infrastructure/outbox/platform-outbox.service";

import { PlatformResourceAuditService, PlatformResourceIdempotencyService, PlatformResourceMutationService } from "./platform-resource.services";

@Module({
	providers: [PlatformResourceAuditService, PlatformResourceIdempotencyService, PlatformResourceMutationService, PlatformOutboxService],
	exports: [PlatformResourceAuditService, PlatformResourceIdempotencyService, PlatformResourceMutationService, PlatformOutboxService],
})
export class PlatformResourceModule {}
