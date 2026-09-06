import { describe, expect, it } from "vitest";

import type { PaginatedServiceResult, PaginationInput } from "@workspace/shared";

import { BaseService } from "./base.service.js";

class TestRepository {
	public async list(): Promise<{ items: readonly string[]; total: number }> {
		return { items: ["a", "b"], total: 2 };
	}

	public async findById(): Promise<string | null> {
		return "a";
	}

	public async create(input: string): Promise<string> {
		return input;
	}

	public async update(): Promise<string> {
		return "updated";
	}

	public async delete(): Promise<void> {}

	public async softDelete(): Promise<void> {}

	public async restore(): Promise<string> {
		return "restored";
	}
}

class TestService extends BaseService<string, string, string, { page: number; limit: number }, TestRepository> {
	public constructor(repository: TestRepository) {
		super(repository);
	}

	public exposePaginate(): (items: readonly string[], total: number, query: PaginationInput) => PaginatedServiceResult<string> {
		return this.paginate.bind(this);
	}
}

describe("BaseService", () => {
	it("builds paginated service results", () => {
		const service = new TestService(new TestRepository());
		const result = service.exposePaginate()(["a", "b"], 12, { page: 2, limit: 5 });
		expect(result).toEqual({
			items: ["a", "b"],
			total: 12,
			page: 2,
			limit: 5,
			totalPages: 3,
			hasNext: true,
			hasPrevious: true,
		});
	});
});
