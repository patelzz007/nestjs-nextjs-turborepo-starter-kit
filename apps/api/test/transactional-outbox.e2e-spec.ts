import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PlatformEventInput } from "@workspace/shared";

import { RequestContextService } from "../src/common/context/request-context";
import { OutboxDispatchRepository } from "../src/infrastructure/outbox/outbox-dispatch.repository";
import { OUTBOX_PUBLISH_OPERATION } from "../src/infrastructure/outbox/outbox-queue.processors";
import { OUTBOX_ENQUEUE_OPERATION, PlatformOutboxService } from "../src/infrastructure/outbox/platform-outbox.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { rlsStorage, runWithSystemRlsContext, userRlsContext, type RlsContext } from "../src/prisma/rls-context";
import { TenantTransactionService } from "../src/prisma/tenant-transaction.service";
import { getApiConfig } from "../src/config/api-config";
import { TypedConfigService } from "../src/config/typed-config.service";

/**
 * Real-Postgres proof of the transactional outbox contract (ADR 015):
 * the event row commits if and only if the domain change commits, under the
 * same RLS sessions production uses.
 */

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";
const CLAIM_LEASE_MS = 60_000;
/** Test rows claimed by the dispatcher test sort ahead of any real backlog. */
const ANCIENT_CREATED_AT_MS = 1;

class DomainRuleViolation extends Error {}

const USER_SCOPE: RlsContext = userRlsContext(randomUUID(), null, false);

function emailEvent(templateKey: string): PlatformEventInput {
	return {
		type: "email.log.updated",
		payload: { templateKey, status: "sent", resendId: null, error: null, durationMs: null },
	};
}

