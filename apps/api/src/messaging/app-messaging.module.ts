import { DynamicModule, Module } from "@nestjs/common";

import { registerMessagingInfrastructureModule, resolveMessagingOptions } from "@workspace/messaging/nest";

import { OutboxQueueModule } from "../infrastructure/outbox/outbox-queue.module";

import { APP_MESSAGING_CONFIG } from "./app-messaging.config";

/**
 * Application messaging entry point.
 * Generic brokers live in `@workspace/messaging`; domain processors stay in feature modules.
 */
@Module({})
export class AppMessagingModule {
	public static register(): DynamicModule {
		const resolved = resolveMessagingOptions(APP_MESSAGING_CONFIG);
		const messaging = registerMessagingInfrastructureModule(APP_MESSAGING_CONFIG);
		const imports = resolved.redisUrl !== undefined ? [messaging, OutboxQueueModule] : [messaging];

		return {
			module: AppMessagingModule,
			global: true,
			imports,
			exports: imports,
		};
	}
}
