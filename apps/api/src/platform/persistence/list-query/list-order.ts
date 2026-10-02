// ============================================
// platform/persistence/list-query/list-order.ts - validated sort terms → Prisma orderBy
// ============================================
// A resource maps every whitelisted API sort field to its column explicitly
// (`SortColumns`). The client's field name is never used as a column name.
// A unique tie-breaker (normally `id`) is always appended so offset pages are
// deterministic even when the sort column has duplicates.

import type { ResolvedSort, SortDirection, SortTerm } from "@workspace/shared";

/** Explicit API sort field → Prisma `orderBy` fragment mapping for one resource. */
export type SortColumns<TField extends string, TOrderBy> = Readonly<Record<TField, (direction: SortDirection) => TOrderBy>>;

export interface ListOrderOptions<TField extends string, TOrderBy> {
	readonly columns: SortColumns<TField, TOrderBy>;
	/** Unique column appended last so equal sort values still have one stable order. */
	readonly tieBreaker: (direction: SortDirection) => TOrderBy;
	/** API field that already IS the unique column (e.g. a sortable `id`) — no tie-breaker is added after it. */
	readonly uniqueField?: TField;
}

/** The resolved Prisma order for one list request. */
export interface ListOrder<TOrderBy> {
	readonly orderBy: TOrderBy[];
	/** True when this is the resource's default order — the only order keyset cursors follow. */
	readonly isDefault: boolean;
}

/**
 * Builds the Prisma `orderBy` array for a resolved sort. The tie-breaker takes
 * the direction of the last sort term, which keeps the default order identical
 * to the order the resource's keyset cursor encodes (`createdAt desc, id desc`).
 */
export function buildListOrder<TField extends string, TOrderBy>(sort: ResolvedSort<TField>, options: ListOrderOptions<TField, TOrderBy>): ListOrder<TOrderBy> {
	const orderBy: TOrderBy[] = sort.terms.map((term: SortTerm<TField>): TOrderBy => options.columns[term.field](term.direction));
	const includesUniqueField: boolean = sort.terms.some((term: SortTerm<TField>): boolean => term.field === options.uniqueField);
	const lastDirection: SortDirection = sort.terms.at(-1)?.direction ?? "asc";
	return {
		orderBy: includesUniqueField ? orderBy : [...orderBy, options.tieBreaker(lastDirection)],
		isDefault: sort.isDefault,
	};
}
