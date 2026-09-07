import type { PaginationInput } from "@workspace/shared";
import { nowEpochMs } from "@workspace/shared";

import { PrismaService } from "../../prisma/prisma.service";

import type { BaseRepositoryOptions, PrismaModelDelegate, RepositoryListResult, RepositoryPorts } from "./types";

export abstract class BaseRepository<TEntity, TCreate, TUpdate, TQuery extends PaginationInput, TRow, TWhere, TOrderBy, TCreateInput, TUpdateInput, TUpdateWhere> {
	public constructor(
		protected readonly prisma: PrismaService,
		protected readonly ports: RepositoryPorts<TEntity, TCreate, TUpdate, TQuery, TRow, TWhere, TOrderBy, TCreateInput, TUpdateInput, TUpdateWhere>,
		protected readonly delegate: PrismaModelDelegate<TRow, TWhere, TOrderBy, TCreateInput, TUpdateInput, TUpdateWhere>,
		protected readonly options: BaseRepositoryOptions,
	) {}

	public async create(input: TCreate): Promise<TEntity> {
		const row = await this.delegate.create({ data: this.ports.toCreateInput(input) });
		return this.ports.toDomain(row);
	}

	public async createMany(inputs: readonly TCreate[]): Promise<readonly TEntity[]> {
		const created: TEntity[] = [];
		for (const input of inputs) {
			created.push(await this.create(input));
		}
		return created;
	}

	public async deleteMany(ids: readonly string[]): Promise<number> {
		for (const id of ids) {
			await this.delete(id);
		}
		return ids.length;
	}

	public async findById(id: string): Promise<TEntity | null> {
		const row = await this.delegate.findFirst({ where: this.ports.buildFindByIdWhere(id) });
		return row === null ? null : this.ports.toDomain(row);
	}

	public async list(query: TQuery): Promise<RepositoryListResult<TEntity>> {
		const where = this.ports.buildListWhere(query);
		const orderBy = this.ports.buildListOrderBy(query);
		const [rows, total]: [TRow[], number] = await Promise.all([
			this.delegate.findMany({
				where,
				skip: (query.page - 1) * query.limit,
				take: query.limit,
				orderBy,
			}),
			this.delegate.count({ where }),
		]);
		return { items: rows.map((row) => this.ports.toDomain(row)), total };
	}

	public async update(id: string, input: TUpdate, expectedVersion?: number): Promise<TEntity> {
		const data = this.ports.stampUpdate(this.ports.toUpdateInput(input));
		const row = await this.delegate.update({
			where: this.ports.buildUpdateWhere(id, expectedVersion),
			data,
		});
		return this.ports.toDomain(row);
	}

	public async delete(id: string): Promise<void> {
		if (this.options.softDelete) {
			if (this.ports.cascadeSoftDelete !== undefined) {
				const cascade = this.ports.cascadeSoftDelete;
				await this.prisma.$transaction(async (transaction) => {
					const deletedAt = nowEpochMs();
					await cascade.softDeleteChildren({ parentId: id, deletedAt, transaction });
					await cascade.softDeleteParent({ parentId: id, deletedAt, transaction });
				});
				return;
			}
			await this.softDelete(id);
			return;
		}
		await this.hardDelete(id);
	}

	public async hardDelete(id: string): Promise<void> {
		if (this.options.softDelete) {
			throw new Error("hardDelete is disabled when softDelete is enabled");
		}
		await this.delegate.delete({
			where: this.ports.buildUpdateWhere(id),
		});
	}

	public async softDelete(id: string): Promise<void> {
		if (!this.options.softDelete) {
			throw new Error("softDelete is disabled for this repository");
		}
		await this.delegate.update({
			where: this.ports.buildUpdateWhere(id),
			data: this.ports.stampSoftDelete(),
		});
	}

	public async restore(id: string): Promise<TEntity> {
		if (!this.options.softDelete) {
			throw new Error("softDelete is disabled for this repository");
		}
		if (this.ports.cascadeSoftDelete !== undefined) {
			const cascade = this.ports.cascadeSoftDelete;
			const buildFindByIdIncludingDeletedWhere = this.ports.buildFindByIdIncludingDeletedWhere;
			const readDeletedAt = this.ports.readDeletedAt;
			if (buildFindByIdIncludingDeletedWhere === undefined || readDeletedAt === undefined) {
				throw new Error("cascadeSoftDelete requires buildFindByIdIncludingDeletedWhere and readDeletedAt ports");
			}
			const existing = await this.delegate.findFirst({ where: buildFindByIdIncludingDeletedWhere(id) });
			if (existing === null) {
				throw new Error("Resource not found");
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
				throw new Error("Resource not found after restore");
			}
			return this.ports.toDomain(restored);
		}
		const row = await this.delegate.update({
			where: this.ports.buildUpdateWhere(id),
			data: this.ports.stampRestore(),
		});
		return this.ports.toDomain(row);
	}
}
