import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../prisma/prisma.service";

import { BaseRepository } from "./base.repository.js";
import type { CascadeSoftDeletePorts } from "./cascade-soft-delete.js";
import { ConcurrentModificationError, RepositoryMisconfiguredError, ResourceNotFoundError } from "./persistence.errors.js";
import type { PrismaModelDelegate, RepositoryPorts } from "./types.js";
import { createTestTypedConfig } from "../../../test/support/test-api-env";

const mocks = vi.hoisted(() => {
	/** The client a `$transaction` callback receives — the delegate selector tells it from the root client by identity. */
	const transactionClient = { kind: "transaction-client" };
	return {
		transactionClient,
		$transaction: vi.fn(async <TResult>(handler: (tx: typeof transactionClient) => Promise<TResult>): Promise<TResult> => handler(transactionClient)),
	};
});

vi.mock("../../prisma/prisma.service", () => ({
	PrismaService: class {
		public readonly $transaction = mocks.$transaction;
	},
}));

interface TestRow {
	id: string;
	version: number;
	deletedAt: bigint | null;
}

interface TestCreate {
	readonly id: string;
}

interface TestUpdate {
	readonly name?: string;
	readonly version: number;
}

interface TestWhere {
	readonly id: string;
	readonly deletedAt?: null;
	readonly version?: number;
}

interface TestOrderBy {
	readonly id?: "asc" | "desc";
}

interface TestCreateInput {
	readonly id: string;
}

interface TestUpdateInput {
	readonly name?: string;
	readonly deletedAt?: number | null;
}

interface TestQuery {
	page: number;
	limit: number;
}

type TestPorts = RepositoryPorts<string, TestCreate, TestUpdate, TestQuery, TestRow, TestWhere, TestOrderBy, TestCreateInput, TestUpdateInput, { id: string }>;

type TestDelegate = PrismaModelDelegate<TestRow, TestWhere, TestOrderBy, TestCreateInput, TestUpdateInput, { id: string }>;

function row(id: string, version = 0): TestRow {
	return { id, version, deletedAt: null };
}

/** A fresh mocked delegate: by default every conditional statement matches exactly one row. */
function createDelegate(): {
	readonly findMany: ReturnType<typeof vi.fn<TestDelegate["findMany"]>>;
	readonly findFirst: ReturnType<typeof vi.fn<TestDelegate["findFirst"]>>;
	readonly count: ReturnType<typeof vi.fn<TestDelegate["count"]>>;
	readonly create: ReturnType<typeof vi.fn<TestDelegate["create"]>>;
	readonly update: ReturnType<typeof vi.fn<TestDelegate["update"]>>;
	readonly updateMany: ReturnType<typeof vi.fn<TestDelegate["updateMany"]>>;
	readonly updateManyAndReturn: ReturnType<typeof vi.fn<TestDelegate["updateManyAndReturn"]>>;
	readonly delete: ReturnType<typeof vi.fn<TestDelegate["delete"]>>;
} {
	return {
		findMany: vi.fn<TestDelegate["findMany"]>(() => Promise.resolve([])),
		findFirst: vi.fn<TestDelegate["findFirst"]>(() => Promise.resolve(null)),
		count: vi.fn<TestDelegate["count"]>(() => Promise.resolve(0)),
		create: vi.fn<TestDelegate["create"]>((args) => Promise.resolve(row(args.data.id))),
		update: vi.fn<TestDelegate["update"]>((args) => Promise.resolve(row(args.where.id))),
		updateMany: vi.fn<TestDelegate["updateMany"]>(() => Promise.resolve({ count: 1 })),
		updateManyAndReturn: vi.fn<TestDelegate["updateManyAndReturn"]>((args) => Promise.resolve([row(args.where.id, (args.where.version ?? 0) + 1)])),
		delete: vi.fn<TestDelegate["delete"]>((args) => Promise.resolve(row(args.where.id))),
	};
}

type MockDelegate = ReturnType<typeof createDelegate>;

