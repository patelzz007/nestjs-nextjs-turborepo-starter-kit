import { ForbiddenException, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";

import { inMemoryWebhookReceiver, ManualClock } from "../../../../../e2e/support/in-memory-received-webhooks";

import { githubWebhookSignature } from "../../domain/policies/github-webhook-signature.policy";
import { DisableLiveUpdatesCommand } from "../commands/disable-live-updates/disable-live-updates.command";
import { DisableLiveUpdatesHandler } from "../commands/disable-live-updates/disable-live-updates.handler";
import { EnableLiveUpdatesCommand } from "../commands/enable-live-updates/enable-live-updates.command";
import { EnableLiveUpdatesHandler } from "../commands/enable-live-updates/enable-live-updates.handler";
import {
	PruneGithubWebhookDeliveriesCommand,
	GITHUB_WEBHOOK_DELIVERY_RETENTION_MS,
} from "../commands/prune-github-webhook-deliveries/prune-github-webhook-deliveries.command";
import { PruneGithubWebhookDeliveriesHandler } from "../commands/prune-github-webhook-deliveries/prune-github-webhook-deliveries.handler";
import { RecordGithubWebhookDeliveryCommand } from "../commands/record-github-webhook-delivery/record-github-webhook-delivery.command";
import { RecordGithubWebhookDeliveryHandler } from "../commands/record-github-webhook-delivery/record-github-webhook-delivery.handler";
import { GITHUB_LIVE_UPDATES_OFF_CODE, GITHUB_WEBHOOK_SIGNATURE_INVALID_CODE, GithubAccountNotLinkedError, GithubWriteRejectedError } from "../errors/github.errors";
import { CheckLiveUpdatesStreamHandler } from "../queries/check-live-updates-stream/check-live-updates-stream.handler";
import { CheckLiveUpdatesStreamQuery } from "../queries/check-live-updates-stream/check-live-updates-stream.query";
import { GetLiveUpdatesStatusHandler } from "../queries/get-live-updates-status/get-live-updates-status.handler";
import { GetLiveUpdatesStatusQuery } from "../queries/get-live-updates-status/get-live-updates-status.query";
import { anonymousActor, AT, userActor } from "./fakes/github-contract.fixtures";
import { githubHarness, linkToken, type GithubHarness } from "./fakes/github-harness";

const SECRET = "webhook-secret";
const REPO = { owner: "Octo-Org", repository: "Hello-World" };
const REPOSITORY_PAYLOAD = { repository: { name: "Hello-World", owner: { login: "Octo-Org" } } };

function enable(harness: GithubHarness): EnableLiveUpdatesHandler {
	return new EnableLiveUpdatesHandler(harness.credentials, harness.endpoint, harness.webhooks, harness.store, harness.liveUpdates);
}

function disable(harness: GithubHarness): DisableLiveUpdatesHandler {
	return new DisableLiveUpdatesHandler(harness.credentials, harness.endpoint, harness.webhooks, harness.store, harness.liveUpdates, harness.clock);
}

/** Every handler of one test shares one received-webhook log, as every request of one server does. */
let inbound: ReturnType<typeof inMemoryWebhookReceiver> = inMemoryWebhookReceiver(new ManualClock(AT));

function receive(harness: GithubHarness): RecordGithubWebhookDeliveryHandler {
	return new RecordGithubWebhookDeliveryHandler(harness.endpoint, harness.store, harness.clock, inbound.receiver);
}

/** A delivery exactly as GitHub posts it: the raw body, its event and delivery headers, and a signature of the body. */
function signedDelivery(event: string, rawBody: Buffer, deliveryId: string, signature: string | undefined): RecordGithubWebhookDeliveryCommand {
	return new RecordGithubWebhookDeliveryCommand(anonymousActor(), {
		request: { rawBody, headers: { "x-github-event": event, "x-github-delivery": deliveryId, "x-hub-signature-256": signature, "content-type": "application/json" } },
	});
}

function delivery(event: string, payload: object, deliveryId = "delivery-1"): RecordGithubWebhookDeliveryCommand {
	const rawBody = Buffer.from(JSON.stringify(payload));
	return signedDelivery(event, rawBody, deliveryId, githubWebhookSignature(SECRET, rawBody));
}

async function linked(): Promise<GithubHarness> {
	const harness = githubHarness();
	await linkToken(harness);
	return harness;
}

describe("RecordGithubWebhookDeliveryHandler", () => {
	beforeEach(() => {
		inbound = inMemoryWebhookReceiver(new ManualClock(AT));
	});

	it("records a pull-request event once and announces which pull request changed", async () => {
		const harness = githubHarness();

		await expect(
			receive(harness).execute(delivery("pull_request", { ...REPOSITORY_PAYLOAD, action: "synchronize", pull_request: { number: 42, title: "never read" } })),
		).resolves.toBe("recorded");

		expect([...harness.store.deliveries.values()]).toEqual([
			{
				deliveryId: "delivery-1",
				event: "pull_request",
				owner: "Octo-Org",
				repository: "Hello-World",
				pullRequestNumber: 42,
				receivedAt: AT,
				announcement: JSON.stringify({ owner: "Octo-Org", repository: "Hello-World", number: 42 }),
			},
		]);
	});

	it("answers a redelivery as a duplicate and announces nothing twice", async () => {
		const harness = githubHarness();
		const command = delivery("pull_request_review", { ...REPOSITORY_PAYLOAD, pull_request: { number: 42 } });

		await receive(harness).execute(command);
		await expect(receive(harness).execute(command)).resolves.toBe("duplicate");
		expect(harness.store.announcements).toHaveLength(1);
		// The redelivery is answered from the received-webhook log, without reaching GitHub's own table.
		expect(inbound.store.rows).toEqual([
			expect.objectContaining({
				provider: "GITHUB",
				providerDeliveryId: "delivery-1",
				eventType: "pull_request_review",
				outcome: "RECORDED",
				httpStatus: 200,
				duplicateCount: 1,
			}),
		]);
	});

	it("still answers duplicate when GitHub's own table already had the delivery (recorded before the log existed)", async () => {
		const harness = githubHarness();
		await receive(harness).execute(delivery("pull_request", { ...REPOSITORY_PAYLOAD, pull_request: { number: 42 } }));
		inbound = inMemoryWebhookReceiver(new ManualClock(AT));

		await expect(receive(harness).execute(delivery("pull_request", { ...REPOSITORY_PAYLOAD, pull_request: { number: 42 } }))).resolves.toBe("duplicate");
		expect(inbound.store.rows).toEqual([expect.objectContaining({ outcome: "DUPLICATE", httpStatus: 200 })]);
		expect(harness.store.announcements).toHaveLength(1);
	});

	it("logs a ping and an unused event as ignored", async () => {
		const harness = githubHarness();

		await receive(harness).execute(delivery("ping", { zen: "Design for failure." }, "ping-1"));
		await receive(harness).execute(delivery("push", REPOSITORY_PAYLOAD, "push-1"));

		expect(inbound.store.rows.map((row) => [row.providerDeliveryId, row.eventType, row.outcome])).toEqual([
			["ping-1", "ping", "IGNORED"],
			["push-1", "push", "IGNORED"],
		]);
	});

	it("takes a comment on a pull request, and ignores one on an issue", async () => {
		const harness = githubHarness();

		await expect(
			receive(harness).execute(delivery("issue_comment", { ...REPOSITORY_PAYLOAD, issue: { number: 7, pull_request: { url: "https://api.github.com/x" } } })),
		).resolves.toBe("recorded");
		await expect(receive(harness).execute(delivery("issue_comment", { ...REPOSITORY_PAYLOAD, issue: { number: 8 } }, "delivery-2"))).resolves.toBe("ignored");
		expect(harness.store.deliveries.size).toBe(1);
	});

	it("records a repository-wide change (no pull request) with no number", async () => {
		const harness = githubHarness();

		await expect(receive(harness).execute(delivery("pull_request_review_thread", REPOSITORY_PAYLOAD))).resolves.toBe("recorded");
		expect(harness.store.announcements).toEqual([JSON.stringify({ owner: "Octo-Org", repository: "Hello-World", number: null })]);
	});

	it("answers GitHub's ping, and ignores events it does not use or cannot read", async () => {
		const harness = githubHarness();
		const garbled = Buffer.from("not json");

		await expect(receive(harness).execute(delivery("ping", { zen: "Keep it logically awesome." }, "ping-1"))).resolves.toBe("ping");
		await expect(receive(harness).execute(delivery("push", REPOSITORY_PAYLOAD, "push-1"))).resolves.toBe("ignored");
		await expect(receive(harness).execute(delivery("pull_request", { ...REPOSITORY_PAYLOAD, pull_request: { number: 1 } }, ""))).resolves.toBe("ignored");
		await expect(receive(harness).execute(signedDelivery("pull_request", garbled, "d", githubWebhookSignature(SECRET, garbled)))).resolves.toBe("ignored");
		expect(harness.store.deliveries.size).toBe(0);
	});

	it("refuses a delivery whose signature does not match with 403, before reading it", async () => {
		const harness = githubHarness();
		const rawBody = Buffer.from(JSON.stringify({ ...REPOSITORY_PAYLOAD, pull_request: { number: 1 } }));
		const forged = signedDelivery("pull_request", rawBody, "d", githubWebhookSignature("another secret", rawBody));

		const failure = receive(harness).execute(forged);

		await expect(failure).rejects.toBeInstanceOf(ForbiddenException);
		await expect(failure).rejects.toMatchObject({ response: { error: GITHUB_WEBHOOK_SIGNATURE_INVALID_CODE } });
		await expect(receive(harness).execute(signedDelivery("pull_request", rawBody, "d", undefined))).rejects.toBeInstanceOf(ForbiddenException);
		expect(harness.store.deliveries.size).toBe(0);
		// Both refusals are logged, neither claims the delivery id (a forged request can never block the real one).
		expect(inbound.store.rows.map((row) => [row.verification, row.outcome, row.httpStatus, row.providerDeliveryId])).toEqual([
			["INVALID", "REJECTED", 403, null],
			["MISSING", "REJECTED", 403, null],
		]);
	});

	it("receives nothing when this server has no webhook settings", async () => {
		const harness = githubHarness();
		harness.endpoint.settings = null;

		const failure = receive(harness).execute(delivery("ping", {}));

		await expect(failure).rejects.toBeInstanceOf(ServiceUnavailableException);
		await expect(failure).rejects.toMatchObject({ response: { error: GITHUB_LIVE_UPDATES_OFF_CODE } });
		expect(inbound.store.rows).toEqual([expect.objectContaining({ verification: "NOT_CONFIGURED", outcome: "REJECTED", httpStatus: 503 })]);
	});
});

describe("live updates on and off", () => {
	it("is off without webhook settings, otherwise disabled or enabled per repository", async () => {
		const harness = githubHarness();
		const status = new GetLiveUpdatesStatusHandler(harness.liveUpdates);

		await expect(status.execute(new GetLiveUpdatesStatusQuery(userActor(), REPO))).resolves.toEqual({ status: "disabled" });
		await harness.store.claim(REPO, 7n);
		await expect(status.execute(new GetLiveUpdatesStatusQuery(userActor(), { owner: "octo-org", repository: "hello-world" }))).resolves.toEqual({
			status: "enabled",
			enabledAt: AT,
		});
		harness.endpoint.settings = null;
		await expect(status.execute(new GetLiveUpdatesStatusQuery(userActor(), REPO))).resolves.toEqual({ status: "off" });
	});

	it("registers the webhook with the caller's token and claims the repository", async () => {
		const harness = await linked();

		await expect(enable(harness).execute(new EnableLiveUpdatesCommand(userActor(), REPO))).resolves.toEqual({ status: "enabled", enabledAt: AT });
		expect(harness.webhooks.created).toEqual([7n]);
		expect(harness.store.subscriptions.get("octo-org/hello-world")?.githubHookId).toBe(7n);
		expect(harness.webhooks.deleted).toEqual([]);
	});

	it("deletes its own hook when someone else's won the repository", async () => {
		const harness = await linked();
		harness.store.racingHookId = 99n;

		await enable(harness).execute(new EnableLiveUpdatesCommand(userActor(), REPO));

		expect(harness.webhooks.deleted).toEqual([7n]);
		expect(harness.store.subscriptions.get("octo-org/hello-world")?.githubHookId).toBe(99n);
	});

	it("never deletes the shared hook when GitHub handed back the same one", async () => {
		const harness = await linked();
		harness.webhooks.createFailures.push(new GithubWriteRejectedError("unprocessable", "Hook already exists on this repository", "Octo-Org/Hello-World", "Webhooks"));

		await enable(harness).execute(new EnableLiveUpdatesCommand(userActor(), REPO));
		await harness.store.release(REPO, 7n);
		await enable(harness).execute(new EnableLiveUpdatesCommand(userActor(), REPO));

		expect(harness.webhooks.created).toEqual([7n, 8n]);
		expect(harness.webhooks.deleted).toEqual([]);
	});

	it("leaves an enabled repository as it is", async () => {
		const harness = await linked();
		await harness.store.claim(REPO, 7n);

		await expect(enable(harness).execute(new EnableLiveUpdatesCommand(userActor(), REPO))).resolves.toEqual({ status: "enabled", enabledAt: AT });
		expect(harness.webhooks.created).toEqual([]);
	});

	it("passes on a refusal GitHub gave for another reason", async () => {
		const harness = await linked();
		harness.webhooks.createFailures.push(new GithubWriteRejectedError("forbidden", "", "Octo-Org/Hello-World", "Webhooks"));

		await expect(enable(harness).execute(new EnableLiveUpdatesCommand(userActor(), REPO))).rejects.toBeInstanceOf(GithubWriteRejectedError);
		expect(harness.store.subscriptions.size).toBe(0);
	});

	it("refuses to turn live updates on when this server receives no webhooks, and asks to link a token first", async () => {
		const off = await linked();
		off.endpoint.settings = null;
		await expect(enable(off).execute(new EnableLiveUpdatesCommand(userActor(), REPO))).rejects.toBeInstanceOf(ServiceUnavailableException);

		await expect(enable(githubHarness()).execute(new EnableLiveUpdatesCommand(userActor(), REPO))).rejects.toBeInstanceOf(GithubAccountNotLinkedError);
	});

	it("deletes the hook on GitHub, then turns the repository off", async () => {
		const harness = await linked();
		await harness.store.claim(REPO, 7n);

		await expect(disable(harness).execute(new DisableLiveUpdatesCommand(userActor(), REPO))).resolves.toEqual({ status: "disabled" });
		expect(harness.webhooks.deleted).toEqual([7n]);
		expect(harness.store.subscriptions.size).toBe(0);
	});

	it("leaves a disabled repository as it is, and is off without webhook settings", async () => {
		const harness = await linked();

		await expect(disable(harness).execute(new DisableLiveUpdatesCommand(userActor(), REPO))).resolves.toEqual({ status: "disabled" });
		expect(harness.webhooks.deleted).toEqual([]);
		harness.endpoint.settings = null;
		await expect(disable(harness).execute(new DisableLiveUpdatesCommand(userActor(), REPO))).resolves.toEqual({ status: "off" });
	});
});

describe("CheckLiveUpdatesStreamHandler", () => {
	it("lets a stream open for a repository the caller's token can see", async () => {
		const harness = await linked();

		await expect(
			new CheckLiveUpdatesStreamHandler(harness.credentials, harness.endpoint, harness.webhooks).execute(new CheckLiveUpdatesStreamQuery(userActor(), REPO)),
		).resolves.toBeUndefined();
	});

	it("opens no stream for a repository the caller's token cannot see (404), nor when live updates are off (503)", async () => {
		const harness = await linked();
		harness.webhooks.visible = false;
		const check = new CheckLiveUpdatesStreamHandler(harness.credentials, harness.endpoint, harness.webhooks);

		await expect(check.execute(new CheckLiveUpdatesStreamQuery(userActor(), REPO))).rejects.toBeInstanceOf(NotFoundException);
		harness.endpoint.settings = null;
		await expect(check.execute(new CheckLiveUpdatesStreamQuery(userActor(), REPO))).rejects.toBeInstanceOf(ServiceUnavailableException);
	});
});

describe("PruneGithubWebhookDeliveriesHandler", () => {
	it("deletes deliveries received more than a week ago, keeping the one exactly at the boundary", async () => {
		const harness = githubHarness();
		const boundary = AT - GITHUB_WEBHOOK_DELIVERY_RETENTION_MS;
		for (const [deliveryId, receivedAt] of [
			["old", boundary - 1],
			["edge", boundary],
			["new", AT],
		] satisfies [string, number][]) {
			await harness.store.record({ deliveryId, event: "pull_request", owner: "o", repository: "r", pullRequestNumber: 1, receivedAt, announcement: "{}" });
		}

		await expect(new PruneGithubWebhookDeliveriesHandler(harness.store, harness.clock).execute(new PruneGithubWebhookDeliveriesCommand(userActor()))).resolves.toBe(1);
		expect([...harness.store.deliveries.keys()]).toEqual(["edge", "new"]);
		expect(harness.store.prunedBefore).toEqual([boundary]);
	});
});
