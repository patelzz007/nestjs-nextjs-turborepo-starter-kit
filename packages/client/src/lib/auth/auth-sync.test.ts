// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAuthChannel, type AuthSyncEvent } from "./auth-sync";

/**
 * Minimal in-memory BroadcastChannel mock: instances created under the same
 * name deliver postMessage to each other's `message` listeners synchronously,
 * mirroring the real API well enough for auth-sync tests.
 */
interface MockMessageEvent {
	readonly data: unknown;
}

class MockBroadcastChannel {
	public static readonly instances: MockBroadcastChannel[] = [];
	public static readonly channelsByName = new Map<string, MockBroadcastChannel[]>();

	public readonly name: string;
	public closed = false;
	private readonly _listeners = new Set<(message: MockMessageEvent) => void>();

	public constructor(name: string) {
		this.name = name;
		MockBroadcastChannel.channelsByName.set(name, [...(MockBroadcastChannel.channelsByName.get(name) ?? []), this]);
		MockBroadcastChannel.instances.push(this);
	}

	public postMessage(data: unknown): void {
		for (const instance of MockBroadcastChannel.channelsByName.get(this.name) ?? []) {
			if (instance === this || instance.closed) continue;
			instance._listeners.forEach((listener) => {
				listener({ data });
			});
		}
	}

	public addEventListener(_type: "message", listener: (message: MockMessageEvent) => void): void {
		this._listeners.add(listener);
	}

	public removeEventListener(_type: "message", listener: (message: MockMessageEvent) => void): void {
		this._listeners.delete(listener);
	}

	public close(): void {
		this.closed = true;
	}
}

beforeEach(() => {
	MockBroadcastChannel.instances.length = 0;
	MockBroadcastChannel.channelsByName.clear();
	vi.stubGlobal("BroadcastChannel", MockBroadcastChannel);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("createAuthChannel", () => {
	it("delivers posts to subscribers on the same channel name", () => {
		const a = createAuthChannel("test:one");
		const b = createAuthChannel("test:one");

		const received: AuthSyncEvent[] = [];
		b.subscribe((event) => {
			received.push(event);
		});

		a.post("logged-out");

		expect(received).toEqual(["logged-out"]);
	});

	it("does not deliver to a different channel name", () => {
		const a = createAuthChannel("test:web");
		const b = createAuthChannel("test:admin");

		const received: AuthSyncEvent[] = [];
		b.subscribe((event) => {
			received.push(event);
		});

		a.post("logged-in");

		expect(received).toEqual([]);
	});

	it("ignores unknown message payloads", () => {
		createAuthChannel("test:one");
		const b = createAuthChannel("test:one");

		const received: AuthSyncEvent[] = [];
		b.subscribe((event) => {
			received.push(event);
		});

		// Post garbage directly through the underlying channel.
		const instance = MockBroadcastChannel.instances.find((channel) => channel.name === "test:one");
		instance?.postMessage("definitely-not-an-auth-event");

		expect(received).toEqual([]);
	});

	it("unsubscribes without further deliveries", () => {
		const a = createAuthChannel("test:one");
		const b = createAuthChannel("test:one");

		const received: AuthSyncEvent[] = [];
		const unsubscribe = b.subscribe((event) => {
			received.push(event);
		});
		unsubscribe();

		a.post("logged-out");

		expect(received).toEqual([]);
	});

	it("no-ops safely when BroadcastChannel is unavailable (jsdom/old browsers)", () => {
		vi.stubGlobal("BroadcastChannel", undefined);

		const channel = createAuthChannel("test:none");
		const unsubscribe = channel.subscribe((): void => undefined);

		expect(() => {
			channel.post("logged-out");
		}).not.toThrow();
		expect(() => {
			channel.close();
		}).not.toThrow();
		unsubscribe();
	});
});
