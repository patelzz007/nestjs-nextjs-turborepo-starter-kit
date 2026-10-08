// ============================================
// lib/url-state/url-state.ts - typed, zod-parsed URL search-param state
// ============================================
// Shareable, bookmarkable, back/forward-aware state (a table's page, sort,
// filters and search; an in-page selection such as `?key=`) belongs in the URL
// — not in Zustand and not in `useState` (ADR 023, docs/technical/api/list-queries.md §7).
//
// `defineUrlState` declares that state ONCE as a zod shape, one schema per
// param. The same definition is used:
//   - by a server page, to parse its `searchParams` prop and prefetch exactly
//     the page the URL asks for (SSR-visible state);
//   - by `useUrlState` (./use-url-state), to read `useSearchParams()` and write
//     patches back to the URL.
//
// Every param is untrusted input. Parsing NEVER throws: a missing, malformed
// or out-of-range value falls back to that param's default, independently of
// the other params. Serializing omits params whose value equals the default,
// so a table in its default state has a clean URL with no query string at all.
//
// This module is framework-free and server-safe (no "use client").

import { z } from "zod";
import { isStringPrimitive, LIST_SLOT_INDEX } from "@workspace/shared";

/** A value one URL search param holds once parsed. */
export type UrlParamValue = string | number | boolean | undefined;

/**
 * One URL search param: a zod schema that parses the raw string (or its
 * absence) into a typed value. It MUST also accept `undefined` — that result is
 * the param's default — so wrap it with `.catch(default)`, `.default(...)` or
 * `.optional()`; `defineUrlState` rejects a shape that has no default.
 */
export type UrlParamSchema<T extends UrlParamValue> = z.ZodType<T>;

/** A URL-state declaration: state field name → param schema. */
export type UrlStateShape = Readonly<Record<string, UrlParamSchema<UrlParamValue>>>;

/** The typed state a shape parses to. */
export type UrlState<TShape extends UrlStateShape> = z.output<z.ZodObject<z.util.Writeable<TShape>>>;

/** Search params as Next.js hands them to a server page (`await props.searchParams`). */
export type SearchParamsRecord = Readonly<Record<string, string | readonly string[] | undefined>>;

/** Anything search params can be read from: `URLSearchParams` (incl. Next's `ReadonlyURLSearchParams`) or a page's `searchParams` record. */
export type UrlSearchSource = URLSearchParams | SearchParamsRecord;

export interface UrlStateOptions<TShape extends UrlStateShape> {
	/**
	 * The URL key of a field when it differs from the field name — e.g. list
	 * filters live under the list grammar's bracket keys
	 * (`{ status: "filter[status]" }`, see `listFilterKey`).
	 */
	readonly urlKeys?: Readonly<Partial<Record<keyof TShape & string, string>>>;
}

export interface UrlStateCodec<TShape extends UrlStateShape> {
	/** The state of a URL that carries none of this codec's params. */
	readonly defaults: UrlState<TShape>;
	/** Every URL key this codec owns (other keys in the URL are left untouched). */
	readonly urlKeys: readonly string[];
	/** Parses search params into typed state. Never throws: each invalid or missing param falls back to its default. */
	readonly parse: (source: UrlSearchSource) => UrlState<TShape>;
	/**
	 * Serializes `state` into a query string (no leading `?`). Params equal to
	 * their default are omitted. Keys of `current` that this codec does not own
	 * are kept, so two codecs (or unrelated params) can share one URL.
	 */
	readonly serialize: (state: UrlState<TShape>, current?: UrlSearchSource) => string;
	/** `pathname` + the serialized query (`/users?page=2`), or the bare pathname for a default state. */
	readonly href: (pathname: string, state: UrlState<TShape>, current?: UrlSearchSource) => string;
}

/** Validates a state object back into plain param values for serialization (state values are always `UrlParamValue`s). */
const UrlParamRecordSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.undefined()]));

/** Raised when a URL-state declaration is invalid — a programming error found at module load, never caused by user input. */
export class InvalidUrlStateDefinitionError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = "InvalidUrlStateDefinitionError";
	}
}

/** The first value of a param, or `undefined` when it is absent (repeated keys keep the first, like `URLSearchParams.get`). */
export function readSearchParam(source: UrlSearchSource, key: string): string | undefined {
	if (source instanceof URLSearchParams) {
		return source.get(key) ?? undefined;
	}
	const value: string | readonly string[] | undefined = source[key];
	if (value === undefined || isStringPrimitive(value)) {
		return value;
	}
	return value[LIST_SLOT_INDEX.first];
}

/** A mutable copy of `source` as `URLSearchParams` (repeated keys preserved). */
export function toUrlSearchParams(source: UrlSearchSource | undefined): URLSearchParams {
	if (source === undefined) {
		return new URLSearchParams();
	}
	if (source instanceof URLSearchParams) {
		return new URLSearchParams(source);
	}
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(source)) {
		if (value === undefined) continue;
		const values: readonly string[] = isStringPrimitive(value) ? [value] : value;
		for (const item of values) {
			params.append(key, item);
		}
	}
	return params;
}

/**
 * `URLSearchParams#toString()` with the list grammar's brackets left readable
 * (`filter[status]=locked` instead of `filter%5Bstatus%5D=locked`). Brackets
 * are valid in a query string and every parser (browser, Next, Fastify) reads
 * both forms the same way.
 */
