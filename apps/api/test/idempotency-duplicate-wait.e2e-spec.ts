import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { getApiConfig } from "../src/config/api-config";
import { TypedConfigService } from "../src/config/typed-config.service";
import { RequestContextService } from "../src/platform/infrastructure/context/request-context";
import { IdempotencyLedgerService, type IdempotencyBeginResult, type IdempotencyHeldLease } from "../src/platform/infrastructure/idempotency/idempotency-ledger.service";
import {
	IdempotencyRecordRepository,
	type IdempotencyRecordKey,
	type IdempotencyRecordSnapshot,
} from "../src/platform/infrastructure/idempotency/idempotency-record.repository";
import { IDEMPOTENCY_DUPLICATE_WAIT_MS, IDEMPOTENCY_LOCK_APPLICATION_NAME } from "../src/platform/infrastructure/idempotency/idempotency.constants";
import { IdempotencyRequestInProgressError } from "../src/platform/infrastructure/idempotency/idempotency.errors";
import { PostgresIdempotencyKeyLocks } from "../src/platform/infrastructure/idempotency/postgres-idempotency-key-locks";
import { PrismaService } from "../src/prisma/prisma.service";
import { TenantTransactionService } from "../src/prisma/tenant-transaction.service";

/**
 * ADR 061 against real Postgres: a concurrent identical duplicate blocks on the
 * key's advisory lock (no polling), then replays the original's response — or
 * executes itself if the original failed — and gives up with 409 after 5 s.
 */

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";
/** Long enough for every duplicate to reach its lock wait in Postgres. */
const SETTLE_MS = 500;
/** A wait well inside the 5 s cap, during which a polling waiter would have read the record many times. */
const OBSERVE_MS = 1_500;
const CONCURRENT_DUPLICATES = 5;
/** The cap plus slack for one lock statement and one read. */
const CAP_TEST_TIMEOUT_MS = IDEMPOTENCY_DUPLICATE_WAIT_MS + 10_000;

const WaitingRowsSchema = z.array(z.object({ waiting: z.number() }));

function sleep(ms: number): Promise<void> {
	return new Promise((resolve: () => void): void => {
		setTimeout(resolve, ms);
	});
}

/** The real repository, counting how often the ledger reads a record — a polling waiter would read it repeatedly. */
class CountingRecords extends IdempotencyRecordRepository {
	public reads = 0;

	public override find(key: IdempotencyRecordKey): Promise<IdempotencyRecordSnapshot | null> {
		this.reads += 1;
		return super.find(key);
	}
}

describe("Idempotent duplicate: wait on the key lock, then replay (e2e)", () => {
	const scope = `duplicate-wait-e2e:${randomUUID()}`;
	let prisma: PrismaService;
	let locks: PostgresIdempotencyKeyLocks;
	let records: CountingRecords;
	let ledger: IdempotencyLedgerService;
	let verifier: Pool;

	async function acquire(key: string): Promise<IdempotencyHeldLease> {
		const outcome = await ledger.begin(scope, key, "same-hash");
		if (outcome.kind !== "acquired") {
			throw new Error(`expected to acquire ${key}`);
		}
		return outcome.lease;
	}

	/** Sessions of the lock pool currently blocked on an advisory lock in Postgres. */
	async function advisoryWaiters(): Promise<number> {
		const result = await verifier.query(
			"SELECT COUNT(*)::int AS waiting FROM pg_stat_activity WHERE application_name = $1 AND wait_event_type = 'Lock' AND wait_event = 'advisory'",
			[IDEMPOTENCY_LOCK_APPLICATION_NAME],
		);
		const [row] = WaitingRowsSchema.parse(result.rows);
		return row?.waiting ?? 0;
	}

	beforeAll(async () => {
		const config = new TypedConfigService(getApiConfig());
		prisma = new PrismaService(config);
		prisma.onModuleInit();
		await prisma.ensureConnected();
		locks = new PostgresIdempotencyKeyLocks(config);
		records = new CountingRecords(new TenantTransactionService(prisma, new RequestContextService()));
		ledger = new IdempotencyLedgerService(records, locks);
		verifier = new Pool({ connectionString: DATABASE_URL });
	});

	afterAll(async () => {
		await verifier.query('DELETE FROM public."PlatformResourceIdempotencyRecord" WHERE scope = $1', [scope]);
		await verifier.end();
		await locks.onModuleDestroy();
		await prisma.onModuleDestroy();
	});

	it("(a) blocks a duplicate while the original runs, then replays its stored response", async () => {
		const original = await acquire("key-replay");
		const duplicate: Promise<IdempotencyBeginResult> = ledger.begin(scope, "key-replay", "same-hash");
		await sleep(SETTLE_MS);
		expect(await advisoryWaiters()).toBe(1);

		await expect(ledger.complete(scope, "key-replay", original, { id: "sale-1" })).resolves.toBe("stored");

		await expect(duplicate).resolves.toEqual({ kind: "replay", responseBody: { id: "sale-1" } });
	});

	it("(b) lets the waiting duplicate execute when the original fails", async () => {
		const original = await acquire("key-takeover");
		const duplicate: Promise<IdempotencyBeginResult> = ledger.begin(scope, "key-takeover", "same-hash");
		await sleep(SETTLE_MS);

		await ledger.release(scope, "key-takeover", original);

		const outcome = await duplicate;
		expect(outcome.kind).toBe("acquired");
		if (outcome.kind === "acquired") {
			await ledger.complete(scope, "key-takeover", outcome.lease, { id: "sale-2" });
		}
	});

	it(
		"(c) answers 409 in progress when the original still runs after the 5 s cap",
		async () => {
			const original = await acquire("key-cap");
			const startedAt: number = Date.now();

			await expect(ledger.begin(scope, "key-cap", "same-hash")).rejects.toBeInstanceOf(IdempotencyRequestInProgressError);

			expect(Date.now() - startedAt).toBeGreaterThanOrEqual(IDEMPOTENCY_DUPLICATE_WAIT_MS);
			await ledger.release(scope, "key-cap", original);
		},
		CAP_TEST_TIMEOUT_MS,
	);

	it("(d) parks N concurrent duplicates in Postgres with no record reads until the original finishes", async () => {
		const original = await acquire("key-many");
		const readsBefore: number = records.reads;
		const duplicates: Promise<IdempotencyBeginResult>[] = Array.from({ length: CONCURRENT_DUPLICATES }, (): Promise<IdempotencyBeginResult> =>
			ledger.begin(scope, "key-many", "same-hash"),
		);
		await sleep(SETTLE_MS);
		expect(await advisoryWaiters()).toBe(CONCURRENT_DUPLICATES);
		await sleep(OBSERVE_MS);
		// Polling would have read the record on every tick; a lock wait reads nothing.
		expect(records.reads).toBe(readsBefore);

		await ledger.complete(scope, "key-many", original, { id: "sale-3" });

		await expect(Promise.all(duplicates)).resolves.toEqual(Array.from({ length: CONCURRENT_DUPLICATES }, () => ({ kind: "replay", responseBody: { id: "sale-3" } })));
		// One read per duplicate, after it woke.
		expect(records.reads - readsBefore).toBe(CONCURRENT_DUPLICATES);
	});
});
