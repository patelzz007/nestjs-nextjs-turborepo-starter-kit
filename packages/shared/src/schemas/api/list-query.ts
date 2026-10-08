// ============================================
// schemas/api/list-query.ts - the ONE list-query convention (pagination, sort, filter, search)
// ============================================
// Every paginated list endpoint declares its query with `defineListQuery()`.
// The result is ONE zod schema used by the API (validation + Swagger), the
// typed client (request validation + query keys) and the frontends — so the
// whitelist of sortable fields, filterable fields and operators lives in
// exactly one place (platform spec §16, §18; ADR 021; docs/technical/api/list-queries.md).
//
// Wire grammar (query string):
//
//   ?page=2&limit=25                       offset pagination (1-indexed page)
//   ?cursor=<opaque>&limit=25              keyset pagination (default order only)
//   ?sort=-createdAt,name                  comma list, `-` = descending, whitelisted fields
//   ?search=john                           free-text search over the resource's search columns
//   ?filter[status]=ACTIVE                 shorthand for filter[status][eq]=ACTIVE
//   ?filter[status][in]=ACTIVE,LOCKED      operator form; `in` / `nin` take comma lists
//   ?filter[price][gte]=10&filter[price][lte]=99
//
// The API turns the flat `filter[field][op]` keys into a nested object
// (`nestBracketQueryParams`) before this schema runs, so the validated value is
// a normalized, typed FILTER AST: `{ field: { operator: typedValue } }` — only
// whitelisted fields, only whitelisted operators per field, values coerced to
// their real type, shorthand expanded, lists split. Repositories translate that
// AST to Prisma through an explicit per-resource field → column mapping; no raw
// client string ever reaches a `where` or `orderBy`.

import { z } from "zod";

import { isArrayValue, isBooleanPrimitive, isJsonPrimitive, isNumberPrimitive, isStringPrimitive } from "../../lib/runtime-narrowing";

import type { DataValue } from "./common";

// ── Limits (server-enforced — the schema IS the enforcement) ───────────────

/** Page size used when a resource does not choose its own default. */
export const LIST_DEFAULT_LIMIT = 20;
/** Hard upper bound for `limit` on every list endpoint (matches `ApiPaginatedMetaSchema`). */
export const LIST_MAX_LIMIT = 100;
/** Deepest offset page a client may request — deep OFFSET scans are a performance trap (rules/19). */
export const LIST_MAX_PAGE = 10_000;
/** Maximum number of comma-separated sort keys. */
export const LIST_MAX_SORT_TERMS = 3;
/** Maximum number of values in one `in` / `nin` list. */
export const LIST_MAX_FILTER_VALUES = 100;
/** Maximum length of one textual filter value. */
export const LIST_MAX_FILTER_TEXT_LENGTH = 200;
/** Maximum length of the free-text `search` parameter. */
export const LIST_MAX_SEARCH_LENGTH = 200;
/** Maximum length of the opaque `cursor` parameter. */
export const LIST_MAX_CURSOR_LENGTH = 512;
/** Maximum length of the raw `sort` parameter. */
export const LIST_MAX_SORT_LENGTH = 200;
/** Maximum number of `filter[...]` query-string keys one request may carry. */
export const LIST_MAX_FILTER_PARAMS = 50;

/** Prefix that marks a descending sort key (`-createdAt`). */
export const SORT_DESCENDING_PREFIX = "-";
/** Separator for sort keys and `in` / `nin` value lists. */
export const LIST_VALUE_SEPARATOR = ",";

// ── Operators ───────────────────────────────────────────────────────────────

/** Single-value comparisons. */
export type ComparisonOperator = "eq" | "ne" | "gt" | "gte" | "lt" | "lte";
/** Set membership — the value is a comma-separated list on the wire, an array once parsed. */
export type SetOperator = "in" | "nin";
/** Case-insensitive text matching (string fields only). */
export type TextOperator = "contains" | "startsWith";
/** `isNull=true` matches NULL, `isNull=false` matches NOT NULL (nullable fields only). */
export type NullOperator = "isNull";
export type ListFilterOperator = ComparisonOperator | SetOperator | TextOperator | NullOperator;

