import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { RequestContextService } from "../src/common/context/request-context";
import { getApiConfig } from "../src/config/api-config";
import { TypedConfigService } from "../src/config/typed-config.service";
import { IdempotencyLedgerService } from "../src/platform/idempotency/idempotency-ledger.service";
import { IdempotencyRecordRepository, type IdempotencyLease } from "../src/platform/idempotency/idempotency-record.repository";
import { IDEMPOTENCY_IN_PROGRESS_LEASE_MS } from "../src/platform/idempotency/idempotency.constants";
import { PrismaService } from "../src/prisma/prisma.service";
import { TenantTransactionService } from "../src/prisma/tenant-transaction.service";

/**
 * Real-Postgres proof of the idempotency ledger's fencing (lease tokens),
 * through the RLS bypass-only table and the `http.idempotency` system
 * operation: a request whose lease expired — and was taken over by a retry —
 * can neither store its response nor release its successor's lease.
 */

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";

interface StoredRow {
	readonly leaseToken: string;
	readonly status: string;
	readonly expiresAt: string;
}

describe("Idempotency ledger fencing (integration)", () => {
	const scope = `fencing-e2e:${randomUUID()}`;
	let prisma: PrismaService;
	let ledger: IdempotencyLedgerService;
	let verifier: Pool;

	async function rowFor(key: string): Promise<StoredRow | undefined> {
		const result = await verifier.query<StoredRow>(
			`SELECT lease_token::text AS "leaseToken", status::text AS status, expires_at::text AS "expiresAt"
			 FROM public.platform_resource_idempotency_records WHERE scope = $1 AND idempotency_key = $2`,
			[scope, key],
		);
		return result.rows.at(0);
	}

	/** Force the current lease to have expired, as if the handler had run past it. */
	async function expireLease(key: string): Promise<void> {
		await verifier.query("UPDATE public.platform_resource_idempotency_records SET expires_at = $3 WHERE scope = $1 AND idempotency_key = $2", [
			scope,
			key,
			Date.now() - IDEMPOTENCY_IN_PROGRESS_LEASE_MS,
		]);
	}

	async function acquire(key: string): Promise<IdempotencyLease> {
		const outcome = await ledger.begin(scope, key, "same-hash");
		if (outcome.kind !== "acquired") {
			throw new Error(`expected to acquire ${key}`);
		}
		return outcome.lease;
	}

	beforeAll(async () => {
		// The REAL environment (apps/api/.env + test/setup-env.ts), not the unit fixture.
		prisma = new PrismaService(new TypedConfigService(getApiConfig()));
		prisma.onModuleInit();
		await prisma.ensureConnected();
		ledger = new IdempotencyLedgerService(new IdempotencyRecordRepository(new TenantTransactionService(prisma, new RequestContextService())));
		// Superuser pool — fixtures, verification and cleanup only (bypasses RLS).
		verifier = new Pool({ connectionString: DATABASE_URL });
	});

	afterAll(async () => {
		await verifier.query("DELETE FROM public.platform_resource_idempotency_records WHERE scope = $1", [scope]);
		await verifier.end();
		await prisma.onModuleDestroy();
	});

	it("stores the response of the current lease holder", async () => {
		const lease = await acquire("key-holder");

		await expect(ledger.complete(scope, "key-holder", lease, { id: "p-1" })).resolves.toBe("stored");
		expect((await rowFor("key-holder"))?.status).toBe("COMPLETED");
	});

	it("refuses to store for a request whose lease was taken over, even with the identical request hash", async () => {
		const stale = await acquire("key-takeover");
		await expireLease("key-takeover");
		const successor = await acquire("key-takeover");

		await expect(ledger.complete(scope, "key-takeover", stale, { id: "stale" })).resolves.toBe("lease_lost");
		await expect(ledger.release(scope, "key-takeover", stale)).resolves.toBe(false);
		expect(await rowFor("key-takeover")).toMatchObject({ leaseToken: successor.token, status: "IN_PROGRESS" });
	});

	it("refuses to store once the holder's own lease expired", async () => {
		const lease = await acquire("key-expired");
		await expireLease("key-expired");

		await expect(ledger.complete(scope, "key-expired", lease, { id: "late" })).resolves.toBe("lease_lost");
		expect((await rowFor("key-expired"))?.status).toBe("IN_PROGRESS");
	});
});
