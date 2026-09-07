import { NotFoundException } from "@nestjs/common";

import type { BulkDeleteResult, PaginatedServiceResult, PaginationInput } from "@workspace/shared";

import type { RepositoryInstance, RepositoryListResult } from "./types";

export abstract class BaseService<TEntity, TCreate, TUpdate, TQuery extends PaginationInput, TRepository extends RepositoryInstance<TEntity, TCreate, TUpdate, TQuery>> {
	public constructor(protected readonly repository: TRepository) {}

	protected paginateListResult(result: RepositoryListResult<TEntity>, query: PaginationInput): PaginatedServiceResult<TEntity> {
		return {
			items: [...result.items],
			limit: query.limit,
			total: result.total,
			page: result.page,
			totalPages: result.totalPages,
			nextCursor: result.nextCursor,
			hasNext: result.hasNext,
			hasPrevious: result.hasPrevious,
		};
	}

	public async list(query: TQuery): Promise<PaginatedServiceResult<TEntity>> {
		const result = await this.repository.list(query);
		return this.paginateListResult(result, query);
	}

	public async getById(id: string): Promise<TEntity> {
		const row = await this.repository.findById(id);
		if (row === null) {
			throw new NotFoundException("Resource not found");
		}
		return row;
	}

	public async create(input: TCreate): Promise<TEntity> {
		return this.repository.create(input);
	}

	public async update(id: string, input: TUpdate, expectedVersion?: number): Promise<TEntity> {
		await this.getById(id);
		return this.repository.update(id, input, expectedVersion);
	}

	public async delete(id: string): Promise<void> {
		await this.getById(id);
		await this.repository.delete(id);
	}

	public async createMany(inputs: readonly TCreate[]): Promise<readonly TEntity[]> {
		return this.repository.createMany(inputs);
	}

	public async deleteMany(ids: readonly string[]): Promise<BulkDeleteResult> {
		for (const id of ids) {
			await this.getById(id);
		}
		const deletedCount = await this.repository.deleteMany(ids);
		return { deletedCount };
	}

	public async restore(id: string): Promise<TEntity> {
		return this.repository.restore(id);
	}
}
