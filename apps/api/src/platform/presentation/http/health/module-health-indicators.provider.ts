import type { Provider } from "@nestjs/common";

import { BullMqHealthIndicator, KafkaHealthIndicator, RabbitMqHealthIndicator } from "@workspace/messaging/nest";

import { AUTHORIZATION_HEALTH_INDICATOR } from "../../../../contexts/authorization/public-api";
import { RuntimeRoleProof } from "../../../infrastructure/database/runtime-role-proof";
import { MaintenanceSchedulerRegistry } from "../../../infrastructure/jobs/maintenance-scheduler.registry";

import { MODULE_HEALTH_INDICATORS, type ModuleHealthIndicator, type RegisteredModuleHealthIndicator } from "./health.service";

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
 *
 * The tenant-isolation proof IS critical: an instance whose runtime role can bypass RLS, or whose
 * tables do not force it, would serve tenant data without isolation (D9, RuntimeRoleProof).
 *
 * The maintenance schedulers are critical only until their first registration
 * attempt settles (MaintenanceSchedulerRegistry): an instance is not ready
 * before it tried, but a Redis failure after that is reported and retried,
 * never a reason to leave rotation.
 */
export const moduleHealthIndicatorsProvider: Provider = {
	provide: MODULE_HEALTH_INDICATORS,
	useFactory: (
		authorizationIndicator: ModuleHealthIndicator,
		schedulers: MaintenanceSchedulerRegistry,
		tenantIsolation: RuntimeRoleProof,
		queueIndicator?: BullMqHealthIndicator,
		kafkaIndicator?: KafkaHealthIndicator,
		rabbitIndicator?: RabbitMqHealthIndicator,
	): readonly RegisteredModuleHealthIndicator[] => {
		const indicators: RegisteredModuleHealthIndicator[] = [
			{ name: "authorization", indicator: authorizationIndicator, critical: true },
			{ name: "maintenance-schedulers", indicator: schedulers, critical: true },
			{ name: "tenant-isolation", indicator: tenantIsolation, critical: true },
		];
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
		AUTHORIZATION_HEALTH_INDICATOR,
		MaintenanceSchedulerRegistry,
		RuntimeRoleProof,
		{ token: BullMqHealthIndicator, optional: true },
		{ token: KafkaHealthIndicator, optional: true },
		{ token: RabbitMqHealthIndicator, optional: true },
	],
};