/** Every operator name the grammar knows — used to validate `filter[field][op]` keys. */
export const LIST_FILTER_OPERATORS: readonly ListFilterOperator[] = ["eq", "ne", "gt", "gte", "lt", "lte", "in", "nin", "contains", "startsWith", "isNull"];

/**
 * `filter[field]` (shorthand for `eq`) or `filter[field][op]` — the query key
 * of one list filter. The single definition of the key grammar: the API reads
 * it, frontends' URL state writes it, and the API builds deep links with it.
 */
export function listFilterKey(field: string, operator?: ListFilterOperator): string {
	return operator === undefined || operator === "eq" ? `filter[${field}]` : `filter[${field}][${operator}]`;
}

// ── Value coercion (query strings arrive as strings) ───────────────────────

/** A raw query value before validation: a query-string string, a repeated key, or an already-typed client value. */
type RawQueryValue = DataValue | undefined;

const NUMERIC_PATTERN = /^-?\d+(\.\d+)?$/;

function toNumberWhenNumeric(value: RawQueryValue): RawQueryValue {
	if (isStringPrimitive(value) && NUMERIC_PATTERN.test(value.trim())) {
		return Number(value.trim());
	}
	return value;
}

function toBooleanWhenLiteral(value: RawQueryValue): RawQueryValue {
	if (value === "true") return true;
	if (value === "false") return false;
	return value;
}

/** `"a,b"` → `["a", "b"]`; repeated keys (`["a,b", "c"]`) are flattened; anything else is left for the schema to reject. */
function toValueList(value: RawQueryValue): RawQueryValue {
	if (isStringPrimitive(value)) {
		return splitValueList(value);
	}
	if (isArrayValue(value)) {
		return value.flatMap((item: DataValue): DataValue[] => (isStringPrimitive(item) ? splitValueList(item) : [item]));
	}
	return value;
}

function splitValueList(value: string): string[] {
	return value
		.split(LIST_VALUE_SEPARATOR)
		.map((item: string): string => item.trim())
		.filter((item: string): boolean => item.length > 0);
}

/** `filter[status]=ACTIVE` (a bare scalar) is shorthand for `filter[status][eq]=ACTIVE`. */
function toOperatorObject(value: RawQueryValue): RawQueryValue {
	if (isJsonPrimitive(value) && value !== null) {
		return { eq: value };
	}
	return value;
}

/** A finite number; numeric strings are coerced, an empty string is rejected (never silently `0`). */
export const FilterNumberValueSchema = z.preprocess(toNumberWhenNumeric, z.number());
/** A whole, non-negative epoch-millisecond timestamp. */
export const FilterEpochMsValueSchema = z.preprocess(toNumberWhenNumeric, z.number().int().nonnegative());
/** `true` / `false` (strings are accepted on the wire). */
export const FilterBooleanValueSchema = z.preprocess(toBooleanWhenLiteral, z.boolean());
/** A bounded, trimmed, non-empty string. */
export const FilterTextValueSchema = z.string().trim().min(1).max(LIST_MAX_FILTER_TEXT_LENGTH);
/** A UUID. */
export const FilterUuidValueSchema = z.uuid();

/** Schema of an `in` / `nin` list whose items are validated by `item`. */
export type FilterValueListSchema<T extends z.ZodType> = z.ZodPreprocess<z.ZodArray<T>, RawQueryValue>;

function valueList<T extends z.ZodType>(item: T): FilterValueListSchema<T> {
	return z.preprocess(toValueList, z.array(item).min(1).max(LIST_MAX_FILTER_VALUES));
}

