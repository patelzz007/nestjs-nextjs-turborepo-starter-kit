import { DynamicModule, Global, Inject, Injectable, Logger, Module, type OnApplicationShutdown } from "@nestjs/common";
import Redis from "ioredis";

import { createRedisClientOptions } from "../../core/redis";

import { type ResolvedMessagingOptions } from "../messaging-options";
import { REDIS_PUBLISHER, REDIS_SUBSCRIBER } from "../tokens";
import { RedisClientSupervisor } from "./redis-client-supervisor";

/**
 * Owns the shared Redis clients' shutdown — the ONLY code that closes them
 * (consumers such as caches or the invalidation subscriber must never QUIT a
 * shared client).
 *
 * Ordered shutdown: Nest runs every `onModuleDestroy` (consumers stop timers,
 * unsubscribe, finish their last commands) BEFORE any `onApplicationShutdown`,
 * so the clients are closed here, last — subscriber first, then publisher —
 * and each close is awaited. Errors after the close started are expected and
 * logged at debug; a genuine connection error while running is logged at
 * ERROR (see RedisClientSupervisor).
 */
@Injectable()
export class RedisConnectionLifecycleService implements OnApplicationShutdown {
	private readonly logger: Logger = new Logger(RedisConnectionLifecycleService.name);
	/** Closed in this order: the subscriber (no more incoming messages), then the publisher. */
	private readonly supervisors: readonly RedisClientSupervisor[];

	public constructor(@Inject(REDIS_PUBLISHER) publisher: Redis | null, @Inject(REDIS_SUBSCRIBER) subscriber: Redis | null) {
		const clients: [Redis | null, string][] = [
			[subscriber, "subscriber"],
			[publisher, "publisher"],
		];
		this.supervisors = clients.flatMap(([client, label]): RedisClientSupervisor[] => (client === null ? [] : [new RedisClientSupervisor(client, label, this.logger)]));
	}

	public async onApplicationShutdown(): Promise<void> {
		for (const supervisor of this.supervisors) {
			await supervisor.close();
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
