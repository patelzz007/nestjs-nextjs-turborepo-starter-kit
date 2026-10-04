import { describe, expect, it, vi } from "vitest";

import { UpdateSampleCategorySchema } from "@workspace/shared";

import { ConcurrentModificationError } from "../../../platform/persistence/persistence.errors";
import { PrismaService } from "../../../prisma/prisma.service";
import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { SampleCategoryRepository } from "../sample-category.repository";

const CATEGORY_ID = "5f2d1c4b-8a7e-4b6f-9c3d-2e1f0a9b8c7d";
const READ_VERSION = 2;

const mocks = vi.hoisted(() => ({
	updateManyAndReturn: vi.fn(),
	findFirst: vi.fn(),
}));

vi.mock("../../../prisma/prisma.service", () => ({
	PrismaService: class {
		public readonly sampleCategory = { updateManyAndReturn: mocks.updateManyAndReturn, findFirst: mocks.findFirst };
	},
}));

describe("SampleCategoryRepository", () => {
	it("exposes list and findById repository methods", () => {
		expect(SampleCategoryRepository.prototype).toHaveProperty("list", expect.any(Function));
		expect(SampleCategoryRepository.prototype).toHaveProperty("findById", expect.any(Function));
	});

	it("exposes create and delete repository methods", () => {
		expect(SampleCategoryRepository.prototype).toHaveProperty("create", expect.any(Function));
		expect(SampleCategoryRepository.prototype).toHaveProperty("delete", expect.any(Function));
	});

	it("updates optimistically: only the live row still at the read version, bumping the version — else 409", async () => {
		mocks.updateManyAndReturn.mockResolvedValueOnce([]);
		mocks.findFirst.mockResolvedValueOnce({ id: CATEGORY_ID });
		const repository = new SampleCategoryRepository(new PrismaService(createTestTypedConfig()));

		await expect(repository.update(CATEGORY_ID, { name: "Renamed", version: READ_VERSION })).rejects.toBeInstanceOf(ConcurrentModificationError);

		expect(mocks.updateManyAndReturn.mock.calls.at(0)?.at(0)).toMatchObject({
			where: { id: CATEGORY_ID, deletedAt: null, version: READ_VERSION },
			data: { name: "Renamed", version: { increment: 1 } },
		});
	});

	it("requires the read version on every update payload", () => {
		expect(UpdateSampleCategorySchema.safeParse({ name: "Renamed" }).success).toBe(false);
		expect(UpdateSampleCategorySchema.safeParse({ name: "Renamed", version: READ_VERSION }).success).toBe(true);
	});
});