// ── Operator shapes per field type ─────────────────────────────────────────
// Each field type has a fixed operator vocabulary; a field picks the subset it
// allows (`listFilter.number({ gte: true, lte: true })`). The picked shape is a
// real zod shape, so the parsed type only has the allowed operators and the
// typed client rejects a disallowed operator at compile time.

type ComparableOperatorShape<T extends z.ZodType> = Record<ComparisonOperator, z.ZodOptional<T>> &
	Record<SetOperator, z.ZodOptional<FilterValueListSchema<T>>> &
	Record<NullOperator, z.ZodOptional<typeof FilterBooleanValueSchema>>;

type EqualityOperatorShape<T extends z.ZodType> = Record<"eq" | "ne", z.ZodOptional<T>> &
	Record<SetOperator, z.ZodOptional<FilterValueListSchema<T>>> &
	Record<NullOperator, z.ZodOptional<typeof FilterBooleanValueSchema>>;

type StringOperatorShape = EqualityOperatorShape<typeof FilterTextValueSchema> & Record<TextOperator, z.ZodOptional<typeof FilterTextValueSchema>>;

type BooleanOperatorShape = Record<"eq" | NullOperator, z.ZodOptional<typeof FilterBooleanValueSchema>>;

function comparableShape<T extends z.ZodType>(value: T): ComparableOperatorShape<T> {
	return {
		eq: value.optional(),
		ne: value.optional(),
		gt: value.optional(),
		gte: value.optional(),
		lt: value.optional(),
		lte: value.optional(),
		in: valueList(value).optional(),
		nin: valueList(value).optional(),
		isNull: FilterBooleanValueSchema.optional(),
	};
}

function equalityShape<T extends z.ZodType>(value: T): EqualityOperatorShape<T> {
	return {
		eq: value.optional(),
		ne: value.optional(),
		in: valueList(value).optional(),
		nin: valueList(value).optional(),
		isNull: FilterBooleanValueSchema.optional(),
	};
}

function stringShape(): StringOperatorShape {
	return {
		...equalityShape(FilterTextValueSchema),
		contains: FilterTextValueSchema.optional(),
		startsWith: FilterTextValueSchema.optional(),
	};
}

function booleanShape(): BooleanOperatorShape {
	return { eq: FilterBooleanValueSchema.optional(), isNull: FilterBooleanValueSchema.optional() };
}

/** The shape left after picking `M`'s operators out of `S`. */
type PickedShape<S extends z.ZodRawShape, M> = z.util.Flatten<Pick<z.util.Writeable<S>, Extract<keyof z.util.Writeable<S>, keyof M>>>;

/** One filterable field: an optional, strict operator object (scalar shorthand → `eq`). */
export type ListFilterFieldSchema<S extends z.ZodRawShape> = z.ZodOptional<z.ZodPreprocess<z.ZodObject<S, z.core.$strict>, RawQueryValue>>;

function filterField<S extends z.ZodRawShape, M extends z.util.Mask<keyof S>>(
	shape: S,
	operators: M & Record<Exclude<keyof M, keyof S>, never>,
): ListFilterFieldSchema<PickedShape<S, M>> {
	const picked = z.strictObject(shape).pick(operators);
	const allowed: string = Object.keys(picked.shape).join(", ");
	const operatorObject = z.strictObject(picked.shape, {
		error: (issue): string | undefined =>
			issue.code === "unrecognized_keys" ? `Operator(s) not allowed for this filter: ${issue.keys.join(", ")}. Allowed: ${allowed}` : undefined,
	});
	return z.preprocess(toOperatorObject, operatorObject).optional();
}

/**
 * Field-filter builders — one per field type. Pass the operators the field
 * allows; anything else is rejected with a 400 that lists the allowed ones.
 *
 *   status: listFilter.enumeration(UserStatusSchema, { eq: true, in: true }),
 *   price:  listFilter.number({ gte: true, lte: true }),
 *   name:   listFilter.string({ eq: true, contains: true }),
 */
