import { EventEmitter } from "node:events";

import Redis from "ioredis";
import { describe, expect, it, vi } from "vitest";

import { RedisClientSupervisor, type RedisSupervisorLog, type SupervisedRedisClient } from "./redis-client-supervisor";
import { RedisConnectionLifecycleService } from "./redis-infrastructure.module";

/** An ioredis-shaped client: emits `error`, and QUIT resolves after a tick (like a real round trip). */
class FakeClient extends EventEmitter implements SupervisedRedisClient {
	public status = "ready";
	public quitCalls = 0;

	public constructor(private readonly onQuit: () => void = (): void => undefined) {
		super();
	}

	public async quit(): Promise<"OK"> {
		this.quitCalls += 1;
		if (this.status === "end") {
			throw new Error("Connection is closed.");
		}
		await Promise.resolve();
		this.status = "end";
		this.onQuit();
		return "OK";
	}
}

function recordingLog(): RedisSupervisorLog & { readonly lines: string[] } {
	const lines: string[] = [];
	return {
		lines,
		log: (message: string): void => {
			lines.push(`LOG ${message}`);
		},
		debug: (message: string): void => {
			lines.push(`DEBUG ${message}`);
		},
		error: (message: string): void => {
			lines.push(`ERROR ${message}`);
		},
	};
}

describe("RedisClientSupervisor", () => {
	it("logs a connection error while running at ERROR", () => {
		const client = new FakeClient();
		const log = recordingLog();
		new RedisClientSupervisor(client, "publisher", log);

		client.emit("error", new Error("connect ECONNREFUSED 127.0.0.1:6379"));

		expect(log.lines).toEqual(["ERROR Redis publisher error: connect ECONNREFUSED 127.0.0.1:6379"]);
	});

	it("treats errors after an intentional close as expected (debug, never ERROR)", async () => {
		const client = new FakeClient();
		const log = recordingLog();
		const supervisor = new RedisClientSupervisor(client, "subscriber", log);

		const closing = supervisor.close();
		client.emit("error", new Error("Connection is closed."));
		await closing;

		expect(log.lines).toEqual(["DEBUG Redis subscriber: Connection is closed. (expected during shutdown)", "LOG Redis subscriber disconnected"]);
	});

	it("sends ONE quit for concurrent and repeated closes (a second QUIT used to reject with 'Connection is closed')", async () => {
		const client = new FakeClient();
		const log = recordingLog();
		const supervisor = new RedisClientSupervisor(client, "publisher", log);

		await Promise.all([supervisor.close(), supervisor.close()]);
		await supervisor.close();

		expect(client.quitCalls).toBe(1);
		expect(log.lines.filter((line) => line.startsWith("ERROR"))).toEqual([]);
	});

	it("does not quit a client that already ended", async () => {
		const client = new FakeClient();
		client.status = "end";
		await new RedisClientSupervisor(client, "publisher", recordingLog()).close();

		expect(client.quitCalls).toBe(0);
	});
});

describe("RedisConnectionLifecycleService", () => {
	it("closes the shared clients at application shutdown — subscriber first, each awaited — and attaches their error listeners", async () => {
		const order: string[] = [];
		const subscriber = new Redis({ lazyConnect: true });
		const publisher = new Redis({ lazyConnect: true });
		vi.spyOn(subscriber, "quit").mockImplementation(async () => {
			await Promise.resolve();
			order.push("subscriber");
			return "OK";
		});
		vi.spyOn(publisher, "quit").mockImplementation(() => {
			order.push("publisher");
			return Promise.resolve("OK");
		});

		const lifecycle = new RedisConnectionLifecycleService(publisher, subscriber);
		expect(subscriber.listenerCount("error")).toBe(1);
		expect(publisher.listenerCount("error")).toBe(1);

		await lifecycle.onApplicationShutdown();

		expect(order).toEqual(["subscriber", "publisher"]);
	});
});
