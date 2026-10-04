import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PlatformEventEnvelopeSchema, type PlatformEventInput } from "@workspace/shared";

import { createTestTypedConfig } from "../../../test/support/test-api-env";
import { RequestContextService } from "../../common/context/request-context";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantTransactionService } from "../../prisma/tenant-transaction.service";
import { OUTBOX_ENQUEUE_OPERATION, OutboxEnqueueError, PlatformOutboxService, resolvePartitionKey, type OutboxTransaction } from "./platform-outbox.service";

/**
 * In-memory stand-in for Postgres transaction semantics: rows written through
 * a transaction are only visible after the work resolves (COMMIT); a throw
 * discards them (ROLLBACK). Lets the unit tests prove the outbox writes ONLY
 * through the caller's transaction. The real-database proof lives in
 * `test/transactional-outbox.e2e-spec.ts`.
 */
class FakeTransactionalStore {
	public readonly committed: Prisma.OutboxEventCreateManyInput[] = [];
	public insertedCountOverride: number | null = null;

	public async transaction<T>(work: (tx: OutboxTransaction) => Promise<T>): Promise<T> {
		const staged: Prisma.OutboxEventCreateManyInput[] = [];
		const tx: OutboxTransaction = {
			outboxEvent: {
				createMany: async (args: { data: Prisma.OutboxEventCreateManyInput[] }): Promise<{ readonly count: number }> => {
					staged.push(...args.data);
					return Promise.resolve({ count: this.insertedCountOverride ?? args.data.length });
				},
			},
		};
		const result = await work(tx);
		this.committed.push(...staged);
		return result;
	}
}

const mocks = vi.hoisted(() => ({
	systemOperations: new Array<string>(),
	failSystemTransaction: false,
}));

const store = new FakeTransactionalStore();

vi.mock("../../prisma/tenant-transaction.service", () => ({
	TenantTransactionService: class {
		public async withSystemOperation<T>(context: { readonly operation: string }, handler: (tx: OutboxTransaction) => Promise<T>): Promise<T> {
			mocks.systemOperations.push(context.operation);
			if (mocks.failSystemTransaction) {
				throw new Error("connection terminated");
			}
			return store.transaction(handler);
		}
	},
}));

class DomainRuleViolation extends Error {}

const USER_ID = "8d0f3b0e-1f7a-4c55-9d1e-2f1a6b7c8d90";

const LOGOUT_EVENT: PlatformEventInput = {
	type: "session.action",
	payload: { action: "logout-all", userId: USER_ID, status: "succeeded", error: null, durationMs: 3 },
};

function createService(correlation: RequestContextService = new RequestContextService()): PlatformOutboxService {
	return new PlatformOutboxService(new TenantTransactionService(new PrismaService(createTestTypedConfig()), new RequestContextService()), correlation);
}