export const listFilter = {
	/** Free text: eq, ne, in, nin, contains, startsWith, isNull. */
	string<M extends z.util.Mask<keyof StringOperatorShape>>(
		operators: M & Record<Exclude<keyof M, keyof StringOperatorShape>, never>,
	): ListFilterFieldSchema<PickedShape<StringOperatorShape, M>> {
		return filterField(stringShape(), operators);
	},
	/** Number: eq, ne, gt, gte, lt, lte, in, nin, isNull. */
	number<M extends z.util.Mask<keyof ComparableOperatorShape<typeof FilterNumberValueSchema>>>(
		operators: M & Record<Exclude<keyof M, keyof ComparableOperatorShape<typeof FilterNumberValueSchema>>, never>,
	): ListFilterFieldSchema<PickedShape<ComparableOperatorShape<typeof FilterNumberValueSchema>, M>> {
		return filterField(comparableShape(FilterNumberValueSchema), operators);
	},
	/** Epoch-millisecond timestamp: eq, ne, gt, gte, lt, lte, in, nin, isNull. */
	epochMs<M extends z.util.Mask<keyof ComparableOperatorShape<typeof FilterEpochMsValueSchema>>>(
		operators: M & Record<Exclude<keyof M, keyof ComparableOperatorShape<typeof FilterEpochMsValueSchema>>, never>,
	): ListFilterFieldSchema<PickedShape<ComparableOperatorShape<typeof FilterEpochMsValueSchema>, M>> {
		return filterField(comparableShape(FilterEpochMsValueSchema), operators);
	},
	/** Boolean: eq, isNull. */
	boolean<M extends z.util.Mask<keyof BooleanOperatorShape>>(
		operators: M & Record<Exclude<keyof M, keyof BooleanOperatorShape>, never>,
	): ListFilterFieldSchema<PickedShape<BooleanOperatorShape, M>> {
		return filterField(booleanShape(), operators);
	},
	/** UUID: eq, ne, in, nin, isNull. */
	uuid<M extends z.util.Mask<keyof EqualityOperatorShape<typeof FilterUuidValueSchema>>>(
		operators: M & Record<Exclude<keyof M, keyof EqualityOperatorShape<typeof FilterUuidValueSchema>>, never>,
	): ListFilterFieldSchema<PickedShape<EqualityOperatorShape<typeof FilterUuidValueSchema>, M>> {
		return filterField(equalityShape(FilterUuidValueSchema), operators);
	},
	/** One of a zod enum's values: eq, ne, in, nin, isNull. */
	enumeration<E extends z.ZodEnum, M extends z.util.Mask<keyof EqualityOperatorShape<E>>>(
		values: E,
		operators: M & Record<Exclude<keyof M, keyof EqualityOperatorShape<E>>, never>,
	): ListFilterFieldSchema<PickedShape<EqualityOperatorShape<E>, M>> {
		return filterField(equalityShape(values), operators);
	},
};

// ── Parsed operator values (what translators read) ─────────────────────────
// The validated filter for one field is an object of operator → typed value.
// These structural types are what the API's Prisma translators accept; any
// picked subset produced by `listFilter.*` is assignable to them.

/** Parsed comparable filter (number / epoch ms): any subset of these operators. */
export interface ComparableFilterValues<T> {
	readonly eq?: T | undefined;
	readonly ne?: T | undefined;
	readonly gt?: T | undefined;
	readonly gte?: T | undefined;
	readonly lt?: T | undefined;
	readonly lte?: T | undefined;
	readonly in?: readonly T[] | undefined;
	readonly nin?: readonly T[] | undefined;
	readonly isNull?: boolean | undefined;
}

/** Parsed equality filter (uuid / enum): any subset of these operators. */
export interface EqualityFilterValues<T> {
	readonly eq?: T | undefined;
	readonly ne?: T | undefined;
	readonly in?: readonly T[] | undefined;
	readonly nin?: readonly T[] | undefined;
	readonly isNull?: boolean | undefined;
}

