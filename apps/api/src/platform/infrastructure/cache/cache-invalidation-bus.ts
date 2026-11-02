// ============================================
// platform/infrastructure/cache/cache-invalidation-bus.ts — every instance hears every invalidation
// ============================================
// Delivery is at-most-once (Redis pub/sub): a missed message leaves a local copy until its TTL, the
// declared safety net (ADR 072). The shared clients belong to the Redis infrastructure module; only
// this subscription is ours.

import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import type Redis from "ioredis";

import { TypedConfigService } from "../../../config/typed-config.service";
import { REDIS_SUBSCRIBER } from "../redis/redis.tokens";
import { cacheInvalidationChannel } from "./cache-keys";
import { CacheInvalidationMessageSchema, type CacheInvalidationMessage, type CacheInvalidationSource } from "./tiered-app-cache";

@Injectable()
export class CacheInvalidationBus implements CacheInvalidationSource, OnModuleInit, OnModuleDestroy {
	private readonly logger: Logger = new Logger(CacheInvalidationBus.name);
	private readonly channel: string;
	private readonly handlers: ((message: CacheInvalidationMessage) => void)[] = [];
	private isSubscribed = false;

	public constructor(
		config: TypedConfigService,
		@Inject(REDIS_SUBSCRIBER) private readonly subscriber: Redis | null,
	) {
		this.channel = cacheInvalidationChannel(config.redisNamespace);
	}

	public onMessage(handler: (message: CacheInvalidationMessage) => void): void {
		this.handlers.push(handler);
	}

	/** Subscribe before serving traffic: an instance that cannot hear invalidations would serve stale values. */
	public async onModuleInit(): Promise<void> {
		if (this.subscriber === null) {
			return;
		}
		if (this.subscriber.status === "wait") {
			await this.subscriber.connect();
		}
		this.subscriber.on("message", (channel: string, payload: string): void => {
			if (channel === this.channel) {
				this.deliver(payload);
			}
		});
		await this.subscriber.subscribe(this.channel);
		this.isSubscribed = true;
	}

	public async onModuleDestroy(): Promise<void> {
		if (!this.isSubscribed || this.subscriber === null) {
			return;
		}
		await this.subscriber.unsubscribe(this.channel);
		this.isSubscribed = false;
	}

	/** Applies one message; a malformed one is logged and ignored. */
	public deliver(payload: string): void {
		try {
			const message = CacheInvalidationMessageSchema.parse(JSON.parse(payload));
			for (const handler of this.handlers) {
				handler(message);
			}
		} catch (error) {
			this.logger.warn("cache.invalidation_message_ignored: not a cache invalidation", error);
		}
	}
}
