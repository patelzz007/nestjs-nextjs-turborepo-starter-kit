import { DynamicModule, Global, Module } from "@nestjs/common";
import Redis from "ioredis";

import { createRedisClientOptions } from "../../core/redis";

import { type ResolvedMessagingOptions } from "../messaging-options";
import { REDIS_PUBLISHER, REDIS_SUBSCRIBER } from "../tokens";

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
		],
		exports: [REDIS_PUBLISHER, REDIS_SUBSCRIBER],
	};
}