/** Parsed string filter: equality operators plus case-insensitive text matching. */
export interface StringFilterValues extends EqualityFilterValues<string> {
	readonly contains?: string | undefined;
	readonly startsWith?: string | undefined;
}

/** Parsed boolean filter. */
export interface BooleanFilterValues {
	readonly eq?: boolean | undefined;
	readonly isNull?: boolean | undefined;
}

// ── Sorting ─────────────────────────────────────────────────────────────────

export type SortDirection = "asc" | "desc";

/** One validated sort key. */
export interface SortTerm<TField extends string> {
	readonly field: TField;
	readonly direction: SortDirection;
}

export type SortParseResult<TField extends string> =
	{ readonly success: true; readonly terms: readonly SortTerm<TField>[] } | { readonly success: false; readonly message: string };

/**
 * Parses a `sort` parameter (`-createdAt,name`) against the whitelist.
 * Unknown fields, repeats, empty keys and too many keys are rejected with a
 * message that lists what IS allowed.
 */
export function parseSortParam<TField extends string>(raw: string, sortable: readonly TField[]): SortParseResult<TField> {
	const tokens: readonly string[] = raw.split(LIST_VALUE_SEPARATOR).map((token: string): string => token.trim());
	if (tokens.length > LIST_MAX_SORT_TERMS) {
		return { success: false, message: `At most ${String(LIST_MAX_SORT_TERMS)} sort fields are allowed` };
	}
	const terms: SortTerm<TField>[] = [];
	for (const token of tokens) {
		const descending: boolean = token.startsWith(SORT_DESCENDING_PREFIX);
		const name: string = descending ? token.slice(SORT_DESCENDING_PREFIX.length) : token;
		if (name.length === 0) {
			return { success: false, message: "Sort contains an empty field" };
		}
		const field: TField | undefined = sortable.find((candidate: TField): boolean => candidate === name);
		if (field === undefined) {
			return { success: false, message: `Unknown sort field '${name}'. Sortable fields: ${sortable.join(", ")}` };
		}
		if (terms.some((term: SortTerm<TField>): boolean => term.field === field)) {
			return { success: false, message: `Sort field '${name}' is repeated` };
		}
		terms.push({ field, direction: descending ? "desc" : "asc" });
	}
	return { success: true, terms };
}

/** Serializes sort terms back to the wire form (`-createdAt,name`). */
export function formatSortParam<TField extends string>(terms: readonly SortTerm<TField>[]): string {
	return terms.map((term: SortTerm<TField>): string => (term.direction === "desc" ? `${SORT_DESCENDING_PREFIX}${term.field}` : term.field)).join(LIST_VALUE_SEPARATOR);
}

function sameSort<TField extends string>(left: readonly SortTerm<TField>[], right: readonly SortTerm<TField>[]): boolean {
	return (
		left.length === right.length &&
		left.every((term: SortTerm<TField>, index: number): boolean => term.field === right[index]?.field && term.direction === right[index].direction)
	);
}

/** The effective order of one request: the requested sort, or the resource default. */
export interface ResolvedSort<TField extends string> {
	readonly terms: readonly SortTerm<TField>[];
	/** True when `terms` is the resource's default order — the order keyset cursors follow. */
	readonly isDefault: boolean;
}

/** Raised when an unvalidated sort string reaches `resolveSort` — a programming error, never client input. */
export class InvalidListSortError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = "InvalidListSortError";
	}
}

// ── Shared parameter schemas ───────────────────────────────────────────────

/** Free-text search parameter — add it to a resource's `params` when the resource supports search. */
export const ListSearchSchema = z.string().trim().min(1).max(LIST_MAX_SEARCH_LENGTH).optional().meta({
	description: "Case-insensitive free-text search over the resource's search columns",
	example: "john",
});

