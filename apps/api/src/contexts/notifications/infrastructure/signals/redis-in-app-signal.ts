// ============================================
// notifications/infrastructure/signals/redis-in-app-signal.ts — "your inbox changed", on every instance (ADR 070)
// ============================================
// A person's SSE stream may be held by any API instance; the fan-out runs on any other. Signals go over one
// broadcast channel for everyone (Redis, or this process without it) and are routed here to the person's streams.

import { EventEmitter } from "node:events";

import { Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { InAppNotificationSignalSchema, type InAppNotificationSignal, type NotificationSurface } from "@workspace/shared";
import type Redis from "ioredis";
import { z } from "zod";

import { TypedConfigService } from "../../../../config/typed-config.service";
import { RedisBroadcastChannel } from "../../../../platform/infrastructure/redis/redis-broadcast-channel";
import type { InAppSignalPort } from "../../application/ports/in-app-signal.port";

const SignalMessageSchema = z.object({ userId: z.string(), signal: InAppNotificationSignalSchema });
type SignalMessage = z.output<typeof SignalMessageSchema>;

/** One listener per open stream; a busy instance holds many. */
const MAX_LOCAL_LISTENERS = 10_000;

function streamEvent(userId: string, surface: NotificationSurface): string {
	return `${userId}|${surface}`;
}

/** Built by the notifications module factory (its Redis clients are the shared publisher and subscriber). */
export class RedisInAppSignal implements InAppSignalPort, OnModuleInit, OnModuleDestroy {
	private readonly local: EventEmitter = new EventEmitter();
	private readonly channel: RedisBroadcastChannel<SignalMessage>;

	public constructor(config: TypedConfigService, publisher: Redis | null, subscriber: Redis | null) {
		this.local.setMaxListeners(MAX_LOCAL_LISTENERS);
		this.channel = new RedisBroadcastChannel({
			channel: config.redisNamespace.channel("notifications:inbox"),
			publisher,
			subscriber,
			schema: SignalMessageSchema,
			deliver: ({ userId, signal }: SignalMessage): void => {
				this.local.emit(streamEvent(userId, signal.surface), signal);
			},
			logger: new Logger(RedisInAppSignal.name),
			logPrefix: "notifications",
		});
	}

	public onModuleInit(): Promise<void> {
		return this.channel.open();
	}

	public onModuleDestroy(): Promise<void> {
		this.local.removeAllListeners();
		return this.channel.close();
	}

	/** A failed publish is logged: the inbox is committed, and the bell catches up on its next poll. */
	public publish(userId: string, signal: InAppNotificationSignal): Promise<void> {
		return this.channel.publish({ userId, signal });
	}

	public subscribe(userId: string, surface: NotificationSurface, listener: (signal: InAppNotificationSignal) => void): () => void {
		const event = streamEvent(userId, surface);
		this.local.on(event, listener);
		return (): void => {
			this.local.off(event, listener);
		};
	}
}
