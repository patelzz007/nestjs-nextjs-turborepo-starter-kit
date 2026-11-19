import Redis from "ioredis";
import { vi } from "vitest";

/**
 * TEST-ONLY. A real ioredis client that never connects (`lazyConnect`), with its network calls stubbed:
 * `publish` records (or fails while `failPublish` is set), `subscribe` / `unsubscribe` track the channel
 * list, and an incoming message is simulated with `emit(channel, payload)`.
 */
export class FakeRedis {
	public readonly client: Redis = new Redis({ lazyConnect: true });
	public readonly published: { readonly channel: string; readonly payload: string }[] = [];
	public readonly subscriptions: string[] = [];
	public failPublish = false;

	public constructor() {
		vi.spyOn(this.client, "connect").mockResolvedValue(undefined);
		vi.spyOn(this.client, "publish").mockImplementation((channel: string | Buffer, payload: string | Buffer | number) => {
			if (this.failPublish) {
				return Promise.reject(new Error("redis down"));
			}
			this.published.push({ channel: String(channel), payload: String(payload) });
			return Promise.resolve(1);
		});
		vi.spyOn(this.client, "subscribe").mockImplementation((channel: string | Buffer) => {
			this.subscriptions.push(String(channel));
			return Promise.resolve(1);
		});
		vi.spyOn(this.client, "unsubscribe").mockImplementation((channel: string | Buffer) => {
			this.subscriptions.splice(this.subscriptions.indexOf(String(channel)), 1);
			return Promise.resolve(0);
		});
	}

	public emit(channel: string, payload: string): void {
		this.client.emit("message", channel, payload);
	}
}
