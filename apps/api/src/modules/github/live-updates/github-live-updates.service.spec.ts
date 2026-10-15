import { ForbiddenException, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { firstValueFrom, take, toArray, Subject } from "rxjs";
import { describe, expect, it, vi, type Mock } from "vitest";

import { TypedConfigService } from "../../../config/typed-config.service";
import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { GITHUB_CLOCK } from "../github-contributions.service";
import { GithubCredentialsService, type LinkedGithubCredential } from "../pull-requests/github-credentials.service";
import { GithubLiveUpdatesService } from "./github-live-updates.service";
import { GithubPullRequestChangesHub, type GithubChangeSignal } from "./github-pull-request-changes.hub";
import { GithubWebhookRepository, type GithubWebhookDeliveryInput } from "./github-webhook.repository";
import { githubWebhookSignature } from "./github-webhook-signature";
import { GithubWebhooksClient } from "./github-webhooks.client";

const LINKED: LinkedGithubCredential = { credential: { source: "linked", token: "github_pat_linked" }, login: "octocat" };
const SECRET = "s".repeat(40);
const WEBHOOK = { GITHUB_WEBHOOK_URL: "https://api.example.com/api/v1/github/webhook", GITHUB_WEBHOOK_SECRET: SECRET };
const REPO = { owner: "Octo-Org", repository: "Hello-World" };
const NOW = 1_800_000_000_000;

interface Harness {
	readonly service: GithubLiveUpdatesService;
	readonly findLive: Mock<GithubWebhookRepository["findLive"]>;
	readonly claim: Mock<GithubWebhookRepository["claim"]>;
	readonly release: Mock<GithubWebhookRepository["release"]>;
	readonly record: Mock<GithubWebhookRepository["record"]>;
	readonly createHook: Mock<GithubWebhooksClient["createHook"]>;
	readonly deleteHook: Mock<GithubWebhooksClient["deleteHook"]>;
	readonly canSee: Mock<GithubWebhooksClient["canSee"]>;
	readonly signals: Subject<GithubChangeSignal>;
}

async function setup(env: Readonly<Record<string, string>> = WEBHOOK): Promise<Harness> {
	const findLive = vi.fn<GithubWebhookRepository["findLive"]>(() => Promise.resolve(null));
	const claim = vi.fn<GithubWebhookRepository["claim"]>(() => Promise.resolve(true));
	const release = vi.fn<GithubWebhookRepository["release"]>(() => Promise.resolve());
	const record = vi.fn<GithubWebhookRepository["record"]>(() => Promise.resolve(true));
	const createHook = vi.fn<GithubWebhooksClient["createHook"]>(() => Promise.resolve(7n));
	const deleteHook = vi.fn<GithubWebhooksClient["deleteHook"]>(() => Promise.resolve());
	const canSee = vi.fn<GithubWebhooksClient["canSee"]>(() => Promise.resolve(true));
	const signals = new Subject<GithubChangeSignal>();
	const withCredential = vi.fn(<T>(_userId: string, use: (linked: LinkedGithubCredential) => Promise<T>): Promise<T> => use(LINKED));
	const moduleRef = await Test.createTestingModule({
		providers: [
			GithubLiveUpdatesService,
			{ provide: TypedConfigService, useValue: createTestTypedConfig(env) },
			{ provide: GithubCredentialsService, useValue: { withCredential } },
			{ provide: GithubWebhooksClient, useValue: { createHook, deleteHook, canSee } },
			{ provide: GithubWebhookRepository, useValue: { findLive, claim, release, record } },
			{ provide: GithubPullRequestChangesHub, useValue: { observe: (): Subject<GithubChangeSignal> => signals } },
			{ provide: GITHUB_CLOCK, useValue: { nowEpochMs: (): number => NOW } },
		],
	}).compile();
	return { service: moduleRef.get(GithubLiveUpdatesService), findLive, claim, release, record, createHook, deleteHook, canSee, signals };
}

function delivery(event: string, payload: object, id = "delivery-1"): { readonly headers: Parameters<GithubLiveUpdatesService["receive"]>[0]; readonly body: Buffer } {
	const body = Buffer.from(JSON.stringify(payload));
	return { headers: { event, deliveryId: id, signature: githubWebhookSignature(SECRET, body) }, body };
}

const REPOSITORY_PAYLOAD = { repository: { name: "Hello-World", owner: { login: "Octo-Org" } } };

describe("GithubLiveUpdatesService.receive", () => {
	it("records a pull-request event once and announces which pull request changed", async () => {
		const { service, record } = await setup();
		const { headers, body } = delivery("pull_request", { ...REPOSITORY_PAYLOAD, action: "synchronize", pull_request: { number: 42, title: "never read" } });

		await expect(service.receive(headers, body)).resolves.toBe("recorded");

		const recorded: GithubWebhookDeliveryInput | undefined = record.mock.calls.at(0)?.at(0);
		expect(recorded).toEqual({
			deliveryId: "delivery-1",
			event: "pull_request",
			owner: "Octo-Org",
			repository: "Hello-World",
			pullRequestNumber: 42,
			receivedAt: NOW,
			announcement: JSON.stringify({ owner: "Octo-Org", repository: "Hello-World", number: 42 }),
		});
	});

	it("answers a redelivery as a duplicate", async () => {
		const { service, record } = await setup();
		record.mockResolvedValueOnce(false);
		const { headers, body } = delivery("pull_request_review", { ...REPOSITORY_PAYLOAD, pull_request: { number: 42 } });

		await expect(service.receive(headers, body)).resolves.toBe("duplicate");
	});

	it("takes a comment on a pull request, and ignores one on an issue", async () => {
		const { service, record } = await setup();
		const onPullRequest = delivery("issue_comment", { ...REPOSITORY_PAYLOAD, issue: { number: 7, pull_request: { url: "https://api.github.com/x" } } });
		const onIssue = delivery("issue_comment", { ...REPOSITORY_PAYLOAD, issue: { number: 8 } }, "delivery-2");

		await expect(service.receive(onPullRequest.headers, onPullRequest.body)).resolves.toBe("recorded");
		await expect(service.receive(onIssue.headers, onIssue.body)).resolves.toBe("ignored");
		expect(record).toHaveBeenCalledTimes(1);
	});

	it("answers GitHub's ping, and ignores events it does not use or cannot read", async () => {
		const { service, record } = await setup();
		const ping = delivery("ping", { zen: "Keep it logically awesome." });
		const push = delivery("push", REPOSITORY_PAYLOAD);
		const garbled = Buffer.from("not json");

		await expect(service.receive(ping.headers, ping.body)).resolves.toBe("ping");
		await expect(service.receive(push.headers, push.body)).resolves.toBe("ignored");
		await expect(service.receive({ event: "pull_request", deliveryId: "d", signature: githubWebhookSignature(SECRET, garbled) }, garbled)).resolves.toBe("ignored");
		expect(record).not.toHaveBeenCalled();
	});

	it("refuses a delivery whose signature does not match, before reading it", async () => {
		const { service, record } = await setup();
		const { body } = delivery("pull_request", { ...REPOSITORY_PAYLOAD, pull_request: { number: 1 } });

		await expect(
			service.receive({ event: "pull_request", deliveryId: "d", signature: githubWebhookSignature("another secret of forty characters......", body) }, body),
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(record).not.toHaveBeenCalled();
	});

	it("receives nothing when this server has no webhook settings", async () => {
		const { service } = await setup({});
		const { headers, body } = delivery("ping", {});

		await expect(service.receive(headers, body)).rejects.toBeInstanceOf(ServiceUnavailableException);
	});
});

describe("GithubLiveUpdatesService: turning live updates on and off", () => {
	it("is off without webhook settings, otherwise off or on per repository", async () => {
		await expect((await setup({})).service.status("user-1", REPO)).resolves.toEqual({ status: "off" });
		const { service, findLive } = await setup();

		await expect(service.status("user-1", REPO)).resolves.toEqual({ status: "disabled" });
		findLive.mockResolvedValueOnce({ githubHookId: 7n, createdAt: NOW });
		await expect(service.status("user-1", REPO)).resolves.toEqual({ status: "enabled", enabledAt: NOW });
	});

	it("registers the webhook with the caller's token and claims the repository", async () => {
		const { service, createHook, claim, findLive } = await setup();
		findLive.mockResolvedValueOnce(null).mockResolvedValueOnce({ githubHookId: 7n, createdAt: NOW });

		await expect(service.enable("user-1", REPO)).resolves.toEqual({ status: "enabled", enabledAt: NOW });
		expect(createHook).toHaveBeenCalledWith(LINKED.credential, REPO, { url: WEBHOOK.GITHUB_WEBHOOK_URL, secret: SECRET });
		expect(claim).toHaveBeenCalledWith(REPO, 7n, "user-1");
	});

	it("deletes its own hook when someone else's won the repository, but never the shared one", async () => {
		const lost = await setup();
		lost.claim.mockResolvedValueOnce(false);
		lost.findLive.mockResolvedValueOnce(null).mockResolvedValue({ githubHookId: 99n, createdAt: NOW });
		await lost.service.enable("user-1", REPO);
		expect(lost.deleteHook).toHaveBeenCalledWith(LINKED.credential, REPO, 7n);

		const same = await setup();
		same.claim.mockResolvedValueOnce(false);
		same.findLive.mockResolvedValueOnce(null).mockResolvedValue({ githubHookId: 7n, createdAt: NOW });
		await same.service.enable("user-1", REPO);
		expect(same.deleteHook).not.toHaveBeenCalled();
	});

	it("leaves an enabled repository as it is", async () => {
		const { service, findLive, createHook } = await setup();
		findLive.mockResolvedValue({ githubHookId: 7n, createdAt: NOW });

		await service.enable("user-1", REPO);

		expect(createHook).not.toHaveBeenCalled();
	});

	it("deletes the hook on GitHub, then turns the repository off", async () => {
		const { service, findLive, deleteHook, release } = await setup();
		findLive.mockResolvedValueOnce({ githubHookId: 7n, createdAt: NOW }).mockResolvedValueOnce(null);

		await expect(service.disable("user-1", REPO)).resolves.toEqual({ status: "disabled" });
		expect(deleteHook).toHaveBeenCalledWith(LINKED.credential, REPO, 7n);
		expect(release).toHaveBeenCalledWith(REPO, 7n, "user-1", NOW);
	});

	it("refuses to turn live updates on when this server receives no webhooks", async () => {
		await expect((await setup({})).service.enable("user-1", REPO)).rejects.toBeInstanceOf(ServiceUnavailableException);
	});
});

describe("GithubLiveUpdatesService.changes", () => {
	it("streams only this repository's changes (names compared without case), and every resync", async () => {
		const { service, signals } = await setup();
		await service.assertCanStream("user-1", { owner: "octo-org", repository: "hello-world" });
		const frames = firstValueFrom(service.changes({ owner: "octo-org", repository: "hello-world" }).pipe(take(2), toArray()));

		signals.next({ kind: "change", change: { owner: "someone", repository: "secret", number: 1 } });
		signals.next({ kind: "change", change: { owner: "Octo-Org", repository: "Hello-World", number: 42 } });
		signals.next({ kind: "resync" });

		await expect(frames).resolves.toEqual([{ kind: "change", change: { owner: "Octo-Org", repository: "Hello-World", number: 42 } }, { kind: "resync" }]);
	});

	it("opens no stream for a repository the caller's token cannot see", async () => {
		const { service, canSee } = await setup();
		canSee.mockResolvedValueOnce(false);

		await expect(service.assertCanStream("user-1", REPO)).rejects.toBeInstanceOf(NotFoundException);
	});
});
