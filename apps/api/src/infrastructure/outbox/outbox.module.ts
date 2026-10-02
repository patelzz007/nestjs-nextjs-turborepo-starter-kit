import { Module } from "@nestjs/common";

import { OutboxDispatchRepository } from "./outbox-dispatch.repository";
import { PlatformOutboxService } from "./platform-outbox.service";

/**
 * Transactional outbox. Domain modules import this and call
 * `PlatformOutboxService.enqueueInTransaction(tx, event)` inside the
 * transaction that performs the domain change.
 */
@Module({
	providers: [PlatformOutboxService, OutboxDispatchRepository],
	exports: [PlatformOutboxService, OutboxDispatchRepository],
})
export class OutboxModule {}
