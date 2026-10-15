import { afterEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import type { ListenConnection } from "../../../infrastructure/database/pg-listen-connection";
import { GithubPullRequestCache } from "../pull-requests/github-pull-request.cache";
import { GithubPullRequestChangesHub, type GithubChangeSignal } from "./github-pull-request-changes.hub";
import { GITHUB_PULL_REQUEST_CHANNEL } from "./github-webhook.repository";

const WEBHOOK = { GITHUB_WEBHOOK_URL: "https://api.example.com/api/v1/github/webhook", GITHUB_WEBHOOK_SECRET: "s".repeat(40) };

/** A listen connection the test drives. */
class FakeConnection implements ListenConnection {
	public readonly listened: string[] = [];
	public closed = false;
	private notificationListener: (channel: string, payload: string | null) => void = (): void => undefined;
	private closeListener: (error: Error | null) => void = (): void => undefined;

	public connect(): Promise<void> {
		return Promise.resolve();
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

	public notify(payload: string | null): void {
		this.notificationListener(GITHUB_PULL_REQUEST_CHANNEL, payload);
	}

	public drop(): void {
		this.closeListener(new Error("connection reset"));
	}
}

interface Harness {
	readonly hub: GithubPullRequestChangesHub;
	readonly connections: FakeConnection[];
	readonly signals: GithubChangeSignal[];
	readonly invalidatePullRequest: MockInstance<GithubPullRequestCache["invalidatePullRequest"]>;
	readonly invalidateRepository: MockInstance<GithubPullRequestCache["invalidateRepository"]>;
}

function setup(env: Readonly<Record<string, string>> = WEBHOOK): Harness {
	const connections: FakeConnection[] = [];
	const cache = new GithubPullRequestCache({ nowEpochMs: (): number => 0 });
	const invalidatePullRequest = vi.spyOn(cache, "invalidatePullRequest");
	const invalidateRepository = vi.spyOn(cache, "invalidateRepository");
	const hub = new GithubPullRequestChangesHub(createTestTypedConfig(env), cache, (): FakeConnection => {
		const connection = new FakeConnection();
		connections.push(connection);
		return connection;
	});
	const signals: GithubChangeSignal[] = [];
	hub.observe().subscribe((signal: GithubChangeSignal): void => {
		signals.push(signal);
	});
	return { hub, connections, signals, invalidatePullRequest, invalidateRepository };
}

afterEach(() => {
	vi.useRealTimers();
});

describe("GithubPullRequestChangesHub", () => {
	it("listens only when this server receives webhooks", async () => {
		const off = setup({});
		off.hub.onModuleInit();
		expect(off.connections).toHaveLength(0);

		const on = setup();
		on.hub.onModuleInit();
		await vi.waitFor(() => {
			expect(on.connections.at(0)?.listened).toEqual([GITHUB_PULL_REQUEST_CHANNEL]);
		});
		await on.hub.onModuleDestroy();
		expect(on.connections.at(0)?.closed).toBe(true);
	});

	it("drops the cached reads of the pull request that changed, then tells the streams", async () => {
		const { hub, connections, signals, invalidatePullRequest, invalidateRepository } = setup();
		hub.onModuleInit();
		await vi.waitFor(() => {
			expect(connections).toHaveLength(1);
		});

		connections.at(0)?.notify(JSON.stringify({ owner: "octo-org", repository: "hello-world", number: 42 }));
		connections.at(0)?.notify(JSON.stringify({ owner: "octo-org", repository: "hello-world", number: null }));

		expect(invalidatePullRequest).toHaveBeenCalledWith("octo-org", "hello-world", 42);
		expect(invalidateRepository).toHaveBeenCalledWith("octo-org", "hello-world");
		expect(signals).toEqual([
			{ kind: "change", change: { owner: "octo-org", repository: "hello-world", number: 42 } },
			{ kind: "change", change: { owner: "octo-org", repository: "hello-world", number: null } },
		]);
		await hub.onModuleDestroy();
	});

	it("ignores an announcement it cannot read", async () => {
		const { hub, connections, signals } = setup();
		hub.onModuleInit();
		await vi.waitFor(() => {
			expect(connections).toHaveLength(1);
		});

		connections.at(0)?.notify("not json");
		connections.at(0)?.notify(JSON.stringify({ owner: "octo-org" }));
		connections.at(0)?.notify(null);

		expect(signals).toEqual([]);
		await hub.onModuleDestroy();
	});

	it("reconnects after losing its connection, and tells the streams to reload what they may have missed", async () => {
		vi.useFakeTimers();
		const { hub, connections, signals } = setup();
		hub.onModuleInit();
		await vi.waitFor(() => {
			expect(connections).toHaveLength(1);
		});

		connections.at(0)?.drop();
		await vi.advanceTimersByTimeAsync(1_000);

		expect(connections).toHaveLength(2);
		expect(signals).toEqual([{ kind: "resync" }]);
		await hub.onModuleDestroy();
	});
});
