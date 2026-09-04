import { DynamicModule, Module } from "@nestjs/common";

import { type ResolvedMessagingOptions } from "../messaging-options";

import { DisabledKafkaProducerService, KafkaHealthIndicator, KafkaProducerService } from "./kafka-producer.service";

@Module({})
export class KafkaInfrastructureModule {}

export function registerKafkaInfrastructureModule(options: ResolvedMessagingOptions): DynamicModule {
	if (options.kafkaBrokers === undefined) {
		return {
			module: KafkaInfrastructureModule,
			global: true,
			providers: [DisabledKafkaProducerService, { provide: KafkaProducerService, useExisting: DisabledKafkaProducerService }],
			exports: [KafkaProducerService],
		};
	}

	return {
		module: KafkaInfrastructureModule,
		global: true,
		providers: [KafkaProducerService, KafkaHealthIndicator],
		exports: [KafkaProducerService, KafkaHealthIndicator],
	};
}
