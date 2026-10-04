import { describe, expect, it, vi } from "vitest";

import { UpdateProductSchema } from "@workspace/shared";

import { ConcurrentModificationError } from "../../../platform/persistence/persistence.errors";
import { PrismaService } from "../../../prisma/prisma.service";
import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { ProductRepository } from "../product.repository";

const PRODUCT_ID = "0b6f8f5e-6d3b-4a59-9d55-4c3b1f2a7e10";
const CATEGORY_ID = "5f2d1c4b-8a7e-4b6f-9c3d-2e1f0a9b8c7d";
const READ_VERSION = 3;

const mocks = vi.hoisted(() => ({
	updateManyAndReturn: vi.fn(),
	findFirst: vi.fn(),
}));

vi.mock("../../../prisma/prisma.service", () => ({
	PrismaService: class {
		public readonly product = { updateManyAndReturn: mocks.updateManyAndReturn, findFirst: mocks.findFirst };
	},
}));

describe("ProductRepository", () => {
	it("exposes list and findById repository methods", () => {
		expect(ProductRepository.prototype).toHaveProperty("list", expect.any(Function));
		expect(ProductRepository.prototype).toHaveProperty("findById", expect.any(Function));
	});

	it("exposes create and delete repository methods", () => {
		expect(ProductRepository.prototype).toHaveProperty("create", expect.any(Function));
		expect(ProductRepository.prototype).toHaveProperty("delete", expect.any(Function));
	});

	it("updates optimistically: only the live row still at the version the client read, bumping the version", async () => {
		mocks.updateManyAndReturn.mockResolvedValueOnce([]);
		mocks.findFirst.mockResolvedValueOnce({ id: PRODUCT_ID });
		const repository = new ProductRepository(new PrismaService(createTestTypedConfig()));

		await expect(repository.update(PRODUCT_ID, { name: "Renamed", categoryId: CATEGORY_ID, version: READ_VERSION })).rejects.toBeInstanceOf(ConcurrentModificationError);

		expect(mocks.updateManyAndReturn).toHaveBeenCalledTimes(1);
		expect(mocks.updateManyAndReturn.mock.calls.at(0)?.at(0)).toMatchObject({
			where: { id: PRODUCT_ID, deletedAt: null, version: READ_VERSION },
			data: { name: "Renamed", categoryId: CATEGORY_ID, version: { increment: 1 } },
		});
	});

	it("requires the read version on every update payload", () => {
		expect(UpdateProductSchema.safeParse({ name: "Renamed" }).success).toBe(false);
		expect(UpdateProductSchema.safeParse({ name: "Renamed", version: READ_VERSION }).success).toBe(true);
	});
});
