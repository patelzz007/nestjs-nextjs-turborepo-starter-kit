import { randomUUID } from "node:crypto";

import type { Queue } from "bullmq";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { getApiConfig } from "../src/config/api-config";
import { TypedConfigService } from "../src/config/typed-config.service";
import { IdempotencyRecordRepository } from "../src/platform/idempotency/idempotency-record.repository";
import { IdempotencyRetentionProcessor, IdempotencyRetentionScheduler } from "../src/platform/idempotency/idempotency-retention.processor";
import { IdempotencyRetentionService } from "../src/platform/idempotency/idempotency-retention.service";
import { IDEMPOTENCY_IN_PROGRESS_LEASE_MS, IDEMPOTENCY_PURGE_GRACE_MS } from "../src/platform/idempotency/idempotency.constants";
import { PlatformResourceIdempotencyService } from "../src/platform/platform-resource.services";
import { PrismaService } from "../src/prisma/prisma.service";
import { TenantTransactionService } from "../src/prisma/tenant-transaction.service";

/**
 * Real-Postgres proof of the idempotency retention job: it deletes only rows
 * expired longer than the grace period (both states), under the RLS
 * bypass-only policy of `platform_resource_idempotency_records`, and a purged
 * key is simply acquired afresh.
 */

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";
/** Comfortably past the grace period, so test clock drift cannot matter. */
const LONG_AGO_MS: number = IDEMPOTENCY_PURGE_GRACE_MS * 2;
const ONE_MINUTE_MS = 60_000;

type Fixture = "completedLongExpired" | "inProgressAbandoned" | "completedRecentlyExpired" | "completedLive" | "inProgressLive";

describe("Idempotency record retention (integration)", () => {
	const scope = `retention-e2e:${randomUUID()}`;
	let prisma: PrismaService;
	let processor: IdempotencyRetentionProcessor;
	let verifier: Pool;

	async function insertRecord(key: string, status: "IN_PROGRESS" | "COMPLETED", expiresAtMs: number): Promise<void> {
		await verifier.query(
			`INSERT INTO public.platform_resource_idempotency_records (id, scope, idempotency_key, request_hash, status, response_body, expires_at, created_at, updated_at)
			 VALUES ($1, $2, $3, 'hash-1', $4::"IdempotencyRecordStatus", $5::jsonb, $6, $6, $6)`,
			[randomUUID(), scope, key, status, status === "COMPLETED" ? JSON.stringify({ body: { ok: true } }) : null, expiresAtMs],
		);
	}

	async function remainingKeys(): Promise<string[]> {
		const result = await verifier.query<{ key: string }>(
			"SELECT idempotency_key AS key FROM public.platform_resource_idempotency_records WHERE scope = $1 ORDER BY idempotency_key",
			[scope],
		);
		return result.rows.map((row): string => row.key);
	}

	beforeAll(async () => {
		// The REAL environment (apps/api/.env + test/setup-env.ts), not the unit fixture.
		const config = new TypedConfigService(getApiConfig());
		prisma = new PrismaService(config);
		await prisma.onModuleInit();
		await prisma.ensureConnected();
		const retention = new IdempotencyRetentionService(new IdempotencyRecordRepository(new TenantTransactionService(prisma)));
		// The scheduler is only a constructor dependency here; its Redis registration is not exercised.
		processor = new IdempotencyRetentionProcessor(new IdempotencyRetentionScheduler(config, { upsertJobScheduler: vi.fn<Queue["upsertJobScheduler"]>() }), retention);
		// Superuser pool — fixtures, verification and cleanup only (bypasses RLS).
		verifier = new Pool({ connectionString: DATABASE_URL });
	});

	afterAll(async () => {
		await verifier.query("DELETE FROM public.platform_resource_idempotency_records WHERE scope = $1", [scope]);
		await verifier.end();
		await prisma.onModuleDestroy();
	});

	it("deletes rows expired past the grace period and keeps live and recently expired ones", async () => {
		const now = Date.now();
		const fixtures: Readonly<Record<Fixture, { readonly status: "IN_PROGRESS" | "COMPLETED"; readonly expiresAtMs: number }>> = {
			completedLongExpired: { status: "COMPLETED", expiresAtMs: now - LONG_AGO_MS },
			inProgressAbandoned: { status: "IN_PROGRESS", expiresAtMs: now - LONG_AGO_MS },
			completedRecentlyExpired: { status: "COMPLETED", expiresAtMs: now - ONE_MINUTE_MS },
			completedLive: { status: "COMPLETED", expiresAtMs: now + LONG_AGO_MS },
			inProgressLive: { status: "IN_PROGRESS", expiresAtMs: now + IDEMPOTENCY_IN_PROGRESS_LEASE_MS },
		};
		for (const [key, fixture] of Object.entries(fixtures)) {
			await insertRecord(key, fixture.status, fixture.expiresAtMs);
		}

		// Through the BullMQ processor entry point: system RLS scope + transaction-level bypass.
		const summary = await processor.process({ data: {} });

		expect(summary.stoppedBy).toBe("drained");
		expect(summary.deleted).toBeGreaterThanOrEqual(2);
		expect(await remainingKeys()).toEqual(["completedLive", "completedRecentlyExpired", "inProgressLive"]);
	});

	it("is a no-op on a second run (safe to double-fire)", async () => {
		const before = await remainingKeys();

		await processor.process({ data: {} });

		expect(await remainingKeys()).toEqual(before);
	});

	it("lets a purged key be acquired afresh", async () => {
		const key = "purged-then-reused";
		await insertRecord(key, "COMPLETED", Date.now() - LONG_AGO_MS);
		await processor.process({ data: {} });
		expect(await remainingKeys()).not.toContain(key);

		const idempotency = new PlatformResourceIdempotencyService(new IdempotencyRecordRepository(new TenantTransactionService(prisma)));

		await expect(idempotency.begin(scope, key, "hash-2")).resolves.toEqual({ kind: "acquired" });
		expect(await remainingKeys()).toContain(key);
	});
});
