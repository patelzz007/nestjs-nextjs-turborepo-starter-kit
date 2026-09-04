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
		return Promise.resolve({
			backend: this.isEnabled() ? "bullmq" : "disabled",
			redis: this.options.redisUrl ?? "unset",
			prefix: this.options.bullPrefix,
		});
	}
}

/** Registers BullMQ root + all configured queue names. */
@Module({})
export class BullMqInfrastructureModule {}

export function registerBullMqInfrastructureModule(options: ResolvedMessagingOptions): DynamicModule {
	if (options.redisUrl === undefined) {
		return {
			module: BullMqInfrastructureModule,
			providers: [],
			exports: [],
		};
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
