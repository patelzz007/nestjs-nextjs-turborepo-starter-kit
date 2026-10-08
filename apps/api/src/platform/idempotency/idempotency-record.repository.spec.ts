import { Prisma } from "@prisma/client";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../prisma/prisma.service";
import { TenantTransactionService } from "../../prisma/tenant-transaction.service";
import { IdempotencyRecordRepository } from "./idempotency-record.repository";
import { IDEMPOTENCY_RETENTION_OPERATION, IDEMPOTENCY_SYSTEM_OPERATION } from "./idempotency.constants";
import { createTestTypedConfig } from "../../../test/support/test-api-env";
import { RequestContextService } from "../../common/context/request-context";

const KEY = { scope: "http:user-1:POST /api/v1/product", idempotencyKey: "key-00000001" };
const NOW = 1_790_812_800_000;
const LEASE = { token: "4f8e6d2a-1b3c-4d5e-8f90-a1b2c3d4e5f6", requestHash: "h1" };
const TAKEOVER_LEASE = { token: "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d", requestHash: "h2" };

describe("IdempotencyRecordRepository", () => {
	let prisma: PrismaService;
	let tenantTx: TenantTransactionService;
	let repository: IdempotencyRecordRepository;
	let systemOperation: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		prisma = new PrismaService(createTestTypedConfig());
		tenantTx = new TenantTransactionService(prisma, new RequestContextService());
		systemOperation = vi.spyOn(tenantTx, "withSystemOperation").mockImplementation(async (_context, handler) => handler(prisma));
		repository = new IdempotencyRecordRepository(tenantTx);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("runs every statement under the allowlisted http.idempotency system operation", async () => {
		vi.spyOn(prisma.platformResourceIdempotencyRecord, "findUnique").mockResolvedValue(null);

		await repository.find(KEY);

		expect(systemOperation).toHaveBeenCalledWith(expect.objectContaining({ operation: IDEMPOTENCY_SYSTEM_OPERATION, actorUserId: null }), expect.any(Function));
	});

	describe("tryAcquire", () => {
		it("inserts an IN_PROGRESS row with the lease as expiry", async () => {
			const create = vi.spyOn(prisma.platformResourceIdempotencyRecord, "create").mockResolvedValue({
				id: "r-1",
				scope: KEY.scope,
				idempotencyKey: KEY.idempotencyKey,
				requestHash: "h1",
				leaseToken: LEASE.token,
				status: "IN_PROGRESS",
				responseBody: null,
				expiresAt: BigInt(NOW + 1),
				createdAt: BigInt(NOW),
				updatedAt: BigInt(NOW),
			});

			await expect(repository.tryAcquire(KEY, LEASE, NOW + 1, NOW)).resolves.toBe(true);
			const args = create.mock.lastCall?.[LIST_SLOT_INDEX.first];
			expect(Object.keys(args ?? {})).toEqual(["data"]);
			expect(args?.data).toMatchObject({ ...KEY, requestHash: "h1", leaseToken: LEASE.token, status: "IN_PROGRESS", expiresAt: BigInt(NOW + 1) });
		});

		it("returns false when the unique (scope, key) index rejects the insert", async () => {
			vi.spyOn(prisma.platformResourceIdempotencyRecord, "create").mockRejectedValue(
				new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "7.0.0" }),
			);

			await expect(repository.tryAcquire(KEY, LEASE, NOW + 1, NOW)).resolves.toBe(false);
		});

		it("rethrows any other database error", async () => {
			vi.spyOn(prisma.platformResourceIdempotencyRecord, "create").mockRejectedValue(new Error("connection lost"));

			await expect(repository.tryAcquire(KEY, LEASE, NOW + 1, NOW)).rejects.toThrow("connection lost");
		});
	});

	describe("find", () => {
		it("maps the row to a snapshot with epoch-ms expiry", async () => {
			vi.spyOn(prisma.platformResourceIdempotencyRecord, "findUnique").mockResolvedValue({
				id: "r-1",
				scope: KEY.scope,
				idempotencyKey: KEY.idempotencyKey,
				requestHash: "h1",
				leaseToken: LEASE.token,
				status: "COMPLETED",
				responseBody: { body: { id: "p-1" } },
				expiresAt: BigInt(NOW),
				createdAt: BigInt(NOW),
				updatedAt: BigInt(NOW),
			});

			await expect(repository.find(KEY)).resolves.toEqual({ requestHash: "h1", status: "COMPLETED", responseBody: { body: { id: "p-1" } }, expiresAtEpochMs: NOW });
		});

		it("returns null when the key is unused", async () => {
			vi.spyOn(prisma.platformResourceIdempotencyRecord, "findUnique").mockResolvedValue(null);

			await expect(repository.find(KEY)).resolves.toBeNull();
		});
	});

	describe("conditional updates", () => {
		it("takes over only an expired row", async () => {
			const updateMany = vi.spyOn(prisma.platformResourceIdempotencyRecord, "updateMany").mockResolvedValue({ count: 1 });

			await expect(repository.takeOverExpired(KEY, TAKEOVER_LEASE, NOW + 1, NOW)).resolves.toBe(true);
			const args = updateMany.mock.lastCall?.[LIST_SLOT_INDEX.first];
			expect(Object.keys(args ?? {})).toEqual(["where", "data"]);
			expect(args?.where).toEqual({ ...KEY, expiresAt: { lte: BigInt(NOW) } });
			expect(args?.data).toMatchObject({ requestHash: "h2", leaseToken: TAKEOVER_LEASE.token, status: "IN_PROGRESS", expiresAt: BigInt(NOW + 1) });
			expect(args?.data.responseBody).toBe(Prisma.DbNull);
		});

		it("reports a lost takeover race", async () => {
			vi.spyOn(prisma.platformResourceIdempotencyRecord, "updateMany").mockResolvedValue({ count: 0 });

			await expect(repository.takeOverExpired(KEY, TAKEOVER_LEASE, NOW + 1, NOW)).resolves.toBe(false);
		});

		it("completes only the CURRENT lease holder's live IN_PROGRESS row (fencing token + unexpired lease)", async () => {
			const updateMany = vi.spyOn(prisma.platformResourceIdempotencyRecord, "updateMany").mockResolvedValue({ count: 1 });

			await expect(repository.complete(KEY, LEASE, { body: { id: "p-1" } }, NOW + 5, NOW)).resolves.toBe(true);
			const args = updateMany.mock.lastCall?.[LIST_SLOT_INDEX.first];
			expect(Object.keys(args ?? {})).toEqual(["where", "data"]);
			expect(args?.where).toEqual({ ...KEY, leaseToken: LEASE.token, requestHash: "h1", status: "IN_PROGRESS", expiresAt: { gt: BigInt(NOW) } });
			expect(args?.data).toMatchObject({ status: "COMPLETED", expiresAt: BigInt(NOW + 5) });
			expect(args?.data.responseBody).toEqual({ body: { id: "p-1" } });
		});

		it("reports a lost lease when the holder's token no longer matches", async () => {
			vi.spyOn(prisma.platformResourceIdempotencyRecord, "updateMany").mockResolvedValue({ count: 0 });

			await expect(repository.complete(KEY, LEASE, { body: null }, NOW + 5, NOW)).resolves.toBe(false);
		});

		it("releases by expiring the lease now (never deleting the row), only for the lease holder", async () => {
			const updateMany = vi.spyOn(prisma.platformResourceIdempotencyRecord, "updateMany").mockResolvedValue({ count: 1 });

			await expect(repository.release(KEY, LEASE, NOW)).resolves.toBe(true);

			expect(updateMany).toHaveBeenCalledWith({ where: { ...KEY, leaseToken: LEASE.token, status: "IN_PROGRESS" }, data: { expiresAt: BigInt(NOW), updatedAt: BigInt(NOW) } });
		});
	});
	describe("deleteExpiredBefore (retention)", () => {
		const CUTOFF = NOW - 1_000;

		it("runs under the idempotency.retention system operation, not the request one", async () => {
			vi.spyOn(prisma.platformResourceIdempotencyRecord, "findMany").mockResolvedValue([]);

			await repository.deleteExpiredBefore(CUTOFF, 10);

			expect(systemOperation).toHaveBeenCalledWith(expect.objectContaining({ operation: IDEMPOTENCY_RETENTION_OPERATION, actorUserId: null }), expect.any(Function));
		});

		it("selects the oldest expired ids up to the batch size, then deletes them re-checking the cutoff", async () => {
			const findMany = vi.spyOn(prisma.platformResourceIdempotencyRecord, "findMany").mockResolvedValue([
				{
					id: "r-1",
					scope: KEY.scope,
					idempotencyKey: "k-1",
					requestHash: "h",
					leaseToken: LEASE.token,
					status: "COMPLETED",
					responseBody: null,
					expiresAt: BigInt(1),
					createdAt: BigInt(1),
					updatedAt: BigInt(1),
				},
				{
					id: "r-2",
					scope: KEY.scope,
					idempotencyKey: "k-2",
					requestHash: "h",
					leaseToken: LEASE.token,
					status: "IN_PROGRESS",
					responseBody: null,
					expiresAt: BigInt(2),
					createdAt: BigInt(2),
					updatedAt: BigInt(2),
				},
			]);
			const deleteMany = vi.spyOn(prisma.platformResourceIdempotencyRecord, "deleteMany").mockResolvedValue({ count: 1 });

			await expect(repository.deleteExpiredBefore(CUTOFF, 2)).resolves.toBe(1);
			expect(findMany).toHaveBeenCalledWith({ where: { expiresAt: { lt: BigInt(CUTOFF) } }, orderBy: { expiresAt: "asc" }, take: 2, select: { id: true } });
			// The cutoff is re-checked in the DELETE: a row taken over in between (new future lease) survives.
			expect(deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["r-1", "r-2"] }, expiresAt: { lt: BigInt(CUTOFF) } } });
		});

		it("issues no DELETE when nothing is expired", async () => {
			vi.spyOn(prisma.platformResourceIdempotencyRecord, "findMany").mockResolvedValue([]);
			const deleteMany = vi.spyOn(prisma.platformResourceIdempotencyRecord, "deleteMany");

			await expect(repository.deleteExpiredBefore(CUTOFF, 10)).resolves.toBe(0);
			expect(deleteMany).not.toHaveBeenCalled();
		});
	});
});
