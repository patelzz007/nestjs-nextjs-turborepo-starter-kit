import type { Prisma } from "@prisma/client";

import type { PaginationInput } from "@workspace/shared";
import { nowEpochMs } from "@workspace/shared";

import { PrismaService } from "../../prisma/prisma.service";

import { fetchListPage, mapListResult } from "./list-page";
import { ConcurrentModificationError, RepositoryMisconfiguredError, ResourceNotFoundError } from "./persistence.errors";
import type { BaseRepositoryOptions, PrismaModelDelegate, PrismaModelDelegateSelector, RepositoryListResult, RepositoryPorts } from "./types";

/**
 * Generic CRUD over one Prisma model. Every write is race-safe by construction:
 *
 *   - `update` / `softDelete` / `delete` are ONE conditional statement whose
 *     `where` re-checks the row is still live (and, for versioned entities,
 *     still at the version the caller read) — never read-then-write;
 *   - `createMany` / `deleteMany` run in ONE transaction, so a failing row
 *     rolls the whole batch back and the returned rows / count are exactly
 *     what was committed.
 */
export abstract class BaseRepository<TEntity, TCreate, TUpdate, TQuery extends PaginationInput, TRow, TWhere, TOrderBy, TCreateInput, TUpdateInput, TUpdateWhere> {
	protected readonly delegate: PrismaModelDelegate<TRow, TWhere, TOrderBy, TCreateInput, TUpdateInput, TUpdateWhere>;

	public constructor(
		protected readonly prisma: PrismaService,
		protected readonly ports: RepositoryPorts<TEntity, TCreate, TUpdate, TQuery, TRow, TWhere, TOrderBy, TCreateInput, TUpdateInput, TUpdateWhere>,
		private readonly delegateOf: PrismaModelDelegateSelector<TRow, TWhere, TOrderBy, TCreateInput, TUpdateInput, TUpdateWhere>,
		protected readonly options: BaseRepositoryOptions,
	) {
		this.delegate = delegateOf(prisma);
	}

	public async create(input: TCreate): Promise<TEntity> {
		const row = await this.delegate.create({ data: this.ports.toCreateInput(input) });
		return this.ports.toDomain(row);
	}

	/** Creates every row in one transaction (all or nothing), returning them in input order. */
	public async createMany(inputs: readonly TCreate[]): Promise<readonly TEntity[]> {
		if (inputs.length === 0) {
			return [];
		}
		const rows: TRow[] = await this.prisma.$transaction(async (transaction: Prisma.TransactionClient): Promise<TRow[]> => {
			const delegate = this.delegateOf(transaction);
			const created: TRow[] = [];
			for (const input of inputs) {
				created.push(await delegate.create({ data: this.ports.toCreateInput(input) }));
			}
			return created;
		});
		return rows.map((row: TRow): TEntity => this.ports.toDomain(row));
	}

	/**
	 * Deletes every id in one transaction (all or nothing). A missing or
	 * already-deleted id fails the whole batch with a 404 for that id. Duplicate
	 * ids count once; the result is the number of rows actually deleted.
	 */
	public async deleteMany(ids: readonly string[]): Promise<number> {
		const uniqueIds: string[] = [...new Set(ids)];
		if (uniqueIds.length === 0) {
			return 0;
		}
		await this.prisma.$transaction(async (transaction: Prisma.TransactionClient): Promise<void> => {
			for (const id of uniqueIds) {
				await this.deleteWithin(transaction, id);
			}
		});
		return uniqueIds.length;
	}

	public async findById(id: string): Promise<TEntity | null> {
		const row = await this.delegate.findFirst({ where: this.ports.buildFindByIdWhere(id) });
		return row === null ? null : this.ports.toDomain(row);
	}

	public async list(query: TQuery): Promise<RepositoryListResult<TEntity>> {
		const result = await fetchListPage<TWhere, TOrderBy, TRow>(query, {
			where: this.ports.buildListWhere(query),
			order: this.ports.buildListOrder(query),
			keyset: this.ports.listKeyset,
			and: (left, right) => this.ports.andWhere(left, right),
			count: (where) => this.delegate.count({ where }),
			findMany: (args) => this.delegate.findMany(args),
		});
		return mapListResult(result, (row: TRow) => this.ports.toDomain(row));
	}

