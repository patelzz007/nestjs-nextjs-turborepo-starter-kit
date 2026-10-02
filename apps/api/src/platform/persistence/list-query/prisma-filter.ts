// ============================================
// platform/persistence/list-query/prisma-filter.ts - filter AST → Prisma filter objects
// ============================================
// The validated list query carries, per whitelisted field, an object of
// operator → typed value (`{ gte: 10, lte: 99 }`). These helpers translate one
// field's operators into the matching Prisma scalar filter. They never see a
// column name: each repository maps the result onto its column explicitly,
//
//   ...fieldWhere(toPrismaComparableFilter(filter?.price), (price) => ({ price })),
//
// so a client can only ever reach the columns a repository chose to expose.
//
// Non-nullable vs nullable columns: the plain helpers reject `isNull` at the
// type level (a non-nullable column can never be NULL, and Prisma's filter
// type for it has no `null`). Use the `Nullable` variants for nullable columns.

import type { BooleanFilterValues, ComparableFilterValues, EqualityFilterValues, StringFilterValues } from "@workspace/shared";

/** `isNull` is only meaningful (and only type-correct in Prisma) on nullable columns. */
interface NoNullOperator {
	readonly isNull?: undefined;
}

/** Prisma's equality/membership filter subset (String / enum / Int / Decimal / BigInt filters all accept it). */
export interface PrismaEqualityFilter<T> {
	equals?: T;
	not?: T;
	in?: T[];
	notIn?: T[];
}

/** Equality plus range comparisons (Int / Float / Decimal / BigInt / DateTime filters). */
export interface PrismaComparableFilter<T> extends PrismaEqualityFilter<T> {
	gt?: T;
	gte?: T;
	lt?: T;
	lte?: T;
}

/** A comparable filter on a nullable column — `isNull` maps to `equals: null` / `not: null`. */
export interface PrismaNullableComparableFilter<T> extends Omit<PrismaComparableFilter<T>, "equals" | "not"> {
	equals?: T | null;
	not?: T | null;
}

/** An equality filter on a nullable column. */
export interface PrismaNullableEqualityFilter<T> extends Omit<PrismaEqualityFilter<T>, "equals" | "not"> {
	equals?: T | null;
	not?: T | null;
}

/** String filters are case-insensitive for every operator (`mode: "insensitive"`, PostgreSQL). */
export interface PrismaStringFilter extends PrismaEqualityFilter<string> {
	contains?: string;
	startsWith?: string;
	mode: "insensitive";
}

export interface PrismaNullableStringFilter extends Omit<PrismaStringFilter, "equals" | "not"> {
	equals?: string | null;
	not?: string | null;
}

export interface PrismaBooleanFilter {
	equals?: boolean;
}

export interface PrismaNullableBooleanFilter {
	equals?: boolean | null;
	not?: boolean | null;
}

function equalityParts<T>(values: EqualityFilterValues<T>): PrismaEqualityFilter<T> {
	return {
		...(values.eq !== undefined ? { equals: values.eq } : {}),
		...(values.ne !== undefined ? { not: values.ne } : {}),
		...(values.in !== undefined ? { in: [...values.in] } : {}),
		...(values.nin !== undefined ? { notIn: [...values.nin] } : {}),
	};
}

function comparableParts<T>(values: ComparableFilterValues<T>): PrismaComparableFilter<T> {
	return {
		...equalityParts(values),
		...(values.gt !== undefined ? { gt: values.gt } : {}),
		...(values.gte !== undefined ? { gte: values.gte } : {}),
		...(values.lt !== undefined ? { lt: values.lt } : {}),
		...(values.lte !== undefined ? { lte: values.lte } : {}),
	};
}

/** `isNull: true` → `equals: null`; `isNull: false` → `not: null` (wins over `eq` / `ne` on the same field). */
function nullParts(isNull: boolean | undefined): { equals?: null; not?: null } {
	if (isNull === true) return { equals: null };
	if (isNull === false) return { not: null };
	return {};
}

