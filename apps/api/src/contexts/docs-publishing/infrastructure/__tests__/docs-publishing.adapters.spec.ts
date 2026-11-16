import type { DocsSyncRun } from "@prisma/client";
import { DocsSyncRunListQuerySchema, epochMs, type EpochMs } from "@workspace/shared";
import { describe, expect, it, vi } from "vitest";

import { FixedClock } from "../../../../platform/application/__tests__/fixed-clock";
import { RedisNamespace } from "../../../../platform/infrastructure/redis/redis-namespace";
import { DocsSyncDispatchError, GithubWorkflowDispatcher } from "../github-workflow.dispatcher";
import { buildDocsSyncRunListWhere, toDocsSyncRunDetail, toDocsSyncRunSummary } from "../prisma-docs-sync-run.repository";
import { HANDSHAKE_TTL_MS, InMemoryWebhookHandshakeStore, RedisWebhookHandshakeStore, type HandshakeRedis } from "../webhook-handshake.stores";

const NOW = epochMs(1_800_000_000_000);

describe("GithubWorkflowDispatcher", () => {
	const target = { token: "gh-token", repository: "acme/kit", ref: "main" };

	it("starts the one fixed workflow on the one fixed branch", async () => {
		const send = vi.fn<(url: string, init: RequestInit) => Promise<Response>>().mockResolvedValue(new Response(null, { status: 204 }));

		await new GithubWorkflowDispatcher(target, send).dispatch({ trigger: "WEBHOOK", full: false });

		const [url, init] = send.mock.calls.at(0) ?? [];
		expect(url).toBe("https://api.github.com/repos/acme/kit/actions/workflows/docs-sync.yml/dispatches");
		expect(init?.body).toBe('{"ref":"main","inputs":{"trigger":"WEBHOOK","full":"false"}}');
		expect(init?.headers).toMatchObject({ Authorization: "Bearer gh-token" });
	});

	it("raises a refusal without the credential in it", async () => {
		const failure = new GithubWorkflowDispatcher(target, () => Promise.resolve(new Response("no", { status: 403 }))).dispatch({ trigger: "MANUAL", full: true });

		await expect(failure).rejects.toBeInstanceOf(DocsSyncDispatchError);
		await expect(failure).rejects.not.toThrow("gh-token");
	});
});

describe("InMemoryWebhookHandshakeStore", () => {
	it("forgets a token after the hour", async () => {
		let now: EpochMs = NOW;
		const store = new InMemoryWebhookHandshakeStore("root", { now: (): EpochMs => now });
		await store.put("NOTION", "secret_abc");

		now = epochMs(NOW + HANDSHAKE_TTL_MS);

		await expect(store.find("NOTION")).resolves.toBeNull();
	});
});

describe("RedisWebhookHandshakeStore", () => {
	function fakeRedis(): { readonly redis: HandshakeRedis; readonly values: Map<string, string>; readonly set: ReturnType<typeof vi.fn> } {
		const values = new Map<string, string>();
		const set = vi.fn<HandshakeRedis["set"]>((key: string, value: string) => {
			values.set(key, value);
			return Promise.resolve("OK");
		});
		return { values, set, redis: { get: (key: string) => Promise.resolve(values.get(key) ?? null), set } };
	}

	function store(fake: ReturnType<typeof fakeRedis>, rootSecret = "root"): RedisWebhookHandshakeStore {
		return new RedisWebhookHandshakeStore(fake.redis, new RedisNamespace("test"), rootSecret, new FixedClock(NOW));
	}

	it("keeps the token encrypted, with an expiry", async () => {
		const fake = fakeRedis();

		await store(fake).put("NOTION", "secret_abc");

		expect(fake.set).toHaveBeenCalledWith("test:docs-publishing:handshake:NOTION", expect.any(String), "PX", HANDSHAKE_TTL_MS);
		expect([...fake.values.values()].join("")).not.toContain("secret_abc");
		await expect(store(fake).find("NOTION")).resolves.toMatchObject({ verificationToken: "secret_abc", receivedAt: NOW });
	});

	it("answers null when nothing is waiting", async () => {
		await expect(store(fakeRedis()).find("NOTION")).resolves.toBeNull();
	});

	it("treats a value it cannot open as absent: Notion can send it again", async () => {
		const fake = fakeRedis();
		await store(fake).put("NOTION", "secret_abc");

		await expect(store(fake, "rotated-secret").find("NOTION")).resolves.toBeNull();
	});

	it("treats a malformed value as absent", async () => {
		const fake = fakeRedis();
		fake.values.set("test:docs-publishing:handshake:NOTION", '{"sealedToken":1}');

		await expect(store(fake).find("NOTION")).resolves.toBeNull();
	});
});

describe("run rows", () => {
	const row: DocsSyncRun = {
		id: "0194f3a0-0000-7000-8000-000000000001",
		createdAt: 1n,
		createdBy: null,
		updatedAt: 1n,
		updatedBy: null,
		isDeleted: false,
		deletedAt: null,
		deletedBy: null,
		runId: "run-1",
		source: "NOTION",
		trigger: "WEBHOOK",
		status: "PARTIAL",
		converterVersion: 1,
		pagesProcessed: 1,
		pagesUnchanged: 2,
		pagesRemoved: 0,
		pagesHeldBack: 1,
		warnings: 0,
		heldBack: [{ sourceId: "p", title: "Page", slug: null, sourceUrl: null, issues: [{ blockId: null, blockType: null, reason: "Why.", fix: "How." }] }],
		errorSummary: null,
		pullRequestUrl: null,
		commitSha: null,
		startedAt: 10n,
		finishedAt: 20n,
	};

	it("maps a row to the list and detail contracts", () => {
		expect(toDocsSyncRunSummary(row)).toMatchObject({ runId: "run-1", startedAt: 10, finishedAt: 20 });
		expect(toDocsSyncRunSummary(row)).not.toHaveProperty("heldBack");
		expect(toDocsSyncRunDetail(row).heldBack).toHaveLength(1);
	});

	it("never trusts stored JSON", () => {
		expect(() => toDocsSyncRunDetail({ ...row, heldBack: [{ wrong: true }] })).toThrow();
	});

	it("builds the filter", () => {
		const query = DocsSyncRunListQuerySchema.parse({ filter: { status: { eq: "FAILED" } } });

		expect(buildDocsSyncRunListWhere(query)).toEqual({ AND: [{ status: { equals: "FAILED" } }] });
	});
});
