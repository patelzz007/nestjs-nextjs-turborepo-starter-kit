import { beforeEach, describe, expect, it, vi } from "vitest";
import { KafkaTopicSchema, type OutboxEnqueueInput } from "@workspace/shared";

import { CorrelationContextService } from "../../common/context/correlation-context.service";
import { PrismaService } from "../../prisma/prisma.service";
import { currentRlsContextOrUnscoped, rlsStorage, type RlsContext } from "../../prisma/rls-context";
import { PlatformOutboxService, type OutboxWriter } from "./platform-outbox.service";

const mocks = vi.hoisted(() => ({
	scopes: new Array<RlsContext>(),
	txCreates: 0,
}));

vi.mock("../../prisma/prisma.service", () => ({
	PrismaService: class {
		public readonly outboxEvent = {
			create: async (): Promise<{ id: string }> => {
				mocks.scopes.push(currentRlsContextOrUnscoped());
				return { id: "evt-1" };
			},
		};
	},
}));

const input: OutboxEnqueueInput = {
	topic: KafkaTopicSchema.options[0],
	eventType: "session.revoked",
	partitionKey: "user-1",
	correlationId: null,
	payload: { userId: "user-1" },
};

/**
 * Regression: refresh / logout run under a user-scoped (non-bypass) RLS
 * context, and `outbox_events` is bypass-only — the enqueue failed with
 * "new row violates row-level security policy". Recording an event is an
 * allowlisted system operation independent of the requester's row scope.
 */
describe("PlatformOutboxService.enqueue", () => {
	beforeEach(() => {
		mocks.scopes.length = 0;
		mocks.txCreates = 0;
	});

	it("writes under the outbox.enqueue system operation even inside a user-scoped request", async () => {
		const service = new PlatformOutboxService(new PrismaService(), new CorrelationContextService());
		const userScope: RlsContext = { userId: "user-1", bypass: false, organizationId: "", requireExplicitContext: false, systemOperation: "" };

		const id = await rlsStorage.run(userScope, async () => service.enqueue(input));

		expect(id).toBe("evt-1");
		expect(mocks.scopes).toEqual([expect.objectContaining({ bypass: true, systemOperation: "outbox.enqueue" })]);
	});

	it("uses the caller's transaction (and its RLS session) when one is given", async () => {
		const service = new PlatformOutboxService(new PrismaService(), new CorrelationContextService());
		const tx: OutboxWriter = {
			outboxEvent: {
				create: async () => {
					mocks.txCreates += 1;
					return { id: "evt-tx" };
				},
			},
		};

		expect(await service.enqueue(input, tx)).toBe("evt-tx");
		expect(mocks.txCreates).toBe(1);
		expect(mocks.scopes).toEqual([]);
	});
});
