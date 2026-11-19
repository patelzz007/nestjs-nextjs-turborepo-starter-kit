import { Logger } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { z } from "zod";

import { FakeRedis } from "../../../../../e2e/support/fake-redis";
import { RedisBroadcastChannel } from "../redis-broadcast-channel";

const CHANNEL = "tenant-a:test:signals";
const MessageSchema = z.object({ id: z.string().min(1) });
type Message = z.output<typeof MessageSchema>;

interface Setup {
	readonly channel: RedisBroadcastChannel<Message>;
	readonly delivered: Message[];
	readonly warn: MockInstance<Logger["warn"]>;
}

function setup(publisher: FakeRedis | null, subscriber: FakeRedis | null, deliver?: (message: Message) => void): Setup {
	const delivered: Message[] = [];
	const logger = new Logger("test");
	const warn = vi.spyOn(logger, "warn").mockImplementation((): void => undefined);
	const channel = new RedisBroadcastChannel<Message>({
		channel: CHANNEL,
		publisher: publisher?.client ?? null,
		subscriber: subscriber?.client ?? null,
		schema: MessageSchema,
		deliver:
			deliver ??
			((message: Message): void => {
				delivered.push(message);
			}),
		logger,
		logPrefix: "test",
	});
	return { channel, delivered, warn };
}

describe("RedisBroadcastChannel", () => {
	let publisher: FakeRedis;
	let subscriber: FakeRedis;

	beforeEach(() => {
		publisher = new FakeRedis();
		subscriber = new FakeRedis();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("publishes the validated message on its channel", async () => {
		const { channel } = setup(publisher, subscriber);

		await channel.publish({ id: "a" });

		expect(publisher.published).toEqual([{ channel: CHANNEL, payload: JSON.stringify({ id: "a" }) }]);
	});

	it("delivers what arrives on its channel once it is open, and unsubscribes when it closes", async () => {
		const { channel, delivered } = setup(publisher, subscriber);
		await channel.open();
		expect(subscriber.subscriptions).toEqual([CHANNEL]);

		subscriber.emit(CHANNEL, JSON.stringify({ id: "a" }));
		await channel.close();

		expect(delivered).toEqual([{ id: "a" }]);
		expect(subscriber.subscriptions).toEqual([]);
	});

	it("ignores other channels on the same connection", async () => {
		const { channel, delivered } = setup(publisher, subscriber);
		await channel.open();

		subscriber.emit("tenant-b:test:signals", JSON.stringify({ id: "a" }));

		expect(delivered).toEqual([]);
	});

	it("drops and logs a received message that is not JSON or not the schema", async () => {
		const { channel, delivered, warn } = setup(publisher, subscriber);
		await channel.open();

		subscriber.emit(CHANNEL, "{not json");
		subscriber.emit(CHANNEL, JSON.stringify({ other: 1 }));

		expect(delivered).toEqual([]);
		expect(warn).toHaveBeenCalledTimes(2);
		expect(warn).toHaveBeenCalledWith("test.signal_ignored", expect.any(Error));
	});

	it("logs a failed publish instead of throwing: the change it announces is already committed", async () => {
		const { channel, warn } = setup(publisher, subscriber);
		publisher.failPublish = true;

		await expect(channel.publish({ id: "a" })).resolves.toBeUndefined();

		expect(warn).toHaveBeenCalledWith("test.signal_publish_failed", expect.any(Error));
	});

	it("refuses to publish a message that does not match the schema", async () => {
		const { channel } = setup(publisher, subscriber);

		await expect(channel.publish({ id: "" })).rejects.toThrow(z.ZodError);
		expect(publisher.published).toEqual([]);
	});

	describe("without Redis", () => {
		it("delivers in this process and subscribes to nothing", async () => {
			const { channel, delivered } = setup(null, null);
			await channel.open();

			await channel.publish({ id: "a" });
			await channel.close();

			expect(delivered).toEqual([{ id: "a" }]);
		});

		it("logs a listener that throws instead of failing the publisher", async () => {
			const { channel, warn } = setup(null, null, (): void => {
				throw new Error("listener broke");
			});

			await expect(channel.publish({ id: "a" })).resolves.toBeUndefined();

			expect(warn).toHaveBeenCalledWith("test.signal_ignored", expect.any(Error));
		});
	});
});