const ListPageSchema = z.coerce.number().int().min(1).max(LIST_MAX_PAGE).optional().default(1).meta({
	description: "Page number (1-indexed) for offset pagination",
	example: 1,
});

const ListCursorSchema = z.string().min(1).max(LIST_MAX_CURSOR_LENGTH).optional().meta({
	description: "Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order.",
	example: "eyJpZCI6MX0",
});

// ── defineListQuery ─────────────────────────────────────────────────────────

export interface ListQueryOptions<TSortField extends string, TFilter extends z.ZodRawShape, TParams extends z.ZodRawShape> {
	/** Whitelisted sort fields (API names, not column names). */
	readonly sortable: readonly [TSortField, ...TSortField[]];
	/** Order used when the client sends no `sort` — and the order keyset cursors follow. */
	readonly defaultSort: readonly [SortTerm<TSortField>, ...SortTerm<TSortField>[]];
	/** Whitelisted filter fields, built with `listFilter.*`. `{}` when the resource has none. */
	readonly filter: TFilter;
	/** Resource-specific, non-grammar parameters (`search: ListSearchSchema`, scope ids, …). */
	readonly params: TParams;
	/** Page size when the client sends no `limit` (defaults to {@link LIST_DEFAULT_LIMIT}). */
	readonly defaultLimit?: number;
}

/** The query-string shape every list query shares, before resource `params`. */
interface ListQueryBaseShape<TFilter extends z.ZodRawShape> {
	page: typeof ListPageSchema;
	limit: z.ZodDefault<z.ZodOptional<z.ZodCoercedNumber>>;
	cursor: typeof ListCursorSchema;
	sort: z.ZodOptional<z.ZodString>;
	filter: z.ZodOptional<z.ZodObject<z.util.Writeable<TFilter>, z.core.$strict>>;
}

/** The zod schema `defineListQuery` produces. */
export type ListQuerySchema<TFilter extends z.ZodRawShape, TParams extends z.ZodRawShape> = z.ZodObject<
	z.util.Writeable<ListQueryBaseShape<TFilter> & TParams>,
	z.core.$strict
>;

/** A resource's list-query definition: the schema plus the sort metadata the API needs. */
export interface ListQueryDefinition<TSortField extends string, TFilter extends z.ZodRawShape, TParams extends z.ZodRawShape> {
	/** The ONE schema for API validation, Swagger, the shared contract and the typed client. */
	readonly schema: ListQuerySchema<TFilter, TParams>;
	readonly sortable: readonly TSortField[];
	readonly defaultSort: readonly SortTerm<TSortField>[];
	/** Resolves a validated `sort` value (or its absence) to typed terms. */
	readonly resolveSort: (sort: string | undefined) => ResolvedSort<TSortField>;
}

/** Names the list grammar reserves — a resource `params` key may not reuse them. */
const RESERVED_LIST_PARAMS: readonly string[] = ["page", "limit", "cursor", "sort", "filter"];

/**
 * Declares a resource's list query. See docs/technical/api/list-queries.md.
 *
 * ```ts
 * export const productListQuery = defineListQuery({
 *   sortable: ["name", "price", "createdAt"],
 *   defaultSort: [{ field: "createdAt", direction: "desc" }],
 *   filter: { isActive: listFilter.boolean({ eq: true }), price: listFilter.number({ gte: true, lte: true }) },
 *   params: { search: ListSearchSchema },
 * });
 * export const ProductListQuerySchema = productListQuery.schema;
 * ```
 */
