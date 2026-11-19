import {
	ReceivedWebhookDetailSchema,
	ReceivedWebhookListQuerySchema,
	type PaginatedServiceResult,
	type ReceivedWebhookDetail,
	type ReceivedWebhookListQuery,
	type ReceivedWebhookSummary,
} from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { systemActor, type ActorContext } from "../../../../../platform/application/actor-context";
import { NotFoundError } from "../../../../../platform/application/errors/app-error";
import type { ReceivedWebhookReadPort } from "../ports/received-webhook-read.port";
import { ReceivedWebhookApplicationService } from "../services/received-webhook.application-service";

const VIEWER: ActorContext = systemActor("webhooks.inbound.read", "cli", null, "spec viewer", null);
const RECEIVED_AT = 1_790_000_000_000;
const DELIVERY_ID = "0193f2c4-0000-7000-8000-00000000d001";

const DELIVERY: ReceivedWebhookDetail = ReceivedWebhookDetailSchema.parse({
	id: DELIVERY_ID,
	provider: "GITHUB",
	providerDeliveryId: "gh-1",
	eventType: "push",
	verification: "VALID",
	outcome: "RECORDED",
	httpStatus: 200,
	attempts: 1,
	duplicateCount: 0,
	receivedAt: RECEIVED_AT,
	lastReceivedAt: RECEIVED_AT,
	completedAt: RECEIVED_AT,
	correlationId: null,
	payloadSha256: "a".repeat(64),
	payloadBytes: 2,
	headers: {},
	errorSummary: null,
	claimedAt: null,
});

/** TEST-ONLY read model holding one delivery. */
class OneDelivery implements ReceivedWebhookReadPort {
	public readonly listed: ReceivedWebhookListQuery[] = [];

	public list(_actor: ActorContext, query: ReceivedWebhookListQuery): Promise<PaginatedServiceResult<ReceivedWebhookSummary>> {
		this.listed.push(query);
		return Promise.resolve({ items: [DELIVERY], total: 1, page: 1, limit: query.limit, totalPages: 1, nextCursor: null, hasNext: false, hasPrevious: false });
	}

	public findById(_actor: ActorContext, id: string): Promise<ReceivedWebhookDetail | null> {
		return Promise.resolve(id === DELIVERY_ID ? DELIVERY : null);
	}
}

describe("ReceivedWebhookApplicationService", () => {
	it("lists the received deliveries with the validated list query", async () => {
		const reads = new OneDelivery();
		const query = ReceivedWebhookListQuerySchema.parse({});

		await expect(new ReceivedWebhookApplicationService(reads).list(VIEWER, query)).resolves.toMatchObject({ items: [DELIVERY], total: 1 });
		expect(reads.listed).toEqual([query]);
	});

	it("opens one delivery, and answers 404 for an unknown id", async () => {
		const service = new ReceivedWebhookApplicationService(new OneDelivery());

		await expect(service.get(VIEWER, { id: DELIVERY_ID })).resolves.toBe(DELIVERY);
		await expect(service.get(VIEWER, { id: "0193f2c4-0000-7000-8000-00000000d999" })).rejects.toBeInstanceOf(NotFoundError);
	});
});
