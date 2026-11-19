import { DynamicModule, Inject, Injectable, Module } from "@nestjs/common";
import { BullModule, getQueueToken } from "@nestjs/bullmq";
import { Queue } from "bullmq";

import type { MessagingHealthIndicator } from "../../core/health";
import { createBullMqConnection } from "../../core/redis";

import { type ResolvedMessagingOptions } from "../messaging-options";
import { MESSAGING_OPTIONS, MESSAGING_QUEUE_NAMES } from "../tokens";

@Injectable()
export class BullMqHealthIndicator implements MessagingHealthIndicator {
	public constructor(
		@Inject(MESSAGING_OPTIONS) private readonly options: ResolvedMessagingOptions,
		private readonly healthQueue: Queue,
	) {}

	public isEnabled(): boolean {
		return this.options.redisUrl !== undefined;
	}

	public async isHealthy(): Promise<boolean> {
		if (!this.isEnabled()) {
			return true;
		}
		try {
			await this.healthQueue.getJobCounts();
			return true;
		} catch {
			return false;
		}
	}

	public getReport(): Promise<Record<string, string>> {
		return Promise.resolve(bullMqHealthReport(this.options));
	}
}

/**
 * The BullMQ section of the deep health report. Never the Redis URL itself: it
 * can carry credentials and `/health/deep` is public — `configured` / `unset`
 * only, like the Kafka and RabbitMQ reports.
 */
export function bullMqHealthReport(options: Pick<ResolvedMessagingOptions, "redisUrl" | "bullPrefix">): Record<string, string> {
	const isConfigured: boolean = options.redisUrl !== undefined;
	return {
		backend: isConfigured ? "bullmq" : "disabled",
		redis: isConfigured ? "configured" : "unset",
		prefix: options.bullPrefix,
	};
}

/**
 * Registers BullMQ root + all configured queue names.
 *
 * Shutdown needs nothing from the application: `@nestjs/bullmq` closes every worker in `onModuleDestroy` and
 * `Worker.close()` waits for the jobs they are running, while the connections those jobs use (database, Kafka,
 * Redis) close in `onApplicationShutdown`, the last phase (ADR 095). `app.close()` alone is a graceful shutdown.
 */
@Module({})
export class BullMqInfrastructureModule {}

export function registerBullMqInfrastructureModule(options: ResolvedMessagingOptions): DynamicModule {
	if (options.redisUrl === undefined) {
		return { module: BullMqInfrastructureModule };
	}

	const queueRegistrations = options.queueNames.map((name) => ({ name }));
	const healthQueueName = options.healthQueueName;
	if (healthQueueName === undefined) {
		throw new Error("BullMqInfrastructureModule requires at least one queue name");
	}

	return {
		module: BullMqInfrastructureModule,
		imports: [
			BullModule.forRoot({
				connection: createBullMqConnection(options.redisUrl),
				prefix: options.bullPrefix,
			}),
			BullModule.registerQueue(...queueRegistrations),
		],
		providers: [
			{
				provide: MESSAGING_QUEUE_NAMES,
				useValue: options.queueNames,
			},
			{
				provide: BullMqHealthIndicator,
				useFactory: (resolved: ResolvedMessagingOptions, queue: Queue): BullMqHealthIndicator => new BullMqHealthIndicator(resolved, queue),
				inject: [MESSAGING_OPTIONS, getQueueToken(healthQueueName)],
			},
		],
		exports: [BullModule, BullMqHealthIndicator, MESSAGING_QUEUE_NAMES],
	};
}
