import { describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../prisma/prisma.service";

import { BaseRepository } from "./base.repository.js";
import type { CascadeSoftDeletePorts } from "./cascade-soft-delete.js";
import type { RepositoryPorts } from "./types.js";

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
	public constructor(prisma: PrismaService, cascadeSoftDelete: CascadeSoftDeletePorts) {
		const ports: TestPorts = {
			toDomain: (row) => row.id,
			toCreateInput: () => ({}),
			toUpdateInput: () => ({}),
			buildListWhere: () => ({ id: "x" }),
			buildListOrderBy: () => ({}),
			buildListCursorOrderBy: () => ({}),
			mergeListCursor: (where, cursorId) => ({ ...where, id: cursorId }),
			readListCursorId: (row) => row.id,
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
				findMany: async () => [],
				findFirst: async () => null,
				count: async () => 0,
				create: async () => ({ id: "x", deletedAt: null }),
				update: async () => ({ id: "x", deletedAt: null }),
				delete: async () => ({ id: "x", deletedAt: null }),
			},
			{ softDelete: true, concurrency: false },
		);
	}
}

describe("BaseRepository cascade soft delete", () => {
	it("runs child and parent soft deletes inside one transaction", async () => {
		const softDeleteChildren = vi.fn(async (): Promise<void> => undefined);
		const softDeleteParent = vi.fn(async (): Promise<void> => undefined);

		const repository = new TestRepository(new PrismaService(), {
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
