import { randomUUID } from "node:crypto";

import type { Queue } from "bullmq";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { getApiConfig } from "../src/config/api-config";
import { TypedConfigService } from "../src/config/typed-config.service";
import { OUTBOX_DEAD_LETTER_RETENTION_MS, OUTBOX_PUBLISHED_RETENTION_MS } from "../src/infrastructure/outbox/outbox-retention.constants";
import { OutboxRetentionProcessor, OutboxRetentionScheduler } from "../src/infrastructure/outbox/outbox-retention.processor";
import { OutboxRetentionRepository } from "../src/infrastructure/outbox/outbox-retention.repository";
import { OutboxRetentionService } from "../src/infrastructure/outbox/outbox-retention.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { TenantTransactionService } from "../src/prisma/tenant-transaction.service";
import { RequestContextService } from "../src/common/context/request-context";

/**
 * Real-Postgres proof of the outbox retention job: it deletes PUBLISHED rows
 * past their window and dead letters past theirs, never a PENDING row and
 * never a recent one — under the RLS bypass-only policy of `outbox_events`.
 */

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";
const ONE_HOUR_MS: number = 60 * 60 * 1000;
/** Marks this run's fixture rows so assertions and cleanup touch nothing else. */
const FIXTURE_EVENT_TYPE = "retention.e2e";

type Fixture = "publishedOld" | "publishedRecent" | "deadLetterOld" | "deadLetterRecent" | "pendingAncient";

describe("Outbox retention (integration)", () => {
	const topic = `retention-e2e-${randomUUID()}`;
	const ids = new Map<Fixture, string>();
	let prisma: PrismaService;
	let processor: OutboxRetentionProcessor;
	let verifier: Pool;

	async function insertRow(fixture: Fixture, status: "PENDING" | "PUBLISHED" | "FAILED", settledAtMs: number): Promise<void> {
		const id = randomUUID();
		ids.set(fixture, id);
		await verifier.query(
			`INSERT INTO public.outbox_events (id, topic, event_type, payload, status, attempts, published_at, available_at, created_at, updated_at)
			 VALUES ($1, $2, $3, '{}'::jsonb, $4::"OutboxEventStatus", 0, $5, $6, $6, $6)`,
			[id, topic, FIXTURE_EVENT_TYPE, status, status === "PUBLISHED" ? settledAtMs : null, settledAtMs],
		);
	}

	async function remainingFixtures(): Promise<Fixture[]> {
		const result = await verifier.query<{ id: string }>("SELECT id FROM public.outbox_events WHERE topic = $1", [topic]);
		const remaining = new Set(result.rows.map((row): string => row.id));
		return [...ids.entries()].filter(([, id]): boolean => remaining.has(id)).map(([fixture]): Fixture => fixture);
	}

	beforeAll(async () => {
		// The REAL environment (apps/api/.env + test/setup-env.ts), not the unit fixture.
		const config = new TypedConfigService(getApiConfig());
		prisma = new PrismaService(config);
		prisma.onModuleInit();
		await prisma.ensureConnected();
		const retention = new OutboxRetentionService(new OutboxRetentionRepository(new TenantTransactionService(prisma, new RequestContextService())));
		// The scheduler is only a constructor dependency here; its Redis registration is not exercised.
		processor = new OutboxRetentionProcessor(new OutboxRetentionScheduler(config, { upsertJobScheduler: vi.fn<Queue["upsertJobScheduler"]>() }), retention);
		// Superuser pool — fixtures, verification and cleanup only (bypasses RLS).
		verifier = new Pool({ connectionString: DATABASE_URL });
	});

	afterAll(async () => {
		await verifier.query("DELETE FROM public.outbox_events WHERE topic = $1", [topic]);
		await verifier.end();
		await prisma.onModuleDestroy();
	});

	it("deletes only settled rows past their retention window", async () => {
		const now = Date.now();
		await insertRow("publishedOld", "PUBLISHED", now - OUTBOX_PUBLISHED_RETENTION_MS - ONE_HOUR_MS);
		await insertRow("publishedRecent", "PUBLISHED", now - OUTBOX_PUBLISHED_RETENTION_MS + ONE_HOUR_MS);
		await insertRow("deadLetterOld", "FAILED", now - OUTBOX_DEAD_LETTER_RETENTION_MS - ONE_HOUR_MS);
		await insertRow("deadLetterRecent", "FAILED", now - OUTBOX_PUBLISHED_RETENTION_MS - ONE_HOUR_MS);
		await insertRow("pendingAncient", "PENDING", now - OUTBOX_DEAD_LETTER_RETENTION_MS - ONE_HOUR_MS);

		const summary = await processor.process({ data: {} });

		expect(summary.published.deleted).toBeGreaterThanOrEqual(1);
		expect(summary.deadLettered.deleted).toBeGreaterThanOrEqual(1);
		expect((await remainingFixtures()).sort()).toEqual(["deadLetterRecent", "pendingAncient", "publishedRecent"]);
	});

	it("is a no-op when run again", async () => {
		await processor.process({ data: {} });

		expect((await remainingFixtures()).sort()).toEqual(["deadLetterRecent", "pendingAncient", "publishedRecent"]);
	});
});