export function formatQueryString(params: URLSearchParams): string {
	return params.toString().replaceAll("%5B", "[").replaceAll("%5D", "]");
}

/** Two query strings carry the same params in the same order (encoding differences ignored). */
export function isSameQuery(left: string, right: string): boolean {
	return new URLSearchParams(left).toString() === new URLSearchParams(right).toString();
}

/** A parsed value → its URL text, or `undefined` when it should not appear in the URL. */
function formatParamValue(value: UrlParamValue): string | undefined {
	if (value === undefined) return undefined;
	if (isStringPrimitive(value)) return value.length > 0 ? value : undefined;
	return String(value);
}

/**
 * Declares a URL state. Each field parses independently, so one bad param
 * never resets the others.
 *
 * ```ts
 * export const TEMPLATE_URL_STATE = defineUrlState({ key: EmailTemplateKeySchema.optional().catch(undefined) });
 * const { key } = TEMPLATE_URL_STATE.parse(await props.searchParams); // server page
 * const [{ key }, update] = useUrlState(TEMPLATE_URL_STATE);          // client component
 * ```
 */
export function defineUrlState<TShape extends UrlStateShape>(shape: TShape, options: UrlStateOptions<TShape> = {}): UrlStateCodec<TShape> {
	const objectSchema = z.object(shape);
	const fieldNames: readonly (keyof TShape & string)[] = Object.keys(shape).filter((name: string): name is keyof TShape & string => Object.hasOwn(shape, name));
	const urlKeyOf = (name: keyof TShape & string): string => options.urlKeys?.[name] ?? name;

	const urlKeys: readonly string[] = fieldNames.map(urlKeyOf);
	const duplicates: readonly string[] = urlKeys.filter((key: string, index: number): boolean => urlKeys.indexOf(key) !== index);
	if (duplicates.length > 0) {
		throw new InvalidUrlStateDefinitionError(`defineUrlState: several fields map to the same URL key: ${duplicates.join(", ")}`);
	}

	// Every field is passed explicitly (absent → `undefined`) so the parsed
	// state always carries every key — zod drops absent optional keys, and a
	// missing key would make `{ ...state, ...patch }` and `Object.keys` lie.
	const toObjectInput = (accepted: ReadonlyMap<string, string>): Record<string, string | undefined> =>
		Object.fromEntries(fieldNames.map((name: string): [string, string | undefined] => [name, accepted.get(name)]));

	const parsedDefaults = objectSchema.safeParse(toObjectInput(new Map<string, string>()));
	if (!parsedDefaults.success) {
		const fields: string = parsedDefaults.error.issues.map((issue): string => issue.path.join(".")).join(", ");
		throw new InvalidUrlStateDefinitionError(`defineUrlState: field(s) ${fields} need a default for an absent param — use .catch(…), .default(…) or .optional()`);
	}
	const defaults: UrlState<TShape> = parsedDefaults.data;
	const encodedDefaults: Readonly<Record<string, UrlParamValue>> = UrlParamRecordSchema.parse(defaults);

	const parse = (source: UrlSearchSource): UrlState<TShape> => {
		// Keep only the raw values their own schema accepts; every other field
		// then parses as absent and takes its default.
		const accepted = new Map<string, string>();
		for (const name of fieldNames) {
			const raw: string | undefined = readSearchParam(source, urlKeyOf(name));
			const fieldSchema: UrlParamSchema<UrlParamValue> | undefined = shape[name];
			if (raw !== undefined && fieldSchema?.safeParse(raw).success === true) {
				accepted.set(name, raw);
			}
		}
		const parsed = objectSchema.safeParse(toObjectInput(accepted));
		return parsed.success ? parsed.data : defaults;
	};

	const serialize = (state: UrlState<TShape>, current?: UrlSearchSource): string => {
		const params: URLSearchParams = toUrlSearchParams(current);
		const encoded: Readonly<Record<string, UrlParamValue>> = UrlParamRecordSchema.parse(state);
		for (const name of fieldNames) {
			params.delete(urlKeyOf(name));
		}
		for (const name of fieldNames) {
			const value: string | undefined = formatParamValue(encoded[name]);
			if (value !== undefined && value !== formatParamValue(encodedDefaults[name])) {
				params.set(urlKeyOf(name), value);
			}
		}
		return formatQueryString(params);
	};

	const href = (pathname: string, state: UrlState<TShape>, current?: UrlSearchSource): string => {
		const query: string = serialize(state, current);
		return query.length > 0 ? `${pathname}?${query}` : pathname;
	};

	return { defaults, urlKeys, parse, serialize, href };
}

// ── Param builders ─────────────────────────────────────────────────────────

/** An optional param: the value when `schema` accepts it, otherwise absent (`undefined`). */
export function optionalUrlParam<T extends string | number | boolean>(schema: z.ZodType<T>): UrlParamSchema<T | undefined> {
	return schema.optional().catch(undefined);
}

/** A param with a default: the value when `schema` accepts it, otherwise `fallback`. */
export function urlParamWithDefault<T extends string | number | boolean>(schema: z.ZodType<T>, fallback: T): UrlParamSchema<T> {
	return schema.catch(fallback);
}

/** `"true"` / `"false"` → boolean; anything else → absent. */
export function optionalBooleanUrlParam(): UrlParamSchema<boolean | undefined> {
	return z
		.enum(["true", "false"])
		.transform((value: "true" | "false"): boolean => value === "true")
		.optional()
		.catch(undefined);
}