	/**
	 * One conditional `UPDATE … RETURNING`: it only applies while the row still
	 * matches {@link RepositoryPorts.buildUpdateWhere} (live, and at the expected
	 * version for versioned entities). When nothing matched, a follow-up read
	 * tells the two failures apart: the row is gone (404) or another request
	 * changed it first (409).
	 */
	public async update(id: string, input: TUpdate): Promise<TEntity> {
		const rows: TRow[] = await this.delegate.updateManyAndReturn({
			where: this.ports.buildUpdateWhere(id, input),
			data: this.ports.stampUpdate(this.ports.toUpdateInput(input)),
		});
		const updated: TRow | undefined = rows.at(0);
		if (updated !== undefined) {
			return this.ports.toDomain(updated);
		}
		const current = await this.delegate.findFirst({ where: this.ports.buildLiveWhere(id) });
		if (current === null) {
			throw new ResourceNotFoundError(id);
		}
		throw new ConcurrentModificationError(id);
	}

	/** Deletes one row: soft (with the cascade, in one transaction) or hard, per the repository options. */
	public async delete(id: string): Promise<void> {
		if (!this.options.softDelete) {
			await this.hardDelete(id);
			return;
		}
		if (this.ports.cascadeSoftDelete === undefined) {
			await this.softDelete(id);
			return;
		}
		await this.prisma.$transaction(async (transaction: Prisma.TransactionClient): Promise<void> => {
			await this.deleteWithin(transaction, id);
		});
	}

	public async hardDelete(id: string): Promise<void> {
		if (this.options.softDelete) {
			throw new RepositoryMisconfiguredError("hardDelete is disabled when softDelete is enabled");
		}
		await this.delegate.delete({
			where: this.ports.buildUniqueWhere(id),
		});
	}

	/** Stamps the live row with `id` as deleted in one conditional statement; 404 when it is missing or already deleted. */
	public async softDelete(id: string): Promise<void> {
		if (!this.options.softDelete) {
			throw new RepositoryMisconfiguredError("softDelete is disabled for this repository");
		}
		await this.softDeleteRow(this.delegate, id);
	}

	public async restore(id: string): Promise<TEntity> {
		if (!this.options.softDelete) {
			throw new RepositoryMisconfiguredError("softDelete is disabled for this repository");
		}
		if (this.ports.cascadeSoftDelete !== undefined) {
			const cascade = this.ports.cascadeSoftDelete;
			const buildFindByIdIncludingDeletedWhere = this.ports.buildFindByIdIncludingDeletedWhere;
			const readDeletedAt = this.ports.readDeletedAt;
			if (buildFindByIdIncludingDeletedWhere === undefined || readDeletedAt === undefined) {
				throw new RepositoryMisconfiguredError("cascadeSoftDelete requires buildFindByIdIncludingDeletedWhere and readDeletedAt ports");
			}
			const existing = await this.delegate.findFirst({ where: buildFindByIdIncludingDeletedWhere(id) });
			if (existing === null) {
				throw new ResourceNotFoundError(id);
			}
			const deletedAt = readDeletedAt(existing);
			if (deletedAt === null) {
				return this.ports.toDomain(existing);
			}
			await this.prisma.$transaction(async (transaction) => {
				await cascade.restoreChildren({ parentId: id, deletedAt, transaction });
				await cascade.restoreParent({ parentId: id, transaction });
			});
			const restored = await this.delegate.findFirst({ where: this.ports.buildFindByIdWhere(id) });
			if (restored === null) {
				throw new ResourceNotFoundError(id);
			}
			return this.ports.toDomain(restored);
		}
		const row = await this.delegate.update({
			where: this.ports.buildUniqueWhere(id),
			data: this.ports.stampRestore(),
		});
		return this.ports.toDomain(row);
	}

	/** Deletes one row inside the caller's transaction, with the configured soft-delete cascade. */
	private async deleteWithin(transaction: Prisma.TransactionClient, id: string): Promise<void> {
		if (!this.options.softDelete) {
			await this.delegateOf(transaction).delete({ where: this.ports.buildUniqueWhere(id) });
			return;
		}
		const cascade = this.ports.cascadeSoftDelete;
		if (cascade === undefined) {
			await this.softDeleteRow(this.delegateOf(transaction), id);
			return;
		}
		// Parent first: a parent another request already deleted stops here
		// (404, rollback) before any child row is touched. One `deletedAt` is
		// shared with the children so `restore` can find exactly this cascade.
		const deletedAt: number = nowEpochMs();
		const deletedParents: number = await cascade.softDeleteParent({ parentId: id, deletedAt, transaction });
		if (deletedParents === 0) {
			throw new ResourceNotFoundError(id);
		}
		await cascade.softDeleteChildren({ parentId: id, deletedAt, transaction });
	}

	private async softDeleteRow(delegate: PrismaModelDelegate<TRow, TWhere, TOrderBy, TCreateInput, TUpdateInput, TUpdateWhere>, id: string): Promise<void> {
		const result = await delegate.updateMany({
			where: this.ports.buildLiveWhere(id),
			data: this.ports.stampSoftDelete(),
		});
		if (result.count === 0) {
			throw new ResourceNotFoundError(id);
		}
	}
}