class TestRepository extends BaseRepository<string, TestCreate, TestUpdate, TestQuery, TestRow, TestWhere, TestOrderBy, TestCreateInput, TestUpdateInput, { id: string }> {
	public constructor(prisma: PrismaService, delegates: { readonly root: MockDelegate; readonly transaction: MockDelegate }, extraPorts: Partial<TestPorts> = {}) {
		const ports: TestPorts = {
			toDomain: (testRow) => `${testRow.id}@v${String(testRow.version)}`,
			toCreateInput: (input) => ({ id: input.id }),
			toUpdateInput: (input) => (input.name === undefined ? {} : { name: input.name }),
			buildListWhere: () => ({ id: "x" }),
			buildListOrder: () => ({ orderBy: [], isDefault: true }),
			andWhere: (left) => left,
			buildFindByIdWhere: (id) => ({ id, deletedAt: null }),
			buildLiveWhere: (id) => ({ id, deletedAt: null }),
			buildUniqueWhere: (id) => ({ id }),
			buildUpdateWhere: (id, input) => ({ id, deletedAt: null, version: input.version }),
			stampUpdate: (data) => data,
			stampSoftDelete: () => ({ deletedAt: 1 }),
			stampRestore: () => ({ deletedAt: null }),
			...extraPorts,
		};

		super(prisma, ports, (db: Prisma.TransactionClient): TestDelegate => (Object.is(db, mocks.transactionClient) ? delegates.transaction : delegates.root), {
			softDelete: true,
		});
	}
}

function cascadePorts(overrides: Partial<CascadeSoftDeletePorts> = {}): CascadeSoftDeletePorts {
	return {
		softDeleteChildren: vi.fn((): Promise<void> => Promise.resolve()),
		restoreChildren: vi.fn((): Promise<void> => Promise.resolve()),
		softDeleteParent: vi.fn((): Promise<number> => Promise.resolve(1)),
		restoreParent: vi.fn((): Promise<void> => Promise.resolve()),
		...overrides,
	};
}