export function defineListQuery<TSortField extends string, TFilter extends z.ZodRawShape, TParams extends z.ZodRawShape>(
	options: ListQueryOptions<TSortField, TFilter, TParams>,
): ListQueryDefinition<TSortField, TFilter, TParams> {
	const sortable: readonly TSortField[] = options.sortable;
	const defaultSort: readonly SortTerm<TSortField>[] = options.defaultSort;
	const defaultSortParam: string = formatSortParam(defaultSort);
	const reserved: readonly string[] = Object.keys(options.params).filter((key: string): boolean => RESERVED_LIST_PARAMS.includes(key));
	if (reserved.length > 0) {
		throw new Error(`defineListQuery: params may not redefine the list grammar keys: ${reserved.join(", ")}`);
	}
	const defaultLimit: number = options.defaultLimit ?? LIST_DEFAULT_LIMIT;
	const filterable: string = Object.keys(options.filter).join(", ");

	const resolveSort = (sort: string | undefined): ResolvedSort<TSortField> => {
		if (sort === undefined) {
			return { terms: defaultSort, isDefault: true };
		}
		const parsed: SortParseResult<TSortField> = parseSortParam(sort, sortable);
		if (!parsed.success) {
			throw new InvalidListSortError(parsed.message);
		}
		return { terms: parsed.terms, isDefault: sameSort(parsed.terms, defaultSort) };
	};

	const base: ListQueryBaseShape<TFilter> = {
		page: ListPageSchema,
		limit: z.coerce
			.number()
			.int()
			.min(1)
			.max(LIST_MAX_LIMIT)
			.optional()
			.default(defaultLimit)
			.meta({
				description: `Page size (default ${String(defaultLimit)}, max ${String(LIST_MAX_LIMIT)})`,
				example: defaultLimit,
			}),
		cursor: ListCursorSchema,
		sort: z
			.string()
			.max(LIST_MAX_SORT_LENGTH)
			.superRefine((value: string, context: z.RefinementCtx): void => {
				const parsed: SortParseResult<TSortField> = parseSortParam(value, sortable);
				if (!parsed.success) {
					context.addIssue({ code: "custom", message: parsed.message });
				}
			})
			.optional()
			.meta({
				description: `Comma-separated sort fields, \`-\` prefix = descending (max ${String(LIST_MAX_SORT_TERMS)}). Sortable: ${sortable.join(", ")}. Default: ${defaultSortParam}`,
				example: defaultSortParam,
			}),
		filter: z
			.strictObject(options.filter, {
				error: (issue): string | undefined =>
					issue.code === "unrecognized_keys"
						? `Unknown filter field(s): ${issue.keys.join(", ")}. Filterable fields: ${filterable.length > 0 ? filterable : "none"}`
						: undefined,
			})
			.optional()
			.meta({
				description: `Filters as \`filter[field]=value\` or \`filter[field][operator]=value\`. Filterable: ${filterable.length > 0 ? filterable : "none"}`,
			}),
	};

	const schema: ListQuerySchema<TFilter, TParams> = z.strictObject({ ...base, ...options.params }).superRefine((query, context): void => {
		// The output type is generic here, so read the two keys back through a small concrete schema.
		const paging = CursorAndSortSchema.safeParse(query);
		if (paging.success && paging.data.cursor !== undefined && paging.data.sort !== undefined && !resolveSortSafely(paging.data.sort, sortable, defaultSort)) {
			context.addIssue({
				code: "custom",
				path: ["cursor"],
				message: `Cursor pagination follows the default order (${defaultSortParam}); remove \`sort\` or paginate this sort with \`page\``,
			});
		}
	});

	return { schema, sortable, defaultSort, resolveSort };
}

/** Reads `cursor` + `sort` back out of a parsed list query (unknown keys are ignored). */
const CursorAndSortSchema = z.object({ cursor: z.string().optional(), sort: z.string().optional() });

/** True when `sort` parses AND equals the default order (the only order a cursor may follow). */
function resolveSortSafely<TField extends string>(sort: string, sortable: readonly TField[], defaultSort: readonly SortTerm<TField>[]): boolean {
	const parsed: SortParseResult<TField> = parseSortParam(sort, sortable);
	return parsed.success && sameSort(parsed.terms, defaultSort);
}

// ── Query-string decoding (flat bracket keys → nested filter object) ───────

