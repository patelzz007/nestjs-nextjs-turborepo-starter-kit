// ============================================
// feature-flags/infrastructure/signals/redis-catalog-version.signal.ts — "the catalogue is now at version N" (ADR 087)
// ============================================
// A client's live stream may be held by any API instance; the change commits on any other. The version goes over
// Redis pub/sub on one channel, or stays in this process without Redis. It carries a number only.

import { EventEmitter } from "node:events";

import { Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { FeatureFlagVersionSignalSchema } from "@workspace/shared";
import type Redis from "ioredis";

import type { TypedConfigService } from "../../../../config/typed-config.service";
import type { CatalogVersionSignal } from "../../application/ports/flag-catalog.port";

/** One listener per open stream; a busy instance holds many. */
const MAX_LOCAL_LISTENERS = 10_000;
const VERSION_EVENT = "version";

export class RedisCatalogVersionSignal implements CatalogVersionSignal, OnModuleInit, OnModuleDestroy {
	private readonly logger: Logger = new Logger(RedisCatalogVersionSignal.name);
	private readonly local: EventEmitter = new EventEmitter();
	private readonly channel: string;
	private isSubscribed = false;

	public constructor(
		config: TypedConfigService,
		private readonly publisher: Redis | null,
		private readonly subscriber: Redis | null,
	) {
		this.channel = config.redisNamespace.channel("feature-flags:version");
		this.local.setMaxListeners(MAX_LOCAL_LISTENERS);
	}

	public async onModuleInit(): Promise<void> {
		if (this.subscriber === null) {
			return;
		}
		if (this.subscriber.status === "wait") {
			await this.subscriber.connect();
		}
		this.subscriber.on("message", (channel: string, payload: string): void => {
			if (channel === this.channel) {
				this.emitLocally(payload);
			}
		});
		await this.subscriber.subscribe(this.channel);
		this.isSubscribed = true;
	}

	public async onModuleDestroy(): Promise<void> {
		this.local.removeAllListeners();
		if (this.isSubscribed && this.subscriber !== null) {
			await this.subscriber.unsubscribe(this.channel);
			this.isSubscribed = false;
		}
	}

	public async publish(version: number): Promise<void> {
		const payload = JSON.stringify(FeatureFlagVersionSignalSchema.parse({ version }));
		if (this.publisher === null) {
			this.emitLocally(payload);
			return;
		}
		try {
			await this.publisher.publish(this.channel, payload);
		} catch (error) {
			// The change is committed; clients catch up on their next refetch (focus, interval or nextChangeAt).
			this.logger.warn("feature_flags.signal_publish_failed", error);
		}
	}

	public subscribe(listener: (version: number) => void): () => void {
		this.local.on(VERSION_EVENT, listener);
		return (): void => {
			this.local.off(VERSION_EVENT, listener);
		};
	}

	private emitLocally(payload: string): void {
		try {
			this.local.emit(VERSION_EVENT, FeatureFlagVersionSignalSchema.parse(JSON.parse(payload)).version);
		} catch (error) {
			this.logger.warn("feature_flags.signal_ignored: not a version signal", error);
		}
	}
}
