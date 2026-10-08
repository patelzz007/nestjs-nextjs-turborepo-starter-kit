import type { RefreshResult } from "@workspace/client/lib/api/api-request";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { describe, expect, it, vi } from "vitest";

import {
	EVENT_SOURCE_CONNECTING,
	EVENT_SOURCE_OPEN,
	reconnectDelayMs,
	ReconnectingEventStream,
	type EventSourceLike,
	type LiveState,
	type ReconnectScheduler,
} from "@/lib/notifications/reconnecting-event-stream";

/** `EventSource.readyState` of a connection closed for good. */
const EVENT_SOURCE_CLOSED = 2;

type Listener = () => void;

class FakeEventSource implements EventSourceLike {
	public readyState: number = EVENT_SOURCE_CONNECTING;
	public isClosed = false;
	private readonly _listeners = new Map<string, Listener>();

	public addEventListener(type: "open" | "message" | "error", listener: Listener): void {
		this._listeners.set(type, listener);
	}

	public removeEventListener(type: "open" | "message" | "error"): void {
		this._listeners.delete(type);
	}

	public close(): void {
		this.isClosed = true;
		this.readyState = EVENT_SOURCE_CLOSED;
	}

	public emit(type: "open" | "message" | "error", readyState: number): void {
		this.readyState = readyState;
		this._listeners.get(type)?.();
	}
}

class FakeScheduler implements ReconnectScheduler {
	public readonly pending: { readonly callback: () => void; readonly delayMs: number }[] = [];

	public schedule(callback: () => void, delayMs: number): number {
		this.pending.push({ callback, delayMs });
		return this.pending.length;
	}

	public cancel(): void {
		this.pending.length = 0;
	}

	public runNext(): void {
		this.pending.shift()?.callback();
	}
}

interface Harness {
	readonly stream: ReconnectingEventStream;
	readonly sources: FakeEventSource[];
	readonly scheduler: FakeScheduler;
	readonly states: LiveState[];
	readonly onMessage: () => void;
}

function harness(refreshResults: readonly RefreshResult[]): Harness {
	const sources: FakeEventSource[] = [];
	const scheduler = new FakeScheduler();
	const states: LiveState[] = [];
	const results = [...refreshResults];
	const onMessage = vi.fn<() => void>();
	const stream = new ReconnectingEventStream({
		openSource: (): FakeEventSource => {
			const source = new FakeEventSource();
			sources.push(source);
			return source;
		},
		refreshSession: (): Promise<RefreshResult> => Promise.resolve(results.shift() ?? "ok"),
		scheduler,
		backoff: { initialDelayMs: 1_000, maxDelayMs: 4_000 },
		onMessage,
		onStateChange: (state: LiveState): void => {
			states.push(state);
		},
	});
	return { stream, sources, scheduler, states, onMessage };
}

/** Lets the stream's refresh promise settle. */
function settle(): Promise<void> {
	return Promise.resolve().then(() => undefined);
}

describe("reconnectDelayMs", () => {
	it("doubles per attempt up to the cap", () => {
		const backoff = { initialDelayMs: 1_000, maxDelayMs: 4_000 };
		expect([0, 1, 2, 3].map((attempt) => reconnectDelayMs(backoff, attempt))).toEqual([1_000, 2_000, 4_000, 4_000]);
	});
});

describe("ReconnectingEventStream", () => {
	it("reports open and forwards every message", () => {
		const { stream, sources, states, onMessage } = harness([]);
		stream.start();
		sources[LIST_SLOT_INDEX.first]?.emit("open", EVENT_SOURCE_OPEN);
		sources[LIST_SLOT_INDEX.first]?.emit("message", EVENT_SOURCE_OPEN);

		expect(states).toEqual(["connecting", "open"]);
		expect(onMessage).toHaveBeenCalledTimes(1);
	});

	it("leaves a dropped connection to the browser's own retry", () => {
		const { stream, sources, scheduler, states } = harness([]);
		stream.start();
		sources[LIST_SLOT_INDEX.first]?.emit("error", EVENT_SOURCE_CONNECTING);

		expect(states.at(-1)).toBe("connecting");
		expect(sources).toHaveLength(1);
		expect(scheduler.pending).toHaveLength(0);
	});

	it("refreshes the session and reconnects after a terminal close (e.g. a 401)", async () => {
		const { stream, sources, scheduler, states } = harness(["ok"]);
		stream.start();
		sources[LIST_SLOT_INDEX.first]?.emit("error", EVENT_SOURCE_CLOSED);
		await settle();

		expect(sources[LIST_SLOT_INDEX.first]?.isClosed).toBe(true);
		expect(scheduler.pending.map((entry) => entry.delayMs)).toEqual([1_000]);
		scheduler.runNext();
		expect(sources).toHaveLength(2);
		sources[LIST_SLOT_INDEX.second]?.emit("open", EVENT_SOURCE_OPEN);
		expect(states.at(-1)).toBe("open");
	});

	it("backs off on repeated failures and resets after a successful open", async () => {
		const { stream, sources, scheduler } = harness(["transient", "transient", "ok"]);
		stream.start();
		sources[LIST_SLOT_INDEX.first]?.emit("error", EVENT_SOURCE_CLOSED);
		await settle();
		scheduler.runNext();
		sources[LIST_SLOT_INDEX.second]?.emit("error", EVENT_SOURCE_CLOSED);
		await settle();

		expect(scheduler.pending.map((entry) => entry.delayMs)).toEqual([2_000]);
		scheduler.runNext();
		sources[LIST_SLOT_INDEX.third]?.emit("open", EVENT_SOURCE_OPEN);
		sources[LIST_SLOT_INDEX.third]?.emit("error", EVENT_SOURCE_CLOSED);
		await settle();
		expect(scheduler.pending.map((entry) => entry.delayMs)).toEqual([1_000]);
	});

	it("stops for good once the session has expired", async () => {
		const { stream, sources, scheduler, states } = harness(["expired"]);
		stream.start();
		sources[LIST_SLOT_INDEX.first]?.emit("error", EVENT_SOURCE_CLOSED);
		await settle();

		expect(states.at(-1)).toBe("closed");
		expect(scheduler.pending).toHaveLength(0);
	});

	it("never reconnects after stop()", async () => {
		const { stream, sources, scheduler } = harness(["ok"]);
		stream.start();
		sources[LIST_SLOT_INDEX.first]?.emit("error", EVENT_SOURCE_CLOSED);
		stream.stop();
		await settle();

		expect(scheduler.pending).toHaveLength(0);
		expect(sources).toHaveLength(1);
	});
});
