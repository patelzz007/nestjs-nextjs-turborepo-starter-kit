// ============================================
// feature-flags/infrastructure/signals/redis-catalog-version.signal.ts — "the catalogue is now at version N" (ADR 087)
// ============================================
// A client's live stream may be held by any API instance; the change commits on any other. The version goes over
// one broadcast channel (Redis, or this process without it). It carries a number only.

import { EventEmitter } from "node:events";

import { Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { FeatureFlagVersionSignalSchema, type FeatureFlagVersionSignal } from "@workspace/shared";
import type Redis from "ioredis";

import type { TypedConfigService } from "../../../../config/typed-config.service";
import { RedisBroadcastChannel } from "../../../../platform/infrastructure/redis/redis-broadcast-channel";
import type { CatalogVersionSignal } from "../../application/ports/flag-catalog.port";

/** One listener per open stream; a busy instance holds many. */
const MAX_LOCAL_LISTENERS = 10_000;
const VERSION_EVENT = "version";

export class RedisCatalogVersionSignal implements CatalogVersionSignal, OnModuleInit, OnModuleDestroy {
	private readonly local: EventEmitter = new EventEmitter();
	private readonly channel: RedisBroadcastChannel<FeatureFlagVersionSignal>;

	public constructor(config: TypedConfigService, publisher: Redis | null, subscriber: Redis | null) {
		this.local.setMaxListeners(MAX_LOCAL_LISTENERS);
		this.channel = new RedisBroadcastChannel({
			channel: config.redisNamespace.channel("feature-flags:version"),
			publisher,
			subscriber,
			schema: FeatureFlagVersionSignalSchema,
			deliver: ({ version }: FeatureFlagVersionSignal): void => {
				this.local.emit(VERSION_EVENT, version);
			},
			logger: new Logger(RedisCatalogVersionSignal.name),
			logPrefix: "feature_flags",
		});
	}

	public onModuleInit(): Promise<void> {
		return this.channel.open();
	}

	public onModuleDestroy(): Promise<void> {
		this.local.removeAllListeners();
		return this.channel.close();
	}

	/** A failed publish is logged: the change is committed, and clients catch up on their next refetch (focus, interval or nextChangeAt). */
	public publish(version: number): Promise<void> {
		return this.channel.publish({ version });
	}

	public subscribe(listener: (version: number) => void): () => void {
		this.local.on(VERSION_EVENT, listener);
		return (): void => {
			this.local.off(VERSION_EVENT, listener);
		};
	}
}
