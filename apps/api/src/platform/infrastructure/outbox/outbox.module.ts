import { Module } from "@nestjs/common";

import { OutboxDispatchRepository } from "./outbox-dispatch.repository";
import { OutboxEmailRouteRegistry } from "./outbox-email-relay";
import { OutboxEmailRelayService } from "./outbox-email-relay.service";
import { PlatformOutboxService } from "./platform-outbox.service";

/**
 * Transactional outbox. Domain modules import this and call
 * `PlatformOutboxService.enqueueInTransaction(tx, event)` inside the
 * transaction that performs the domain change. The email route (ADR 060):
 * notifications registers its hand-off target on {@link OutboxEmailRouteRegistry}
 * and nudges {@link OutboxEmailRelayService} after commit.
 */
@Module({
	providers: [
		PlatformOutboxService,
		OutboxDispatchRepository,
		{ provide: OutboxEmailRouteRegistry, useFactory: (): OutboxEmailRouteRegistry => new OutboxEmailRouteRegistry() },
		OutboxEmailRelayService,
	],
	exports: [PlatformOutboxService, OutboxDispatchRepository, OutboxEmailRouteRegistry, OutboxEmailRelayService],
})
export class OutboxModule {}
