import type { Provider } from "@nestjs/common";

import { BullMqHealthIndicator, KafkaHealthIndicator, RabbitMqHealthIndicator } from "@workspace/messaging/nest";

import { MODULE_HEALTH_INDICATORS, type ModuleHealthIndicator } from "./health.service";

/** Aggregates optional infrastructure health indicators into one injected array. */
export const moduleHealthIndicatorsProvider: Provider = {
	provide: MODULE_HEALTH_INDICATORS,
	useFactory: (
		queueIndicator?: BullMqHealthIndicator,
		kafkaIndicator?: KafkaHealthIndicator,
		rabbitIndicator?: RabbitMqHealthIndicator,
	): readonly { readonly name: string; readonly indicator: ModuleHealthIndicator }[] => {
		const indicators: { name: string; indicator: ModuleHealthIndicator }[] = [];
		if (queueIndicator !== undefined) {
			indicators.push({ name: "queue", indicator: queueIndicator });
		}
		if (kafkaIndicator !== undefined) {
			indicators.push({ name: "kafka", indicator: kafkaIndicator });
		}
		if (rabbitIndicator !== undefined) {
			indicators.push({ name: "rabbitmq", indicator: rabbitIndicator });
		}
		return indicators;
	},
	inject: [
		{ token: BullMqHealthIndicator, optional: true },
		{ token: KafkaHealthIndicator, optional: true },
		{ token: RabbitMqHealthIndicator, optional: true },
	],
};
