import { describe, expect, it, vi } from "vitest";

import { BaseRepository } from "./base.repository.js";
import type { CascadeSoftDeletePorts, RepositoryPorts } from "./types.js";

interface TestRow {
	id: string;
	deletedAt: bigint | null;
}

class TestRepository extends BaseRepository<
	string,
	Record<string, never>,
	Record<string, never>,
	{ page: number; limit: number },
	TestRow,
	{ id: string },
	Record<string, never>,
	Record<string, never>,
	Record<string, never>,
	{ id: string }
> {
	public constructor(
		prisma: { $transaction: (handler: (transaction: { product: { updateMany: ReturnType<typeof vi.fn> } }) => Promise<void>) => Promise<void> },
		cascadeSoftDelete: CascadeSoftDeletePorts,
	) {
		const ports: RepositoryPorts<
			string,
			Record<string, never>,
			Record<string, never>,
			{ page: number; limit: number },
			TestRow,
			{ id: string },
			Record<string, never>,
			Record<string, never>,
			Record<string, never>,
			{ id: string }
		> = {
			toDomain: (row) => row.id,
			toCreateInput: () => ({}),
			toUpdateInput: () => ({}),
			buildListWhere: () => ({ id: "x" }),
			buildListOrderBy: () => ({}),
			buildFindByIdWhere: (id) => ({ id }),
			buildUpdateWhere: (id) => ({ id }),
			stampUpdate: (data) => data,
			stampSoftDelete: () => ({ deletedAt: 1 }),
			stampRestore: () => ({ deletedAt: null }),
			cascadeSoftDelete,
		};

		super(
			prisma as never,
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
		const transaction = { product: { updateMany: vi.fn() } };
		const prisma = {
			$transaction: vi.fn(async (handler: (tx: typeof transaction) => Promise<void>) => {
				await handler(transaction);
			}),
		};

		const repository = new TestRepository(prisma, {
			softDeleteChildren,
			restoreChildren: vi.fn(),
			softDeleteParent,
			restoreParent: vi.fn(),
		});

		await repository.delete("category-1");

		expect(prisma.$transaction).toHaveBeenCalledTimes(1);
		expect(softDeleteChildren).toHaveBeenCalledTimes(1);
		expect(softDeleteParent).toHaveBeenCalledTimes(1);
	});
});
