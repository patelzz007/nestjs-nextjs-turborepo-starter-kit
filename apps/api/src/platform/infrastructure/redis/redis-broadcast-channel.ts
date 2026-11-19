// ============================================
// platform/infrastructure/redis/redis-broadcast-channel.ts — one message stream every API instance hears
// ============================================
// A live stream (SSE) is held by whichever instance the client reached, while the change it waits for commits on
// any instance. The message goes over one Redis pub/sub channel, or stays in this process when Redis is not
// configured. Delivery is at most once: an instance that is disconnected when a message is published never sees
// it, so every consumer keeps its own catch-up (a refetch or a poll).

import type { Logger } from "@nestjs/common";
import type Redis from "ioredis";
import type { z } from "zod";

export interface RedisBroadcastChannelOptions<TMessage> {
	/** The channel's full name, already namespaced (`config.redisNamespace.channel(...)`). */
	readonly channel: string;
	/** `null` without Redis: a published message is then delivered in this process only. */
	readonly publisher: Redis | null;
	readonly subscriber: Redis | null;
	/** Every message is parsed with it, sent and received; a received message that fails is logged and dropped. */
	readonly schema: z.ZodType<TMessage>;
	/** Called once per message, on every instance (this one included). */
	readonly deliver: (message: TMessage) => void;
	readonly logger: Logger;
	/** The log events' prefix: `<prefix>.signal_publish_failed`, `<prefix>.signal_ignored`. */
	readonly logPrefix: string;
}

export class RedisBroadcastChannel<TMessage> {
	private isSubscribed = false;

	public constructor(private readonly options: RedisBroadcastChannelOptions<TMessage>) {}

	/** Starts listening (the owner's `onModuleInit`). Without Redis there is nothing to listen to. */
	public async open(): Promise<void> {
		const { subscriber, channel } = this.options;
		if (subscriber === null) {
			return;
		}
		if (subscriber.status === "wait") {
			await subscriber.connect();
		}
		subscriber.on("message", (from: string, payload: string): void => {
			if (from === channel) {
				this.receive(payload);
			}
		});
		await subscriber.subscribe(channel);
		this.isSubscribed = true;
	}

	/** Stops listening (the owner's `onModuleDestroy`). */
	public async close(): Promise<void> {
		const { subscriber, channel } = this.options;
		if (this.isSubscribed && subscriber !== null) {
			await subscriber.unsubscribe(channel);
			this.isSubscribed = false;
		}
	}

	/**
	 * Sends `message` to every instance. A failed publish is logged, never thrown: the change it announces is
	 * already committed, and the consumers' catch-up covers the missed signal.
	 */
	public async publish(message: TMessage): Promise<void> {
		const { publisher, channel, schema, logger, logPrefix } = this.options;
		const payload = JSON.stringify(schema.parse(message));
		if (publisher === null) {
			this.receive(payload);
			return;
		}
		try {
			await publisher.publish(channel, payload);
		} catch (error) {
			logger.warn(`${logPrefix}.signal_publish_failed`, error);
		}
	}

	private receive(payload: string): void {
		const { schema, deliver, logger, logPrefix } = this.options;
		try {
			deliver(schema.parse(JSON.parse(payload)));
		} catch (error) {
			logger.warn(`${logPrefix}.signal_ignored`, error);
		}
	}
}
