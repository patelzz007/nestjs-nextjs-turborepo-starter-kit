import { DynamicModule, Module } from "@nestjs/common";

import { registerBullMqInfrastructureModule } from "./bullmq/bullmq-infrastructure.module";
import { registerKafkaInfrastructureModule } from "./kafka/kafka-infrastructure.module";
import { type MessagingModuleOptions, resolveMessagingOptions } from "./messaging-options";
import { registerRabbitMqInfrastructureModule } from "./rabbitmq/rabbitmq-infrastructure.module";
import { registerRedisInfrastructureModule } from "./redis/redis-infrastructure.module";
import { MESSAGING_OPTIONS } from "./tokens";

export { BullMqHealthIndicator, BullMqInfrastructureModule, registerBullMqInfrastructureModule } from "./bullmq/bullmq-infrastructure.module";
export { KafkaInfrastructureModule, registerKafkaInfrastructureModule } from "./kafka/kafka-infrastructure.module";
export { DisabledKafkaProducerService, KafkaHealthIndicator, KafkaProducerService } from "./kafka/kafka-producer.service";
export { RabbitMqInfrastructureModule, registerRabbitMqInfrastructureModule } from "./rabbitmq/rabbitmq-infrastructure.module";
export { DisabledRabbitMqService, RabbitMqHealthIndicator, RabbitMqService } from "./rabbitmq/rabbitmq.service";
export { RedisInfrastructureModule, registerRedisInfrastructureModule } from "./redis/redis-infrastructure.module";
export { REDIS_PUBLISHER, REDIS_SUBSCRIBER } from "./tokens";
export { MESSAGING_OPTIONS, MESSAGING_QUEUE_NAMES } from "./tokens";
export { type MessagingModuleOptions, type ResolvedMessagingOptions, resolveMessagingOptions } from "./messaging-options";

@Module({})
export class MessagingInfrastructureModule {}

/**
 * One-call Nest wiring for Redis, BullMQ, Kafka, and RabbitMQ (placeholder).
 * Pass queue names + client id — no domain logic lives in this package.
 */
export function registerMessagingInfrastructureModule(options: MessagingModuleOptions): DynamicModule {
	const resolved = resolveMessagingOptions(options);

	const imports = [
		registerRedisInfrastructureModule(resolved),
		registerBullMqInfrastructureModule(resolved),
		registerKafkaInfrastructureModule(resolved),
		registerRabbitMqInfrastructureModule(resolved),
	];

	return {
		module: MessagingInfrastructureModule,
		global: true,
		providers: [
			{
				provide: MESSAGING_OPTIONS,
				useValue: resolved,
			},
		],
		imports,
		exports: [MESSAGING_OPTIONS, ...imports],
	};
}
