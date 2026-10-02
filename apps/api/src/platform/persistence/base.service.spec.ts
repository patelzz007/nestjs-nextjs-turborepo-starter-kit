import { describe, expect, it } from "vitest";

import { BaseService } from "./base.service";
import { ResourceNotFoundError } from "./persistence.errors";
import type { RepositoryListResult } from "./types";

class TestRepository {
	public found: string | null = "a";

	public list(): Promise<RepositoryListResult<string>> {
		return Promise.resolve({ items: ["a", "b"], total: 12, page: 2, totalPages: 3, nextCursor: null, hasNext: true, hasPrevious: true });
	}

	public findById(): Promise<string | null> {
		return Promise.resolve(this.found);
	}

	public create(input: string): Promise<string> {
		return Promise.resolve(input);
	}

	public update(): Promise<string> {
		return Promise.resolve("updated");
	}

	public async delete(): Promise<void> {}

	public createMany(inputs: readonly string[]): Promise<readonly string[]> {
		return Promise.resolve([...inputs]);
	}

	public deleteMany(ids: readonly string[]): Promise<number> {
		return Promise.resolve(ids.length);
	}

	public async softDelete(): Promise<void> {}

	public restore(): Promise<string> {
		return Promise.resolve("restored");
	}
}

class TestService extends BaseService<string, string, string, { page: number; limit: number }, TestRepository> {
	public constructor(repository: TestRepository) {
		super(repository);
	}
}

describe("BaseService", () => {
	it("builds paginated service results from the repository page", async () => {
		const service = new TestService(new TestRepository());

		await expect(service.list({ page: 2, limit: 5 })).resolves.toEqual({
			items: ["a", "b"],
			total: 12,
			page: 2,
			limit: 5,
			totalPages: 3,
			nextCursor: null,
			hasNext: true,
			hasPrevious: true,
		});
	});

	it("returns the entity when it exists", async () => {
		await expect(new TestService(new TestRepository()).getById("a")).resolves.toBe("a");
	});

	it("throws a typed 404 ResourceNotFoundError (not a bare Error) when the entity is missing", async () => {
		const repository = new TestRepository();
		repository.found = null;
		const service = new TestService(repository);

		await expect(service.getById("missing-id")).rejects.toBeInstanceOf(ResourceNotFoundError);
		await expect(service.getById("missing-id")).rejects.toMatchObject({ code: "NOT_FOUND", httpStatus: 404, details: { resourceId: "missing-id" } });
		await expect(service.update("missing-id", "x")).rejects.toBeInstanceOf(ResourceNotFoundError);
		await expect(service.delete("missing-id")).rejects.toBeInstanceOf(ResourceNotFoundError);
		await expect(service.deleteMany(["missing-id"])).rejects.toBeInstanceOf(ResourceNotFoundError);
	});

	it("deletes many after verifying each id exists", async () => {
		await expect(new TestService(new TestRepository()).deleteMany(["a", "b"])).resolves.toEqual({ deletedCount: 2 });
	});
});
