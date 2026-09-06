import { NotFoundException } from "@nestjs/common";

import type { PaginatedServiceResult, PaginationInput } from "@workspace/shared";

import type { RepositoryInstance, RepositoryListResult } from "./types.js";

export abstract class BaseService<TEntity, TCreate, TUpdate, TQuery extends PaginationInput, TRepository extends RepositoryInstance<TEntity, TCreate, TUpdate, TQuery>> {
	public constructor(protected readonly repository: TRepository) {}

	protected paginate(items: readonly TEntity[], total: number, query: PaginationInput): PaginatedServiceResult<TEntity> {
		const totalPages = query.limit > 0 ? Math.ceil(total / query.limit) : 0;
		return {
			items: [...items],
			total,
			page: query.page,
			limit: query.limit,
			totalPages,
			hasNext: query.page < totalPages,
			hasPrevious: query.page > 1,
		};
	}

	protected paginateListResult(result: RepositoryListResult<TEntity>, query: PaginationInput): PaginatedServiceResult<TEntity> {
		return this.paginate(result.items, result.total, query);
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

	public async restore(id: string): Promise<TEntity> {
		return this.repository.restore(id);
	}
}
