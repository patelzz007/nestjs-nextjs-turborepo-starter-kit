import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getApiConfig } from "../src/config/api-config";
import { TypedConfigService } from "../src/config/typed-config.service";
import { IdempotencyRecordRepository } from "../src/platform/idempotency/idempotency-record.repository";
import { IDEMPOTENCY_SYSTEM_OPERATION } from "../src/platform/idempotency/idempotency.constants";
import { PlatformResourceIdempotencyService } from "../src/platform/platform-resource.services";
import { PrismaService } from "../src/prisma/prisma.service";
import { TenantTransactionService } from "../src/prisma/tenant-transaction.service";

/**
 * Real-Postgres proof for `PlatformResourceIdempotencyService.store` (the
 * service-level path used by `runMutation`): a key whose record has EXPIRED
 * but not yet been purged can be reused, while a LIVE record still makes a
 * second store fail on the unique (scope, key) index — so the caller's whole
 * transaction (including the business write) rolls back.
 */

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";
const ONE_HOUR_MS = 60 * 60 * 1000;

interface StoredRow {
	readonly requestHash: string;
	readonly status: string;
	readonly expiresAt: string;
}

describe("Idempotency store over an existing record (integration)", () => {
	const scope = `store-e2e:${randomUUID()}`;
	let prisma: PrismaService;
	let tenantTx: TenantTransactionService;
	let service: PlatformResourceIdempotencyService;
	let verifier: Pool;

	async function insertRecord(key: string, requestHash: string, expiresAtMs: number): Promise<void> {
		await verifier.query(
			`INSERT INTO public.platform_resource_idempotency_records (id, scope, idempotency_key, request_hash, status, response_body, expires_at, created_at, updated_at)
			 VALUES ($1, $2, $3, $4, 'COMPLETED'::"IdempotencyRecordStatus", $5::jsonb, $6, $6, $6)`,
			[randomUUID(), scope, key, requestHash, JSON.stringify({ body: { original: true } }), expiresAtMs],
		);
	}

	async function rowsFor(key: string): Promise<StoredRow[]> {
		const result = await verifier.query<StoredRow>(
			`SELECT request_hash AS "requestHash", status::text AS status, expires_at::text AS "expiresAt"
			 FROM public.platform_resource_idempotency_records WHERE scope = $1 AND idempotency_key = $2`,
			[scope, key],
		);
		return result.rows;
	}

	async function store(key: string, requestHash: string): Promise<void> {
		await tenantTx.withSystemOperation(
			{ operation: IDEMPOTENCY_SYSTEM_OPERATION, reason: "store e2e", correlationId: `store-e2e:${key}`, actorUserId: null },
			async (tx): Promise<void> => {
				await service.store({ scope, idempotencyKey: key, requestHash, responseBody: { replayed: requestHash } }, tx);
			},
		);
	}

	beforeAll(async () => {
		// The REAL environment (apps/api/.env + test/setup-env.ts), not the unit fixture.
		prisma = new PrismaService(new TypedConfigService(getApiConfig()));
		await prisma.onModuleInit();
		await prisma.ensureConnected();
		tenantTx = new TenantTransactionService(prisma);
		service = new PlatformResourceIdempotencyService(new IdempotencyRecordRepository(tenantTx));
		// Superuser pool — fixtures, verification and cleanup only (bypasses RLS).
		verifier = new Pool({ connectionString: DATABASE_URL });
	});

	afterAll(async () => {
		await verifier.query("DELETE FROM public.platform_resource_idempotency_records WHERE scope = $1", [scope]);
		await verifier.end();
		await prisma.onModuleDestroy();
	});

	it("reuses a key whose record expired but was not purged yet", async () => {
		const key = "key-expired";
		await insertRecord(key, "old-hash", Date.now() - ONE_HOUR_MS);

		await store(key, "new-hash");

		const rows = await rowsFor(key);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.requestHash).toBe("new-hash");
		expect(rows[0]?.status).toBe("COMPLETED");
		expect(Number(rows[0]?.expiresAt)).toBeGreaterThan(Date.now());
	});

	it("still rejects a key whose record is live, leaving that record untouched", async () => {
		const key = "key-live";
		const liveUntil = Date.now() + ONE_HOUR_MS;
		await insertRecord(key, "live-hash", liveUntil);

		await expect(store(key, "other-hash")).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);

		const rows = await rowsFor(key);
		expect(rows).toEqual([{ requestHash: "live-hash", status: "COMPLETED", expiresAt: String(liveUntil) }]);
	});
});
