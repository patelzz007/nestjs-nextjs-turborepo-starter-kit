import type { Provider } from "@nestjs/common";

import { BullMqHealthIndicator, KafkaHealthIndicator, RabbitMqHealthIndicator } from "@workspace/messaging/nest";

import { AuthorizationHealthIndicator } from "../authorization/health/authorization.health";

import { MODULE_HEALTH_INDICATORS, type RegisteredModuleHealthIndicator } from "./health.service";

/**
 * Aggregates optional infrastructure health indicators into one injected array.
 *
 * All three messaging indicators are registered as NON-critical: they are
 * reported by `GET /health/ready` and `GET /health/deep`, but a failure does
 * not take the instance out of the load balancer. Jobs and events are
 * buffered (BullMQ retries, transactional outbox) and the request path keeps
 * working, whereas every instance would fail a shared broker probe at the
 * same moment — marking them critical would turn a broker blip into a full
 * API outage (rules/12-observability-and-operations.md → single points of
 * failure). Promote an indicator to `critical: true` only when the API truly
 * cannot serve requests without that dependency.
 *
 * The authorization indicator IS critical: without the system roles every
 * authorization decision fails, and the cause (reference data never loaded)
 * is a broken deploy, not a transient blip — such an instance must not take
 * traffic.
 */
export const moduleHealthIndicatorsProvider: Provider = {
	provide: MODULE_HEALTH_INDICATORS,
	useFactory: (
		authorizationIndicator: AuthorizationHealthIndicator,
		queueIndicator?: BullMqHealthIndicator,
		kafkaIndicator?: KafkaHealthIndicator,
		rabbitIndicator?: RabbitMqHealthIndicator,
	): readonly RegisteredModuleHealthIndicator[] => {
		const indicators: RegisteredModuleHealthIndicator[] = [{ name: "authorization", indicator: authorizationIndicator, critical: true }];
		if (queueIndicator !== undefined) {
			indicators.push({ name: "queue", indicator: queueIndicator, critical: false });
		}
		if (kafkaIndicator !== undefined) {
			indicators.push({ name: "kafka", indicator: kafkaIndicator, critical: false });
		}
		if (rabbitIndicator !== undefined) {
			indicators.push({ name: "rabbitmq", indicator: rabbitIndicator, critical: false });
		}
		return indicators;
	},
	inject: [
		AuthorizationHealthIndicator,
		{ token: BullMqHealthIndicator, optional: true },
		{ token: KafkaHealthIndicator, optional: true },
		{ token: RabbitMqHealthIndicator, optional: true },
	],
};
