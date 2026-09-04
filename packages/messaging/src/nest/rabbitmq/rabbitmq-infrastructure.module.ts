import { DynamicModule, Module } from "@nestjs/common";

import { type ResolvedMessagingOptions } from "../messaging-options";

import { DisabledRabbitMqService, RabbitMqHealthIndicator, RabbitMqService } from "./rabbitmq.service";

@Module({})
export class RabbitMqInfrastructureModule {}

export function registerRabbitMqInfrastructureModule(options: ResolvedMessagingOptions): DynamicModule {
	if (options.rabbitmqUrl === undefined) {
		return {
			module: RabbitMqInfrastructureModule,
			global: true,
			providers: [DisabledRabbitMqService, { provide: RabbitMqService, useExisting: DisabledRabbitMqService }, RabbitMqHealthIndicator],
			exports: [RabbitMqService, RabbitMqHealthIndicator],
		};
	}

	return {
		module: RabbitMqInfrastructureModule,
		global: true,
		providers: [RabbitMqService, RabbitMqHealthIndicator],
		exports: [RabbitMqService, RabbitMqHealthIndicator],
	};
}
