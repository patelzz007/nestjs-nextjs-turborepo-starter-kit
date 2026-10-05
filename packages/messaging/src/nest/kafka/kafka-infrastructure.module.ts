import { DynamicModule, Module } from "@nestjs/common";

import { type ResolvedMessagingOptions } from "../messaging-options";

import { KafkaHealthIndicator, KafkaProducerService } from "./kafka-producer.service";

@Module({})
export class KafkaInfrastructureModule {}

export function registerKafkaInfrastructureModule(options: ResolvedMessagingOptions): DynamicModule {
	if (options.kafkaBrokers === undefined) {
		return {
			module: KafkaInfrastructureModule,
			global: true,
			// Without brokers the producer starts (and stays) "disabled": publish refuses, ping reports it, lifecycle is a no-op.
			providers: [KafkaProducerService],
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