describe("PlatformOutboxService.enqueueInTransaction", () => {
	beforeEach(() => {
		store.committed.length = 0;
		store.insertedCountOverride = null;
		mocks.systemOperations.length = 0;
		mocks.failSystemTransaction = false;
	});

	it("writes the event through the caller's transaction and returns its stable id", async () => {
		const eventId = await store.transaction(async (tx) => createService().enqueueInTransaction(tx, LOGOUT_EVENT));

		expect(store.committed).toHaveLength(1);
		const [row] = store.committed;
		expect(row?.id).toBe(eventId);
		expect(eventId).toMatch(/^[0-9a-f-]{36}$/);
		expect(row).toMatchObject({ topic: "platform.sessions", eventType: "session.action", partitionKey: USER_ID, status: "PENDING" });
		expect(mocks.systemOperations).toEqual([]);
	});

	it("drops the event when the domain transaction rolls back", async () => {
		const service = createService();

		await expect(
			store.transaction(async (tx) => {
				await service.enqueueInTransaction(tx, LOGOUT_EVENT);
				throw new DomainRuleViolation("domain write rejected after the event was staged");
			}),
		).rejects.toBeInstanceOf(DomainRuleViolation);

		expect(store.committed).toEqual([]);
	});

	it("assigns a fresh id per event so every row is independently dedupable", async () => {
		const service = createService();
		const ids = await store.transaction(async (tx) => Promise.all([service.enqueueInTransaction(tx, LOGOUT_EVENT), service.enqueueInTransaction(tx, LOGOUT_EVENT)]));

		expect(new Set(ids).size).toBe(2);
	});

	it("stores a valid envelope stamped with the request correlation id", async () => {
		const correlation = new RequestContextService();
		const service = createService(correlation);

		await correlation.run({ correlationId: "corr-42", ip: undefined, userAgent: undefined }, async () =>
			store.transaction(async (tx) => service.enqueueInTransaction(tx, LOGOUT_EVENT)),
		);

		const envelope = PlatformEventEnvelopeSchema.parse(store.committed[0]?.payload);
		expect(envelope).toMatchObject({ type: "session.action", correlationId: "corr-42", payload: LOGOUT_EVENT.payload });
		expect(store.committed[0]?.correlationId).toBe("corr-42");
	});

	it("clamps an over-long client correlation id so the insert can never fail the domain transaction", async () => {
		const correlation = new RequestContextService();
		const service = createService(correlation);
		const oversized = "c".repeat(500);

		await correlation.run({ correlationId: oversized, ip: undefined, userAgent: undefined }, async () =>
			store.transaction(async (tx) => service.enqueueInTransaction(tx, LOGOUT_EVENT)),
		);

		expect(store.committed[0]?.correlationId).toHaveLength(64);
	});

	it("rejects an event whose payload violates its schema before writing anything", async () => {
		const invalid: PlatformEventInput = { type: "session.action", payload: { ...LOGOUT_EVENT.payload, durationMs: -1 } };

		await expect(store.transaction(async (tx) => createService().enqueueInTransaction(tx, invalid))).rejects.toThrow();
		expect(store.committed).toEqual([]);
	});

	it("fails loudly when the insert did not write exactly one row", async () => {
		store.insertedCountOverride = 0;

		await expect(store.transaction(async (tx) => createService().enqueueInTransaction(tx, LOGOUT_EVENT))).rejects.toBeInstanceOf(OutboxEnqueueError);
	});
});

describe("PlatformOutboxService.recordTelemetry", () => {
	beforeEach(() => {
		store.committed.length = 0;
		store.insertedCountOverride = null;
		mocks.systemOperations.length = 0;
		mocks.failSystemTransaction = false;
	});

	it("records a no-write event in its own transaction under the outbox.enqueue system operation", async () => {
		const result = await createService().recordTelemetry(LOGOUT_EVENT);

		expect(result.recorded).toBe(true);
		expect(mocks.systemOperations).toEqual([OUTBOX_ENQUEUE_OPERATION]);
		expect(store.committed).toHaveLength(1);
	});

	it("never throws — a failed write is reported so it cannot mask the caller's outcome", async () => {
		mocks.failSystemTransaction = true;

		const result = await createService().recordTelemetry(LOGOUT_EVENT);

		expect(result).toEqual({ recorded: false, error: "connection terminated" });
		expect(store.committed).toEqual([]);
	});
});

describe("resolvePartitionKey", () => {
	it("keys session events by user", () => {
		expect(resolvePartitionKey(LOGOUT_EVENT)).toBe(USER_ID);
	});

	it("keys impersonation events by the acting super admin", () => {
		expect(
			resolvePartitionKey({
				type: "impersonation.action",
				payload: { action: "start", superAdminId: "admin-1", targetUserId: USER_ID, status: "succeeded", error: null, durationMs: 1 },
			}),
		).toBe("admin-1");
	});

	it("keys reward events by organization, falling back to the actor", () => {
		const organizationId = "5c1f7a9e-2b4d-4e8f-a1b2-c3d4e5f60718";
		expect(resolvePartitionKey({ type: "reward.platform", payload: { event: "reward.auto_published", actorUserId: null, organizationId, metadata: {} } })).toBe(
			organizationId,
		);
		expect(resolvePartitionKey({ type: "reward.platform", payload: { event: "user.claim_reward", actorUserId: USER_ID, organizationId: null, metadata: {} } })).toBe(USER_ID);
	});

	it("keys anonymous auth flows as null (broker falls back to correlation id)", () => {
		expect(
			resolvePartitionKey({ type: "auth.flow", payload: { flow: "forgot-password", userId: null, clientType: null, status: "failed", error: "X", durationMs: 1 } }),
		).toBeNull();
	});

	it("never keys email events by the recipient address (null — the broker falls back to the correlation id)", () => {
		expect(
			resolvePartitionKey({
				type: "email.log.updated",
				payload: { templateKey: "welcome", status: "sent", resendId: null, error: null, durationMs: null },
			}),
		).toBeNull();
	});
});