describe("Transactional outbox (integration)", () => {
	let prisma: PrismaService;
	let transactions: TenantTransactionService;
	let outbox: PlatformOutboxService;
	let verifier: Pool;
	const createdEventIds: string[] = [];
	const createdTemplateKeys: string[] = [];

	async function countOutboxRows(eventId: string): Promise<number> {
		const result = await verifier.query<{ count: number }>("SELECT COUNT(*)::int AS count FROM public.outbox_events WHERE id = $1", [eventId]);
		return result.rows[0]?.count ?? 0;
	}

	async function countEmailLogs(templateKey: string): Promise<number> {
		const result = await verifier.query<{ count: number }>("SELECT COUNT(*)::int AS count FROM public.email_logs WHERE template_key = $1", [templateKey]);
		return result.rows[0]?.count ?? 0;
	}

	beforeAll(async () => {
		// The REAL environment (apps/api/.env + test/setup-env.ts), not the unit fixture.
		prisma = new PrismaService(new TypedConfigService(getApiConfig()));
		prisma.onModuleInit();
		await prisma.ensureConnected();
		transactions = new TenantTransactionService(prisma, new RequestContextService());
		outbox = new PlatformOutboxService(transactions, new RequestContextService());
		// Superuser pool — verification reads/cleanup only (bypasses RLS).
		verifier = new Pool({ connectionString: DATABASE_URL });
	});

	afterAll(async () => {
		if (createdEventIds.length > 0) {
			await verifier.query("DELETE FROM public.outbox_events WHERE id = ANY($1::text[])", [createdEventIds]);
		}
		if (createdTemplateKeys.length > 0) {
			await verifier.query("DELETE FROM public.email_logs WHERE template_key = ANY($1::text[])", [createdTemplateKeys]);
		}
		await verifier.end();
		await prisma.onModuleDestroy();
	});

	it("commits the event together with the domain row", async () => {
		const templateKey = `outbox-e2e-${randomUUID()}`;
		createdTemplateKeys.push(templateKey);

		const eventId = await transactions.withSystemOperation({ operation: OUTBOX_ENQUEUE_OPERATION, reason: "e2e", actorUserId: null }, async (tx): Promise<string> => {
			await tx.emailLog.create({ data: { templateKey, to: "outbox-e2e@example.com", subject: "Outbox e2e", status: "sent" } });
			return outbox.enqueueInTransaction(tx, emailEvent(templateKey));
		});
		createdEventIds.push(eventId);

		expect(await countEmailLogs(templateKey)).toBe(1);
		expect(await countOutboxRows(eventId)).toBe(1);
		const stored = await verifier.query<{ status: string; attempts: number; topic: string }>(
			"SELECT status::text AS status, attempts, topic FROM public.outbox_events WHERE id = $1",
			[eventId],
		);
		expect(stored.rows[0]).toEqual({ status: "PENDING", attempts: 0, topic: "platform.email" });
	});

	it("drops the event when the domain transaction rolls back", async () => {
		const templateKey = `outbox-e2e-${randomUUID()}`;
		createdTemplateKeys.push(templateKey);
		const staged: string[] = [];

		await expect(
			transactions.withSystemOperation({ operation: OUTBOX_ENQUEUE_OPERATION, reason: "e2e", actorUserId: null }, async (tx): Promise<void> => {
				await tx.emailLog.create({ data: { templateKey, to: "outbox-e2e@example.com", subject: "Outbox e2e", status: "sent" } });
				staged.push(await outbox.enqueueInTransaction(tx, emailEvent(templateKey)));
				throw new DomainRuleViolation("business rule failed after the event was staged");
			}),
		).rejects.toBeInstanceOf(DomainRuleViolation);

		const [eventId] = staged;
		expect(eventId).toBeDefined();
		expect(await countEmailLogs(templateKey)).toBe(0);
		expect(await countOutboxRows(eventId ?? "")).toBe(0);
	});

	it("appends from a user-scoped (non-bypass) RLS session, which still cannot read the outbox back", async () => {
		const event = emailEvent(`outbox-e2e-${randomUUID()}`);

		const { eventId, visibleToUser } = await rlsStorage.run(USER_SCOPE, async () =>
			prisma.$transaction(async (tx): Promise<{ readonly eventId: string; readonly visibleToUser: number }> => {
				const id = await outbox.enqueueInTransaction(tx, event);
				return { eventId: id, visibleToUser: await tx.outboxEvent.count({ where: { id } }) };
			}),
		);
		createdEventIds.push(eventId);

		expect(visibleToUser).toBe(0);
		expect(await countOutboxRows(eventId)).toBe(1);
	});

	it("rejects a user-scoped session trying to insert an already-published row", async () => {
		const forgedId = randomUUID();

		await expect(
			rlsStorage.run(USER_SCOPE, async () =>
				prisma.$transaction(async (tx): Promise<number> =>
					tx.outboxEvent
						.createMany({ data: [{ id: forgedId, topic: "platform.email", eventType: "email.log.updated", payload: {}, status: "PUBLISHED" }] })
						.then((result) => result.count),
				),
			),
		).rejects.toThrow(/row-level security/);

		expect(await countOutboxRows(forgedId)).toBe(0);
	});

	it("claims due rows with a lease, never hands the same row out twice, and records publish / retry", async () => {
		const first = await runWithSystemRlsContext(OUTBOX_PUBLISH_OPERATION, async () =>
			prisma.$transaction(async (tx): Promise<string> => outbox.enqueueInTransaction(tx, emailEvent(`outbox-e2e-${randomUUID()}`))),
		);
		const second = await runWithSystemRlsContext(OUTBOX_PUBLISH_OPERATION, async () =>
			prisma.$transaction(async (tx): Promise<string> => outbox.enqueueInTransaction(tx, emailEvent(`outbox-e2e-${randomUUID()}`))),
		);
		createdEventIds.push(first, second);
		await verifier.query("UPDATE public.outbox_events SET created_at = $2::bigint + (CASE WHEN id = $1 THEN 0 ELSE 1 END) WHERE id = ANY($3::text[])", [
			first,
			ANCIENT_CREATED_AT_MS,
			[first, second],
		]);

		const store = new OutboxDispatchRepository(prisma);
		const nowMs = Date.now();

		const claimed = await runWithSystemRlsContext(OUTBOX_PUBLISH_OPERATION, async () => store.claimDue(2, nowMs, CLAIM_LEASE_MS));
		expect(claimed.map((row) => row.id)).toEqual([first, second]);
		expect(claimed[0]).toMatchObject({ topic: "platform.email", attempts: 0 });

		const reclaimed = await runWithSystemRlsContext(OUTBOX_PUBLISH_OPERATION, async () => store.claimDue(2, nowMs, CLAIM_LEASE_MS));
		expect(reclaimed.map((row) => row.id)).not.toContain(first);
		expect(reclaimed.map((row) => row.id)).not.toContain(second);

		await runWithSystemRlsContext(OUTBOX_PUBLISH_OPERATION, async () => {
			await store.markPublished(first, nowMs);
			await store.scheduleRetry(second, 1, "broker unavailable", nowMs + CLAIM_LEASE_MS, nowMs);
		});

		const rows = await verifier.query<{ id: string; status: string; attempts: number; lastError: string | null }>(
			'SELECT id, status::text AS status, attempts, last_error AS "lastError" FROM public.outbox_events WHERE id = ANY($1::text[]) ORDER BY created_at',
			[[first, second]],
		);
		expect(rows.rows).toEqual([
			{ id: first, status: "PUBLISHED", attempts: 0, lastError: null },
			{ id: second, status: "PENDING", attempts: 1, lastError: "broker unavailable" },
		]);

		const backlog = await runWithSystemRlsContext(OUTBOX_PUBLISH_OPERATION, async () => store.readBacklog());
		expect(backlog.pendingCount).toBeGreaterThanOrEqual(1);
		expect(backlog.oldestPendingCreatedAt).toBe(ANCIENT_CREATED_AT_MS + 1);
	});
});
