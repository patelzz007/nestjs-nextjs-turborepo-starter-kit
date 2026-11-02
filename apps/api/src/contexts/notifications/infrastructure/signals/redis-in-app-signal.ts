// ============================================
// notifications/infrastructure/signals/redis-in-app-signal.ts — "your inbox changed", on every instance (ADR 070)
// ============================================
// A person's SSE stream may be held by any API instance; the fan-out runs on any other. Signals go over
// Redis pub/sub (one channel for all, filtered here), or stay in this process without Redis.

import { EventEmitter } from "node:events";

import { Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { InAppNotificationSignalSchema, type InAppNotificationSignal, type NotificationSurface } from "@workspace/shared";
import type Redis from "ioredis";
import { z } from "zod";

import { TypedConfigService } from "../../../../config/typed-config.service";
import type { InAppSignalPort } from "../../application/ports/in-app-signal.port";

const SignalMessageSchema = z.object({ userId: z.string(), signal: InAppNotificationSignalSchema });
/** One listener per open stream; a busy instance holds many. */
const MAX_LOCAL_LISTENERS = 10_000;

/** Built by the notifications module factory (its Redis clients are the shared publisher and subscriber). */
export class RedisInAppSignal implements InAppSignalPort, OnModuleInit, OnModuleDestroy {
	private readonly logger: Logger = new Logger(RedisInAppSignal.name);
	private readonly local: EventEmitter = new EventEmitter();
	private readonly channel: string;
	private isSubscribed = false;

	public constructor(
		config: TypedConfigService,
		private readonly publisher: Redis | null,
		private readonly subscriber: Redis | null,
	) {
		this.channel = config.redisNamespace.channel("notifications:inbox");
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

	public async publish(userId: string, signal: InAppNotificationSignal): Promise<void> {
		const payload = JSON.stringify({ userId, signal });
		if (this.publisher === null) {
			this.emitLocally(payload);
			return;
		}
		try {
			await this.publisher.publish(this.channel, payload);
		} catch (error) {
			// The inbox is committed; the bell catches up on its next poll.
			this.logger.warn("notifications.signal_publish_failed", error);
		}
	}

	public subscribe(userId: string, surface: NotificationSurface, listener: (signal: InAppNotificationSignal) => void): () => void {
		const event = `${userId}|${surface}`;
		this.local.on(event, listener);
		return (): void => {
			this.local.off(event, listener);
		};
	}

	private emitLocally(payload: string): void {
		try {
			const message = SignalMessageSchema.parse(JSON.parse(payload));
			this.local.emit(`${message.userId}|${message.signal.surface}`, message.signal);
		} catch (error) {
			this.logger.warn("notifications.signal_ignored: not an inbox signal", error);
		}
	}
}
