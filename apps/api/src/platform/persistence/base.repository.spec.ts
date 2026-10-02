import { describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../prisma/prisma.service";

import { BaseRepository } from "./base.repository.js";
import type { CascadeSoftDeletePorts } from "./cascade-soft-delete.js";
import { RepositoryMisconfiguredError, ResourceNotFoundError } from "./persistence.errors.js";
import type { RepositoryPorts } from "./types.js";
import { createTestTypedConfig } from "../../../test/support/test-api-env";

const mocks = vi.hoisted(() => {
	const transaction = { product: { updateMany: vi.fn() } };
	return {
		transaction,
		$transaction: vi.fn(async (handler: (tx: typeof transaction) => Promise<void>): Promise<void> => {
			await handler(transaction);
		}),
	};
});

vi.mock("../../prisma/prisma.service", () => ({
	PrismaService: class {
		public readonly $transaction = mocks.$transaction;
	},
}));

interface TestRow {
	id: string;
	deletedAt: bigint | null;
}

interface TestMutationInput {
	readonly name?: string;
}

interface TestOrderBy {
	readonly id?: "asc" | "desc";
}

interface TestCreateInput {
	readonly name?: string;
}

interface TestUpdateInput {
	readonly name?: string;
	readonly deletedAt?: number | null;
}

type TestPorts = RepositoryPorts<
	string,
	TestMutationInput,
	TestMutationInput,
	{ page: number; limit: number },
	TestRow,
	{ id: string },
	TestOrderBy,
	TestCreateInput,
	TestUpdateInput,
	{ id: string }
>;

class TestRepository extends BaseRepository<
	string,
	TestMutationInput,
	TestMutationInput,
	{ page: number; limit: number },
	TestRow,
	{ id: string },
	TestOrderBy,
	TestCreateInput,
	TestUpdateInput,
	{ id: string }
> {
	public constructor(prisma: PrismaService, cascadeSoftDelete: CascadeSoftDeletePorts, extraPorts: Partial<TestPorts> = {}) {
		const ports: TestPorts = {
			...extraPorts,
			toDomain: (row) => row.id,
			toCreateInput: () => ({}),
			toUpdateInput: () => ({}),
			buildListWhere: () => ({ id: "x" }),
			buildListOrder: () => ({ orderBy: [], isDefault: true }),
			andWhere: (left) => left,
			buildFindByIdWhere: (id) => ({ id }),
			buildUpdateWhere: (id) => ({ id }),
			stampUpdate: (data) => data,
			stampSoftDelete: () => ({ deletedAt: 1 }),
			stampRestore: () => ({ deletedAt: null }),
			cascadeSoftDelete,
		};

		super(
			prisma,
			ports,
			{
				findMany: () => Promise.resolve([]),
				findFirst: () => Promise.resolve(null),
				count: () => Promise.resolve(0),
				create: () => Promise.resolve({ id: "x", deletedAt: null }),
				update: () => Promise.resolve({ id: "x", deletedAt: null }),
				delete: () => Promise.resolve({ id: "x", deletedAt: null }),
			},
			{ softDelete: true, concurrency: false },
		);
	}
}

describe("BaseRepository cascade soft delete", () => {
	it("runs child and parent soft deletes inside one transaction", async () => {
		const softDeleteChildren = vi.fn((): Promise<void> => Promise.resolve());
		const softDeleteParent = vi.fn((): Promise<void> => Promise.resolve());

		const repository = new TestRepository(new PrismaService(createTestTypedConfig()), {
			softDeleteChildren,
			restoreChildren: vi.fn(),
			softDeleteParent,
			restoreParent: vi.fn(),
		});

		await repository.delete("category-1");

		expect(mocks.$transaction).toHaveBeenCalledTimes(1);
		expect(softDeleteChildren).toHaveBeenCalledTimes(1);
		expect(softDeleteParent).toHaveBeenCalledTimes(1);
	});
});

describe("BaseRepository typed errors", () => {
	function cascadePorts(): CascadeSoftDeletePorts {
		return { softDeleteChildren: vi.fn(), restoreChildren: vi.fn(), softDeleteParent: vi.fn(), restoreParent: vi.fn() };
	}

	it("refuses hardDelete on a soft-delete repository with a RepositoryMisconfiguredError", async () => {
		const repository = new TestRepository(new PrismaService(createTestTypedConfig()), cascadePorts());

		await expect(repository.hardDelete("id-1")).rejects.toBeInstanceOf(RepositoryMisconfiguredError);
	});

	it("reports missing cascade restore ports as a misconfiguration", async () => {
		const repository = new TestRepository(new PrismaService(createTestTypedConfig()), cascadePorts());

		await expect(repository.restore("id-1")).rejects.toBeInstanceOf(RepositoryMisconfiguredError);
	});

	it("throws a typed 404 ResourceNotFoundError when restoring a row that does not exist", async () => {
		const repository = new TestRepository(new PrismaService(createTestTypedConfig()), cascadePorts(), {
			buildFindByIdIncludingDeletedWhere: (id: string): { id: string } => ({ id }),
			readDeletedAt: (row: TestRow): number | null => (row.deletedAt === null ? null : Number(row.deletedAt)),
		});

		await expect(repository.restore("missing-id")).rejects.toBeInstanceOf(ResourceNotFoundError);
		await expect(repository.restore("missing-id")).rejects.toMatchObject({ httpStatus: 404, details: { resourceId: "missing-id" } });
	});
});