describe("BaseRepository", () => {
	let root: MockDelegate;
	let transaction: MockDelegate;

	function repository(extraPorts: Partial<TestPorts> = {}): TestRepository {
		return new TestRepository(new PrismaService(createTestTypedConfig()), { root, transaction }, extraPorts);
	}

	beforeEach(() => {
		mocks.$transaction.mockClear();
		root = createDelegate();
		transaction = createDelegate();
	});

	describe("createMany", () => {
		it("creates every row through ONE transaction and returns them all, in input order", async () => {
			await expect(repository().createMany([{ id: "a" }, { id: "b" }, { id: "c" }])).resolves.toEqual(["a@v0", "b@v0", "c@v0"]);

			expect(mocks.$transaction).toHaveBeenCalledTimes(1);
			expect(transaction.create).toHaveBeenCalledTimes(3);
			expect(root.create).not.toHaveBeenCalled();
		});

		it("propagates a failing row so the transaction rolls the whole batch back", async () => {
			transaction.create.mockResolvedValueOnce(row("a")).mockRejectedValueOnce(new Error("unique constraint"));

			await expect(repository().createMany([{ id: "a" }, { id: "b" }])).rejects.toThrow("unique constraint");
			expect(mocks.$transaction).toHaveBeenCalledTimes(1);
		});

		it("does not open a transaction for an empty batch", async () => {
			await expect(repository().createMany([])).resolves.toEqual([]);
			expect(mocks.$transaction).not.toHaveBeenCalled();
		});
	});

	describe("deleteMany", () => {
		it("soft-deletes each live row with a conditional statement inside ONE transaction and counts unique ids", async () => {
			await expect(repository().deleteMany(["a", "b", "a"])).resolves.toBe(2);

			expect(mocks.$transaction).toHaveBeenCalledTimes(1);
			expect(transaction.updateMany).toHaveBeenCalledTimes(2);
			expect(transaction.updateMany).toHaveBeenCalledWith({ where: { id: "a", deletedAt: null }, data: { deletedAt: 1 } });
			expect(root.updateMany).not.toHaveBeenCalled();
		});

		it("fails the whole batch with a 404 for an id that is missing or already deleted", async () => {
			transaction.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

			await expect(repository().deleteMany(["a", "gone"])).rejects.toMatchObject({ httpStatus: 404, details: { resourceId: "gone" } });
		});

		it("runs the cascade for every id inside the same transaction", async () => {
			const cascade = cascadePorts();

			await expect(repository({ cascadeSoftDelete: cascade }).deleteMany(["a", "b"])).resolves.toBe(2);

			expect(mocks.$transaction).toHaveBeenCalledTimes(1);
			expect(cascade.softDeleteParent).toHaveBeenCalledTimes(2);
			expect(cascade.softDeleteChildren).toHaveBeenCalledTimes(2);
		});
	});

	describe("update", () => {
		it("applies ONE conditional update on the live row at the expected version", async () => {
			await expect(repository().update("a", { name: "renamed", version: 4 })).resolves.toBe("a@v5");

			expect(root.updateManyAndReturn).toHaveBeenCalledWith({ where: { id: "a", deletedAt: null, version: 4 }, data: { name: "renamed" } });
			expect(root.findFirst).not.toHaveBeenCalled();
			expect(root.update).not.toHaveBeenCalled();
		});

		it("answers 409 when the row is live but another request changed its version first", async () => {
			root.updateManyAndReturn.mockResolvedValueOnce([]);
			root.findFirst.mockResolvedValueOnce(row("a", 5));

			await expect(repository().update("a", { version: 4 })).rejects.toBeInstanceOf(ConcurrentModificationError);
			expect(root.findFirst).toHaveBeenCalledWith({ where: { id: "a", deletedAt: null } });
		});

		it("answers 404 when the row is missing or was deleted before the update", async () => {
			root.updateManyAndReturn.mockResolvedValueOnce([]);

			await expect(repository().update("gone", { version: 0 })).rejects.toBeInstanceOf(ResourceNotFoundError);
		});
	});

	describe("delete / softDelete", () => {
		it("soft-deletes with one conditional statement and answers 404 when nothing was live", async () => {
			await repository().delete("a");
			expect(root.updateMany).toHaveBeenCalledWith({ where: { id: "a", deletedAt: null }, data: { deletedAt: 1 } });

			root.updateMany.mockResolvedValueOnce({ count: 0 });
			await expect(repository().softDelete("a")).rejects.toBeInstanceOf(ResourceNotFoundError);
		});

		it("runs the parent and child soft deletes inside one transaction", async () => {
			const cascade = cascadePorts();

			await repository({ cascadeSoftDelete: cascade }).delete("category-1");

			expect(mocks.$transaction).toHaveBeenCalledTimes(1);
			expect(cascade.softDeleteParent).toHaveBeenCalledTimes(1);
			expect(cascade.softDeleteChildren).toHaveBeenCalledTimes(1);
		});

		it("answers 404 and never touches children when the parent was already deleted", async () => {
			const cascade = cascadePorts({ softDeleteParent: vi.fn((): Promise<number> => Promise.resolve(0)) });

			await expect(repository({ cascadeSoftDelete: cascade }).delete("category-1")).rejects.toBeInstanceOf(ResourceNotFoundError);
			expect(cascade.softDeleteChildren).not.toHaveBeenCalled();
		});
	});

	describe("typed errors", () => {
		it("refuses hardDelete on a soft-delete repository with a RepositoryMisconfiguredError", async () => {
			await expect(repository().hardDelete("id-1")).rejects.toBeInstanceOf(RepositoryMisconfiguredError);
		});

		it("reports missing cascade restore ports as a misconfiguration", async () => {
			await expect(repository({ cascadeSoftDelete: cascadePorts() }).restore("id-1")).rejects.toBeInstanceOf(RepositoryMisconfiguredError);
		});

		it("throws a typed 404 ResourceNotFoundError when restoring a row that does not exist", async () => {
			const cascadeRepository = repository({
				cascadeSoftDelete: cascadePorts(),
				buildFindByIdIncludingDeletedWhere: (id: string): TestWhere => ({ id }),
				readDeletedAt: (testRow: TestRow): number | null => (testRow.deletedAt === null ? null : Number(testRow.deletedAt)),
			});

			await expect(cascadeRepository.restore("missing-id")).rejects.toBeInstanceOf(ResourceNotFoundError);
			await expect(cascadeRepository.restore("missing-id")).rejects.toMatchObject({ httpStatus: 404, details: { resourceId: "missing-id" } });
		});
	});
});
