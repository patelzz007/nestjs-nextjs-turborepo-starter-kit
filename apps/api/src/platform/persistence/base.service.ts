import type { BulkDeleteResult, PaginatedServiceResult, PaginationInput } from "@workspace/shared";

import { ResourceNotFoundError } from "./persistence.errors";
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
			throw new ResourceNotFoundError(id);
		}
		return row;
	}

	public async create(input: TCreate): Promise<TEntity> {
		return this.repository.create(input);
	}

	/** Conditional, race-safe update — the repository answers 404 (gone) or 409 (stale version) itself. */
	public async update(id: string, input: TUpdate): Promise<TEntity> {
		return this.repository.update(id, input);
	}

	/** Conditional, race-safe delete — the repository answers 404 when the row is missing or already deleted. */
	public async delete(id: string): Promise<void> {
		await this.repository.delete(id);
	}

	public async createMany(inputs: readonly TCreate[]): Promise<readonly TEntity[]> {
		return this.repository.createMany(inputs);
	}

	/** All-or-nothing bulk delete in one transaction; any missing id fails the batch with a 404. */
	public async deleteMany(ids: readonly string[]): Promise<BulkDeleteResult> {
		const deletedCount: number = await this.repository.deleteMany(ids);
		return { deletedCount };
	}

	public async restore(id: string): Promise<TEntity> {
		return this.repository.restore(id);
	}
}
