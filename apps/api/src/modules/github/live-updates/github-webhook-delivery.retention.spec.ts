import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";

import { GITHUB_CLOCK } from "../github-contributions.service";
import { GithubWebhookRepository } from "./github-webhook.repository";
import { GITHUB_WEBHOOK_DELIVERY_RETENTION_MS, GithubWebhookDeliveryRetention } from "./github-webhook-delivery.retention";

describe("GithubWebhookDeliveryRetention", () => {
	it("prunes deliveries older than a week", async () => {
		const prune = vi.fn<GithubWebhookRepository["prune"]>(() => Promise.resolve(3));
		const moduleRef = await Test.createTestingModule({
			providers: [
				GithubWebhookDeliveryRetention,
				{ provide: GithubWebhookRepository, useValue: { prune } },
				{ provide: GITHUB_CLOCK, useValue: { nowEpochMs: (): number => 10 * GITHUB_WEBHOOK_DELIVERY_RETENTION_MS } },
			],
		}).compile();
		const retention = moduleRef.get(GithubWebhookDeliveryRetention);

		await retention.prune();

		expect(prune).toHaveBeenCalledWith(9 * GITHUB_WEBHOOK_DELIVERY_RETENTION_MS);
		expect(GITHUB_WEBHOOK_DELIVERY_RETENTION_MS).toBe(7 * 24 * 60 * 60 * 1_000);
	});
});