const FILTER_KEY_PATTERN = /^filter\[(?<field>[A-Za-z][A-Za-z0-9]*)\](?:\[(?<operator>[A-Za-z]+)\])?$/;

/** A query-string record as Fastify / `URLSearchParams` deliver it (strings, or arrays for repeated keys). */
export type RawQueryRecord = Readonly<Record<string, DataValue | undefined>>;

export type NestBracketQueryResult = { readonly success: true; readonly query: Record<string, DataValue> } | { readonly success: false; readonly message: string };

/**
 * Turns the flat `filter[field]` / `filter[field][op]` keys a query string
 * carries into the nested `filter` object the list schemas validate.
 *
 * Safe by construction: field and operator names must match a strict
 * identifier pattern (so `__proto__` / `constructor[...]` style keys never
 * become object paths), results are built with `Map` + `Object.fromEntries`
 * (own data properties only — no prototype writes), the number of filter keys
 * is capped, and anything that is not a recognised bracket key is passed
 * through untouched for the strict schema to reject by name.
 */
export function nestBracketQueryParams(raw: RawQueryRecord): NestBracketQueryResult {
	const passthrough = new Map<string, DataValue>();
	const fields = new Map<string, Map<string, DataValue>>();
	let filterParams = 0;

	for (const [key, value] of Object.entries(raw)) {
		if (value === undefined) continue;
		const match: RegExpExecArray | null = FILTER_KEY_PATTERN.exec(key);
		const field: string | undefined = match?.groups?.field;
		if (match === null || field === undefined) {
			passthrough.set(key, value);
			continue;
		}
		filterParams += 1;
		if (filterParams > LIST_MAX_FILTER_PARAMS) {
			return { success: false, message: `At most ${String(LIST_MAX_FILTER_PARAMS)} filter parameters are allowed` };
		}
		const operator: string = match.groups?.operator ?? "eq";
		if (!LIST_FILTER_OPERATORS.some((known: ListFilterOperator): boolean => known === operator)) {
			return { success: false, message: `Unknown filter operator '${operator}' in '${key}'. Operators: ${LIST_FILTER_OPERATORS.join(", ")}` };
		}
		const operators: Map<string, DataValue> = fields.get(field) ?? new Map<string, DataValue>();
		if (operators.has(operator)) {
			return { success: false, message: `Filter '${field}' repeats the '${operator}' operator` };
		}
		operators.set(operator, value);
		fields.set(field, operators);
	}

	if (fields.size > 0) {
		if (passthrough.has("filter")) {
			return { success: false, message: "Send filters either as filter[field][operator] keys or as one `filter` object, not both" };
		}
		const filter: Record<string, DataValue> = Object.fromEntries(
			[...fields.entries()].map(([field, operators]: [string, Map<string, DataValue>]): [string, DataValue] => [field, Object.fromEntries(operators)]),
		);
		passthrough.set("filter", filter);
	}
	return { success: true, query: Object.fromEntries(passthrough) };
}

/**
 * Serializes a parsed list query (or any GET input) back to query-string
 * pairs: nested objects become bracket keys, arrays become comma lists.
 * The inverse of {@link nestBracketQueryParams}; used by the typed client.
 */
export function flattenQueryParams(key: string, value: DataValue | undefined): readonly (readonly [string, string])[] {
	if (value === undefined) return [];
	if (value === null) return [[key, "null"]];
	if (isStringPrimitive(value)) return [[key, value]];
	if (isNumberPrimitive(value) || isBooleanPrimitive(value)) return [[key, String(value)]];
	if (isArrayValue(value)) {
		return [[key, value.map((item: DataValue): string => (isStringPrimitive(item) ? item : JSON.stringify(item))).join(LIST_VALUE_SEPARATOR)]];
	}
	return Object.entries(value).flatMap(([childKey, childValue]: [string, DataValue | undefined]): readonly (readonly [string, string])[] =>
		flattenQueryParams(`${key}[${childKey}]`, childValue),
	);
}
