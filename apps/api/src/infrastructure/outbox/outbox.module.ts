import { Module } from "@nestjs/common";

import { PlatformOutboxService } from "./platform-outbox.service";

@Module({
	providers: [PlatformOutboxService],
	exports: [PlatformOutboxService],
})
export class OutboxModule {}