function hasOperators(filter: object): boolean {
	return Object.keys(filter).length > 0;
}

/** Number / epoch-ms filter on a NON-nullable column. `undefined` when the field was not filtered. */
export function toPrismaComparableFilter<T>(values: (ComparableFilterValues<T> & NoNullOperator) | undefined): PrismaComparableFilter<T> | undefined {
	if (values === undefined) return undefined;
	const filter: PrismaComparableFilter<T> = comparableParts(values);
	return hasOperators(filter) ? filter : undefined;
}

/** Number / epoch-ms filter on a nullable column. */
export function toPrismaNullableComparableFilter<T>(values: ComparableFilterValues<T> | undefined): PrismaNullableComparableFilter<T> | undefined {
	if (values === undefined) return undefined;
	const filter: PrismaNullableComparableFilter<T> = { ...comparableParts(values), ...nullParts(values.isNull) };
	return hasOperators(filter) ? filter : undefined;
}

/** UUID / enum filter on a NON-nullable column. */
export function toPrismaEqualityFilter<T>(values: (EqualityFilterValues<T> & NoNullOperator) | undefined): PrismaEqualityFilter<T> | undefined {
	if (values === undefined) return undefined;
	const filter: PrismaEqualityFilter<T> = equalityParts(values);
	return hasOperators(filter) ? filter : undefined;
}

/** UUID / enum filter on a nullable column. */
export function toPrismaNullableEqualityFilter<T>(values: EqualityFilterValues<T> | undefined): PrismaNullableEqualityFilter<T> | undefined {
	if (values === undefined) return undefined;
	const filter: PrismaNullableEqualityFilter<T> = { ...equalityParts(values), ...nullParts(values.isNull) };
	return hasOperators(filter) ? filter : undefined;
}

function textParts(values: StringFilterValues): { contains?: string; startsWith?: string } {
	return {
		...(values.contains !== undefined ? { contains: values.contains } : {}),
		...(values.startsWith !== undefined ? { startsWith: values.startsWith } : {}),
	};
}

/** Case-insensitive string filter on a NON-nullable column. */
export function toPrismaStringFilter(values: (StringFilterValues & NoNullOperator) | undefined): PrismaStringFilter | undefined {
	if (values === undefined) return undefined;
	const operators: PrismaEqualityFilter<string> & { contains?: string; startsWith?: string } = { ...equalityParts(values), ...textParts(values) };
	return hasOperators(operators) ? { ...operators, mode: "insensitive" } : undefined;
}

/** Case-insensitive string filter on a nullable column. */
export function toPrismaNullableStringFilter(values: StringFilterValues | undefined): PrismaNullableStringFilter | undefined {
	if (values === undefined) return undefined;
	const operators: PrismaNullableEqualityFilter<string> & { contains?: string; startsWith?: string } = {
		...equalityParts(values),
		...textParts(values),
		...nullParts(values.isNull),
	};
	return hasOperators(operators) ? { ...operators, mode: "insensitive" } : undefined;
}

/** Boolean filter on a NON-nullable column. */
export function toPrismaBooleanFilter(values: (BooleanFilterValues & NoNullOperator) | undefined): PrismaBooleanFilter | undefined {
	if (values?.eq === undefined) return undefined;
	return { equals: values.eq };
}

/** Boolean filter on a nullable column. */
export function toPrismaNullableBooleanFilter(values: BooleanFilterValues | undefined): PrismaNullableBooleanFilter | undefined {
	if (values === undefined) return undefined;
	const filter: PrismaNullableBooleanFilter = { ...(values.eq !== undefined ? { equals: values.eq } : {}), ...nullParts(values.isNull) };
	return hasOperators(filter) ? filter : undefined;
}

/**
 * Maps one translated field filter onto its column: `[]` when the field was
 * not filtered, `[where]` otherwise — spread the result into an `AND` list.
 */
export function fieldWhere<TFilter, TWhere>(filter: TFilter | undefined, toWhere: (filter: TFilter) => TWhere): TWhere[] {
	return filter === undefined ? [] : [toWhere(filter)];
}
