import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ListenConnection } from "../../../infrastructure/database/pg-listen-connection";
import { AUDIT_TRAIL_CHANNEL } from "./audit-trail-listen-connection";
import { AuditTrailEventsService, AUDIT_TRAIL_RECONNECT_MAX_MS, reconnectDelayMs } from "./audit-trail-events.service";

/** A listen connection the test drives: it records what the service did and lets the test notify or drop it. */
class FakeConnection implements ListenConnection {
	public readonly listened: string[] = [];
	public closed = false;
	private notificationListener: (channel: string, payload: string | null) => void = (): void => undefined;
	private closeListener: (error: Error | null) => void = (): void => undefined;

	public constructor(private readonly failToConnect = false) {}

	public connect(): Promise<void> {
		return this.failToConnect ? Promise.reject(new Error("refused")) : Promise.resolve();
	}

	public listen(channel: string): Promise<void> {
		this.listened.push(channel);
		return Promise.resolve();
	}

	public onNotification(listener: (channel: string, payload: string | null) => void): void {
		this.notificationListener = listener;
	}

	public onClose(listener: (error: Error | null) => void): void {
		this.closeListener = listener;
	}

	public close(): Promise<void> {
		this.closed = true;
		return Promise.resolve();
	}

	public notify(): void {
		this.notificationListener(AUDIT_TRAIL_CHANNEL, "audit_logs");
	}

	public drop(): void {
		this.closeListener(new Error("connection lost"));
	}
}

/** Lets the service's pending connect / listen promises settle. */
async function settle(): Promise<void> {
	await vi.advanceTimersByTimeAsync(0);
}

describe("AuditTrailEventsService", () => {
	let connections: FakeConnection[];
	let failNext: boolean;
	let service: AuditTrailEventsService;

	beforeEach(() => {
		vi.useFakeTimers();
		connections = [];
		failNext = false;
		service = new AuditTrailEventsService((): FakeConnection => {
			const connection = new FakeConnection(failNext);
			failNext = false;
			connections.push(connection);
			return connection;
		});
	});

	afterEach(async () => {
		await service.onModuleDestroy();
		vi.useRealTimers();
	});

	it("opens one listener for every subscriber, and closes it with the last", async () => {
		const first = service.observe().subscribe();
		const second = service.observe().subscribe();
		await settle();

		expect(connections).toHaveLength(1);
		expect(connections.at(0)?.listened).toEqual([AUDIT_TRAIL_CHANNEL]);

		first.unsubscribe();
		await settle();
		expect(connections.at(0)?.closed).toBe(false);
		second.unsubscribe();
		await settle();
		expect(connections.at(0)?.closed).toBe(true);
	});

	it("passes every notification on as a signal to every subscriber", async () => {
		const seen: string[] = [];
		const a = service.observe().subscribe((): void => {
			seen.push("a");
		});
		const b = service.observe().subscribe((): void => {
			seen.push("b");
		});
		await settle();

		connections.at(0)?.notify();

		expect(seen).toEqual(["a", "b"]);
		a.unsubscribe();
		b.unsubscribe();
	});

	it("reconnects after a lost connection with backoff, then signals once for what it may have missed", async () => {
		let signals = 0;
		const subscription = service.observe().subscribe((): void => {
			signals += 1;
		});
		await settle();

		connections.at(0)?.drop();
		expect(connections.at(0)?.closed).toBe(true);
		await vi.advanceTimersByTimeAsync(reconnectDelayMs(0) - 1);
		expect(connections).toHaveLength(1);
		await vi.advanceTimersByTimeAsync(1);

		expect(connections).toHaveLength(2);
		expect(connections.at(1)?.listened).toEqual([AUDIT_TRAIL_CHANNEL]);
		expect(signals).toBe(1);
		subscription.unsubscribe();
	});

	it("backs off longer after each failed reconnect", async () => {
		const subscription = service.observe().subscribe();
		await settle();
		failNext = true;
		connections.at(0)?.drop();

		await vi.advanceTimersByTimeAsync(reconnectDelayMs(0));
		expect(connections).toHaveLength(2);
		await vi.advanceTimersByTimeAsync(reconnectDelayMs(1) - 1);
		expect(connections).toHaveLength(2);
		await vi.advanceTimersByTimeAsync(1);
		expect(connections).toHaveLength(3);
		subscription.unsubscribe();
	});

	it("does not reconnect once nobody is listening", async () => {
		const subscription = service.observe().subscribe();
		await settle();
		subscription.unsubscribe();
		await settle();

		connections.at(0)?.drop();
		await vi.advanceTimersByTimeAsync(AUDIT_TRAIL_RECONNECT_MAX_MS);

		expect(connections).toHaveLength(1);
	});

	it("caps the backoff", () => {
		expect([0, 1, 2, 10].map(reconnectDelayMs)).toEqual([1_000, 2_000, 4_000, AUDIT_TRAIL_RECONNECT_MAX_MS]);
	});
});
