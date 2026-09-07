import { z } from "zod";

import type { PaginationInput } from "@workspace/shared";

import type { CascadeSoftDeletePorts } from "./cascade-soft-delete";

/** Repositories that expose create/update only through dedicated methods use this input for BaseRepository ports. */
export const EmptyMutationInputSchema = z.object({}).strict();
export type EmptyMutationInput = z.output<typeof EmptyMutationInputSchema>;

/** Repository list result before the service applies pagination metadata. */
export interface RepositoryListResult<TEntity> {
	readonly items: readonly TEntity[];
	readonly total: number;
}

/** Lifecycle flags shared by generated and manual repositories. */
export interface BaseRepositoryOptions {
	readonly softDelete: boolean;
	readonly concurrency: boolean;
}

/** Entity-specific mapping and query hooks for {@link BaseRepository}. */
export interface RepositoryPorts<TEntity, TCreate, TUpdate, TQuery extends PaginationInput, TRow, TWhere, TOrderBy, TCreateInput, TUpdateInput, TUpdateWhere> {
	readonly toDomain: (row: TRow) => TEntity;
	readonly toCreateInput: (input: TCreate) => TCreateInput;
	readonly toUpdateInput: (input: TUpdate) => TUpdateInput;
	readonly buildListWhere: (query: TQuery) => TWhere;
	readonly buildListOrderBy: (query: TQuery) => TOrderBy;
	readonly buildFindByIdWhere: (id: string) => TWhere;
	/** Finds a row by id regardless of soft-delete state — required when `cascadeSoftDelete` is set. */
	readonly buildFindByIdIncludingDeletedWhere?: (id: string) => TWhere;
	/** Reads `deletedAt` from a persistence row — required when `cascadeSoftDelete` is set. */
	readonly readDeletedAt?: (row: TRow) => number | null;
	readonly buildUpdateWhere: (id: string, expectedVersion?: number) => TUpdateWhere;
	readonly stampUpdate: (data: TUpdateInput) => TUpdateInput;
	readonly stampSoftDelete: () => TUpdateInput;
	readonly stampRestore: () => TUpdateInput;
	readonly cascadeSoftDelete?: CascadeSoftDeletePorts;
}

/** Repository surface consumed by {@link BaseService}. */
export interface RepositoryInstance<TEntity, TCreate, TUpdate, TQuery extends PaginationInput> {
	readonly list: (query: TQuery) => Promise<RepositoryListResult<TEntity>>;
	readonly findById: (id: string) => Promise<TEntity | null>;
	readonly create: (input: TCreate) => Promise<TEntity>;
	readonly update: (id: string, input: TUpdate, expectedVersion?: number) => Promise<TEntity>;
	readonly delete: (id: string) => Promise<void>;
	readonly createMany: (inputs: readonly TCreate[]) => Promise<readonly TEntity[]>;
	readonly deleteMany: (ids: readonly string[]) => Promise<number>;
	readonly softDelete: (id: string) => Promise<void>;
	readonly restore: (id: string) => Promise<TEntity>;
}
export interface PrismaModelDelegate<TRow, TWhere, TOrderBy, TCreateInput, TUpdateInput, TUpdateWhere, TDeleteWhere = TUpdateWhere> {
	findMany(args: { where: TWhere; skip: number; take: number; orderBy: TOrderBy }): Promise<TRow[]>;
	findFirst(args: { where: TWhere }): Promise<TRow | null>;
	count(args: { where: TWhere }): Promise<number>;
	create(args: { data: TCreateInput }): Promise<TRow>;
	update(args: { where: TUpdateWhere; data: TUpdateInput }): Promise<TRow>;
	delete(args: { where: TDeleteWhere }): Promise<TRow>;
}
