import { randomUUID } from "node:crypto";
import { LIST_SLOT_INDEX, nowEpochMs, type PlatformEventInput } from "@workspace/shared";

import type { Prisma } from "@prisma/client";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { TENANT_SEED_IDS } from "../prisma/seed/tenant-seed-ids";
import { getApiConfig } from "../src/config/api-config";
import { TypedConfigService } from "../src/config/typed-config.service";
import { ActorContextSchema, systemActor, type ActorContext } from "../src/platform/application/actor-context";
import { InTransactionEventRegistry } from "../src/platform/application/events/in-transaction-event-registry";
import { IntegrationEventMapperRegistry } from "../src/platform/application/events/integration-event-mapper";
import type { TransactionalEventCollector } from "../src/platform/application/events/transactional-event-collector";
import { DomainEvent } from "../src/platform/domain/domain-event";
import { RequestContextService } from "../src/platform/infrastructure/context/request-context";
import { EMAIL_LOG_WRITE_OPERATION } from "../src/contexts/notifications/application/notifications-scope";
import { PlatformOutboxService } from "../src/platform/infrastructure/outbox/platform-outbox.service";
import { PrismaReadExecutor } from "../src/platform/infrastructure/unit-of-work/prisma-read-executor";
import { PrismaUnitOfWork } from "../src/platform/infrastructure/unit-of-work/prisma-unit-of-work";
import { TransactionalEventDispatcher } from "../src/platform/infrastructure/unit-of-work/transactional-event-dispatcher";
import { PrismaService } from "../src/prisma/prisma.service";
import { TenantTransactionService } from "../src/prisma/tenant-transaction.service";

/** Brew & Bean KL owner. Membership is seeded; this user is not a member of Jonker Street Kitchen. */
const KL_OWNER_USER_ID = "019b76da-a800-763a-b64a-fd037629f93f";

class ProbeRecorded extends DomainEvent {
	public readonly eventName = "platform.ProbeRecorded";

	public constructor(public readonly templateKey: string) {
		super(nowEpochMs());
	}
}

class ProbeRejected extends Error {}

interface ProbeScope {
	readonly events: TransactionalEventCollector;
	writeEmail(templateKey: string): Promise<void>;
}

function emailEvent(templateKey: string): PlatformEventInput {
	return { type: "email.log.updated", payload: { templateKey, status: "sent", resendId: null, error: null, durationMs: null } };
}

function klOwner(): ActorContext {
	return ActorContextSchema.parse({
		kind: "user",
		userId: KL_OWNER_USER_ID,
		sessionId: "unit-of-work-e2e",
		tenantId: TENANT_SEED_IDS.klTenant,
		isSuperAdmin: false,
		accessScope: "tenant",
		impersonatorUserId: null,
		request: { requestId: "unit-of-work-e2e", ip: null, userAgent: null, deviceLabel: null, endpoint: null },
	});
}

describe("Unit of work (e2e)", () => {
	let prisma: PrismaService;
	let transactions: TenantTransactionService;
	let verifier: Pool;
	const templateKeys: string[] = [];
	const published: string[] = [];

	function unitOfWork(): PrismaUnitOfWork<ProbeScope, Prisma.TransactionClient> {
		const mappers = new IntegrationEventMapperRegistry();
		mappers.register({
			map: (event) => (event instanceof ProbeRecorded ? emailEvent(event.templateKey) : null),
		});
		const dispatcher = new TransactionalEventDispatcher<Prisma.TransactionClient>(
			new InTransactionEventRegistry(),
			mappers,
			new PlatformOutboxService(transactions, new RequestContextService()),
		);
		return new PrismaUnitOfWork(
			transactions,
			{
				create: (db, events): ProbeScope => ({
					events,
					writeEmail: async (templateKey: string): Promise<void> => {
						await db.emailLog.create({ data: { templateKey, to: "unit-of-work-e2e@example.com", subject: "Unit of work e2e", status: "sent" } });
					},
				}),
			},
			dispatcher,
			{
				publish: (event): Promise<void> => {
					published.push(event.eventName);
					return Promise.resolve();
				},
			},
		);
	}

	async function emailCount(templateKey: string): Promise<number> {
		const result = await verifier.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM public."EmailLog" WHERE "templateKey" = $1', [templateKey]);
		return result.rows[LIST_SLOT_INDEX.first]?.count ?? 0;
	}

	async function outboxCount(templateKey: string): Promise<number> {
		const result = await verifier.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM public."OutboxEvent" WHERE payload::text LIKE $1', [`%${templateKey}%`]);
		return result.rows[LIST_SLOT_INDEX.first]?.count ?? 0;
	}

	beforeAll(async () => {
		prisma = new PrismaService(new TypedConfigService(getApiConfig()));
		prisma.onModuleInit();
		await prisma.ensureConnected();
		transactions = new TenantTransactionService(prisma, new RequestContextService());
		verifier = new Pool({ connectionString: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo" });
	});

	afterAll(async () => {
		if (templateKeys.length > 0) {
			await verifier.query('DELETE FROM public."EmailLog" WHERE "templateKey" = ANY($1::text[])', [templateKeys]);
			await verifier.query('DELETE FROM public."OutboxEvent" WHERE payload::text LIKE ANY($1::text[])', [templateKeys.map((key) => `%${key}%`)]);
		}
		await verifier.end();
		await prisma.onModuleDestroy();
	});

	it("commits the business row and the outbox row, then publishes", async () => {
		const templateKey = `unit-of-work-e2e-${randomUUID()}`;
		templateKeys.push(templateKey);
		published.length = 0;
		const actor = systemActor(EMAIL_LOG_WRITE_OPERATION, "job", null, "e2e unit of work", null);

		await unitOfWork().run(actor, async (scope): Promise<void> => {
			await scope.writeEmail(templateKey);
			scope.events.collect(new ProbeRecorded(templateKey));
		});

		expect(await emailCount(templateKey)).toBe(1);
		expect(await outboxCount(templateKey)).toBe(1);
		expect(published).toEqual(["platform.ProbeRecorded"]);
	});

	it("leaves neither row and publishes nothing when the transaction throws", async () => {
		const templateKey = `unit-of-work-e2e-${randomUUID()}`;
		templateKeys.push(templateKey);
		published.length = 0;
		const actor = systemActor(EMAIL_LOG_WRITE_OPERATION, "job", null, "e2e unit of work rollback", null);

		await expect(
			unitOfWork().run(actor, async (scope): Promise<void> => {
				await scope.writeEmail(templateKey);
				scope.events.collect(new ProbeRecorded(templateKey));
				throw new ProbeRejected("business rule failed");
			}),
		).rejects.toBeInstanceOf(ProbeRejected);

		expect(await emailCount(templateKey)).toBe(0);
		expect(await outboxCount(templateKey)).toBe(0);
		expect(published).toEqual([]);
	});

	it("does not return another tenant's tenant", async () => {
		const reads = new PrismaReadExecutor(transactions);
		const own = await reads.read(klOwner(), (db) => db.tenant.findUnique({ where: { id: TENANT_SEED_IDS.klTenant }, select: { id: true } }));
		const other = await reads.read(klOwner(), (db) => db.tenant.findUnique({ where: { id: TENANT_SEED_IDS.mlkTenant }, select: { id: true } }));

		expect(own?.id).toBe(TENANT_SEED_IDS.klTenant);
		expect(other).toBeNull();
	});
});
