import { CqrsModule } from "@nestjs/cqrs";
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";

import {
	GITHUB_WEBHOOK_DELIVERY_RETENTION_MS,
	PruneGithubWebhookDeliveriesCommand,
} from "../../../application/commands/prune-github-webhook-deliveries/prune-github-webhook-deliveries.command";
import { PruneGithubWebhookDeliveriesHandler } from "../../../application/commands/prune-github-webhook-deliveries/prune-github-webhook-deliveries.handler";
import { AT } from "../../../application/__tests__/fakes/github-contract.fixtures";
import { FixedGithubClock, InMemoryWebhookStore } from "../../../application/__tests__/fakes/github-fakes";
import { RECORDING_COMMAND_DISPATCHER, RecordingCommandDispatcher } from "../../../../../../test/support/recording-command-dispatcher";
import { GITHUB_CLOCK, GITHUB_WEBHOOK_STORE } from "../../../application/ports/github.tokens";
import { GithubWebhookDeliveryRetentionCron } from "../github-webhook-delivery-retention.cron";

/** A store whose prune fails, as a lost database connection would. */
class FailingStore extends InMemoryWebhookStore {
	public override prune(): Promise<number> {
		return Promise.reject(new Error("database unavailable"));
	}
}

async function cronWith(store: InMemoryWebhookStore): Promise<{ readonly cron: GithubWebhookDeliveryRetentionCron; readonly dispatcher: RecordingCommandDispatcher }> {
	const moduleRef = await Test.createTestingModule({
		imports: [CqrsModule.forRoot()],
		providers: [
			RECORDING_COMMAND_DISPATCHER,
			PruneGithubWebhookDeliveriesHandler,
			{ provide: GITHUB_WEBHOOK_STORE, useValue: store },
			{ provide: GITHUB_CLOCK, useValue: new FixedGithubClock() },
		],
	}).compile();
	await moduleRef.init();
	const dispatcher = moduleRef.get(RecordingCommandDispatcher);
	return { cron: new GithubWebhookDeliveryRetentionCron(dispatcher), dispatcher };
}

describe("GithubWebhookDeliveryRetentionCron", () => {
	it("dispatches the prune as a cron system command of the deliveries operation, deleting what is older than a week", async () => {
		const store = new InMemoryWebhookStore();
		await store.record({
			deliveryId: "old",
			event: "pull_request",
			owner: "o",
			repository: "r",
			pullRequestNumber: 1,
			receivedAt: AT - GITHUB_WEBHOOK_DELIVERY_RETENTION_MS - 1,
			announcement: "{}",
		});
		const { cron, dispatcher } = await cronWith(store);

		await cron.prune();

		const [dispatched] = dispatcher.dispatched;
		expect(dispatched?.command).toBeInstanceOf(PruneGithubWebhookDeliveriesCommand);
		expect(dispatched?.command).toMatchObject({ actor: { kind: "system", operation: "github.webhook.deliveries", origin: "cron", tenantId: null, actorUserId: null } });
		expect(dispatched?.origin).toEqual({ kind: "cron", name: "GithubWebhookDeliveryRetentionCron.prune" });
		expect(store.prunedBefore).toEqual([AT - GITHUB_WEBHOOK_DELIVERY_RETENTION_MS]);
		expect(store.deliveries.size).toBe(0);
	});

	it("keeps a week of deliveries", () => {
		expect(GITHUB_WEBHOOK_DELIVERY_RETENTION_MS).toBe(7 * 24 * 60 * 60 * 1_000);
	});

	it("rethrows a failed prune so the failure is audited and logged, not swallowed", async () => {
		const { cron } = await cronWith(new FailingStore());

		await expect(cron.prune()).rejects.toThrow("database unavailable");
	});
});
