import { Module } from "@nestjs/common";
import { EventBus } from "@nestjs/cqrs";
import type { Prisma } from "@prisma/client";

import { InTransactionEventRegistry } from "../../application/events/in-transaction-event-registry";
import { IntegrationEventMapperRegistry } from "../../application/events/integration-event-mapper";
import { OutboxModule } from "../outbox/outbox.module";
import { PlatformOutboxService } from "../outbox/platform-outbox.service";
import type { AfterCommitPublisher } from "./after-commit-publisher";
import { TransactionalEventDispatcher } from "./transactional-event-dispatcher";

/** After-commit publisher token. The Nest `EventBus` is the adapter. */
export const AFTER_COMMIT_PUBLISHER = Symbol("AFTER_COMMIT_PUBLISHER");

@Module({
	imports: [OutboxModule],
	providers: [
		{
			provide: InTransactionEventRegistry,
			useFactory: (): InTransactionEventRegistry<Prisma.TransactionClient> => new InTransactionEventRegistry<Prisma.TransactionClient>(),
		},
		{
			provide: IntegrationEventMapperRegistry,
			useFactory: (): IntegrationEventMapperRegistry => new IntegrationEventMapperRegistry(),
		},
		{
			provide: TransactionalEventDispatcher,
			inject: [InTransactionEventRegistry, IntegrationEventMapperRegistry, PlatformOutboxService],
			useFactory: (
				handlers: InTransactionEventRegistry<Prisma.TransactionClient>,
				mappers: IntegrationEventMapperRegistry,
				outbox: PlatformOutboxService,
			): TransactionalEventDispatcher<Prisma.TransactionClient> => new TransactionalEventDispatcher(handlers, mappers, outbox),
		},
		{
			provide: AFTER_COMMIT_PUBLISHER,
			inject: [EventBus],
			useFactory: (eventBus: EventBus): AfterCommitPublisher => ({
				publish(event): Promise<void> {
					eventBus.publish(event);
					return Promise.resolve();
				},
			}),
		},
	],
	exports: [InTransactionEventRegistry, IntegrationEventMapperRegistry, TransactionalEventDispatcher, AFTER_COMMIT_PUBLISHER],
})
export class UnitOfWorkModule {}
