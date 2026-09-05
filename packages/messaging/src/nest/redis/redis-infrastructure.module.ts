import { DynamicModule, Global, Inject, Injectable, Logger, Module, type OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";

import { createRedisClientOptions } from "../../core/redis";

import { type ResolvedMessagingOptions } from "../messaging-options";
import { REDIS_PUBLISHER, REDIS_SUBSCRIBER } from "../tokens";

/** Closes shared Redis clients when the API shuts down. */
@Injectable()
class RedisConnectionLifecycleService implements OnModuleDestroy {
	private readonly logger: Logger = new Logger(RedisConnectionLifecycleService.name);

	public constructor(
		@Inject(REDIS_PUBLISHER) private readonly publisher: Redis | null,
		@Inject(REDIS_SUBSCRIBER) private readonly subscriber: Redis | null,
	) {}

	public async onModuleDestroy(): Promise<void> {
		await this.disconnectClient(this.subscriber, "subscriber");
		await this.disconnectClient(this.publisher, "publisher");
	}

	private async disconnectClient(client: Redis | null, label: string): Promise<void> {
		if (client === null) {
			return;
		}
		if (client.status === "end") {
			return;
		}
		try {
			await client.quit();
			this.logger.log(`Redis ${label} disconnected`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.logger.warn(`Redis ${label} disconnect skipped: ${message}`);
		}
	}
}

@Global()
@Module({})
export class RedisInfrastructureModule {}

export function registerRedisInfrastructureModule(options: ResolvedMessagingOptions): DynamicModule {
	return {
		module: RedisInfrastructureModule,
		global: true,
		providers: [
			{
				provide: REDIS_PUBLISHER,
				useFactory: (): Redis | null => {
					if (options.redisUrl === undefined) {
						return null;
					}
					return new Redis(options.redisUrl, createRedisClientOptions({ redisUrl: options.redisUrl, connectionName: options.connectionName }));
				},
			},
			{
				provide: REDIS_SUBSCRIBER,
				useFactory: (): Redis | null => {
					if (options.redisUrl === undefined) {
						return null;
					}
					return new Redis(options.redisUrl, createRedisClientOptions({ redisUrl: options.redisUrl, connectionName: options.connectionName }));
				},
			},
			RedisConnectionLifecycleService,
		],
		exports: [REDIS_PUBLISHER, REDIS_SUBSCRIBER],
	};
}
