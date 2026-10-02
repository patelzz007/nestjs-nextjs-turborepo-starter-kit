import { z } from "zod";

import type { PaginationInput } from "@workspace/shared";

import type { CascadeSoftDeletePorts } from "./cascade-soft-delete";
import type { ListKeyset } from "./list-query/keyset-cursor";
import type { ListOrder } from "./list-query/list-order";

/** Repositories that expose create/update only through dedicated methods use this input for BaseRepository ports. */
export const EmptyMutationInputSchema = z.object({}).strict();
export type EmptyMutationInput = z.output<typeof EmptyMutationInputSchema>;

/** Repository list result before the service applies pagination metadata. */
export interface RepositoryListResult<TEntity> {
	readonly items: readonly TEntity[];
	readonly total: number;
	readonly page: number;
	readonly totalPages: number;
	readonly nextCursor: string | null;
	readonly hasNext: boolean;
	readonly hasPrevious: boolean;
}

/** Lifecycle flags shared by resource repositories. */
export interface BaseRepositoryOptions {
	readonly softDelete: boolean;
	readonly concurrency: boolean;
}

/** Entity-specific mapping and query hooks for {@link BaseRepository}. */
export interface RepositoryPorts<TEntity, TCreate, TUpdate, TQuery extends PaginationInput, TRow, TWhere, TOrderBy, TCreateInput, TUpdateInput, TUpdateWhere> {
	readonly toDomain: (row: TRow) => TEntity;
	readonly toCreateInput: (input: TCreate) => TCreateInput;
	readonly toUpdateInput: (input: TUpdate) => TUpdateInput;
	/** Complete list `where`: soft delete + scope + the query's filter AST + search, mapped column by column. */
	readonly buildListWhere: (query: TQuery) => TWhere;
	/** The query's sort (or the default) mapped to explicit columns, with the unique tie-breaker appended. */
	readonly buildListOrder: (query: TQuery) => ListOrder<TOrderBy>;
	/** Keyset for cursor pagination in the default order; omit to support offset pages only. */
	readonly listKeyset?: ListKeyset<TRow, TWhere>;
	/** `{ AND: [left, right] }` — combines the list `where` with the keyset condition. */
	readonly andWhere: (left: TWhere, right: TWhere) => TWhere;
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
	findMany(args: { where: TWhere; take: number; skip?: number; orderBy: TOrderBy[] }): Promise<TRow[]>;
	findFirst(args: { where: TWhere }): Promise<TRow | null>;
	count(args: { where: TWhere }): Promise<number>;
	create(args: { data: TCreateInput }): Promise<TRow>;
	update(args: { where: TUpdateWhere; data: TUpdateInput }): Promise<TRow>;
	delete(args: { where: TDeleteWhere }): Promise<TRow>;
}
