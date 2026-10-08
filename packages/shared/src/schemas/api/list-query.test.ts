import { describe, expect, it } from "vitest";
import { z } from "zod";

import { isArrayValue } from "../../lib/runtime-narrowing";

import {
	defineListQuery,
	flattenQueryParams,
	formatSortParam,
	InvalidListSortError,
	LIST_DEFAULT_LIMIT,
	LIST_MAX_FILTER_PARAMS,
	LIST_MAX_FILTER_VALUES,
	LIST_MAX_LIMIT,
	LIST_MAX_SORT_TERMS,
	listFilter,
	ListSearchSchema,
	nestBracketQueryParams,
	parseSortParam,
	type RawQueryRecord,
} from "./list-query";

const StatusSchema = z.enum(["ACTIVE", "LOCKED", "DISABLED"]);
const OWNER_ID = "6f1c2a52-9a3e-4d38-9a55-0d1e2f3a4b5c";
const CUSTOM_DEFAULT_LIMIT = 7;

const testListQuery = defineListQuery({
	sortable: ["name", "price", "createdAt"],
	defaultSort: [{ field: "createdAt", direction: "desc" }],
	filter: {
		status: listFilter.enumeration(StatusSchema, { eq: true, in: true }),
		price: listFilter.number({ gte: true, lte: true }),
		name: listFilter.string({ eq: true, contains: true, isNull: true }),
		isActive: listFilter.boolean({ eq: true }),
		ownerId: listFilter.uuid({ eq: true, nin: true }),
		createdAt: listFilter.epochMs({ gte: true }),
	},
	params: { search: ListSearchSchema },
});
const TestListQuerySchema = testListQuery.schema;

/** Parses a raw query string the way the API does: bracket keys nested first, then the strict schema. */
function parseQueryString(queryString: string): ReturnType<typeof TestListQuerySchema.safeParse> {
	const raw: Record<string, string | string[]> = {};
	for (const [key, value] of new URLSearchParams(queryString)) {
		const existing = raw[key];
		raw[key] = existing === undefined ? value : [...(isArrayValue(existing) ? existing : [existing]), value];
	}
	const nested = nestBracketQueryParams(raw);
	if (!nested.success) {
		throw new Error(nested.message);
	}
	return TestListQuerySchema.safeParse(nested.query);
}

function issueMessages(result: ReturnType<typeof TestListQuerySchema.safeParse>): string {
	return result.success ? "" : result.error.issues.map((issue): string => issue.message).join(" | ");
}

describe("parseSortParam", () => {
	it("parses a comma list with - prefix = descending", () => {
		expect(parseSortParam("-createdAt,name", ["name", "createdAt"])).toEqual({
			success: true,
			terms: [
				{ field: "createdAt", direction: "desc" },
				{ field: "name", direction: "asc" },
			],
		});
	});

	it("rejects unknown fields and lists the sortable ones", () => {
		const parsed = parseSortParam("password", ["name", "createdAt"]);
		expect(parsed).toEqual({ success: false, message: "Unknown sort field 'password'. Sortable fields: name, createdAt" });
	});

	it("rejects empty keys, repeats and too many keys", () => {
		expect(parseSortParam("name,", ["name"]).success).toBe(false);
		expect(parseSortParam("-", ["name"]).success).toBe(false);
		expect(parseSortParam("name,-name", ["name"])).toEqual({ success: false, message: "Sort field 'name' is repeated" });
		const tooMany = Array.from({ length: LIST_MAX_SORT_TERMS + 1 }, (_value: number, index: number): string => `f${String(index)}`);
		expect(parseSortParam(tooMany.join(","), tooMany).success).toBe(false);
	});

	it("round-trips through formatSortParam", () => {
		const terms = [
			{ field: "price", direction: "desc" },
			{ field: "name", direction: "asc" },
		] satisfies { field: "price" | "name"; direction: "asc" | "desc" }[];
		expect(formatSortParam(terms)).toBe("-price,name");
	});
});

describe("defineListQuery — pagination", () => {
	it("defaults page to 1 and limit to the shared default", () => {
		const parsed = TestListQuerySchema.parse({});
		expect(parsed.page).toBe(1);
		expect(parsed.limit).toBe(LIST_DEFAULT_LIMIT);
	});

	it("honours a resource default limit", () => {
		const custom = defineListQuery({ sortable: ["id"], defaultSort: [{ field: "id", direction: "asc" }], filter: {}, params: {}, defaultLimit: CUSTOM_DEFAULT_LIMIT });
		expect(custom.schema.parse({}).limit).toBe(CUSTOM_DEFAULT_LIMIT);
	});

	it("coerces query-string numbers and bounds limit", () => {
		expect(TestListQuerySchema.parse({ page: "3", limit: "50" })).toEqual(expect.objectContaining({ page: 3, limit: 50 }));
		expect(TestListQuerySchema.safeParse({ limit: String(LIST_MAX_LIMIT + 1) }).success).toBe(false);
		expect(TestListQuerySchema.safeParse({ page: "0" }).success).toBe(false);
	});

	it("rejects unknown top-level keys (the old sortBy / sortDirection names included)", () => {
		expect(TestListQuerySchema.safeParse({ sortBy: "name" }).success).toBe(false);
		expect(TestListQuerySchema.safeParse({ status: "ACTIVE" }).success).toBe(false);
	});

	it("refuses to define a resource param that shadows the grammar", () => {
		expect(() => defineListQuery({ sortable: ["id"], defaultSort: [{ field: "id", direction: "asc" }], filter: {}, params: { sort: z.string() } })).toThrow(/sort/);
	});
});

describe("defineListQuery — sort", () => {
	it("accepts whitelisted sort keys and rejects others with the allowed list", () => {
		expect(TestListQuerySchema.safeParse({ sort: "-price,name" }).success).toBe(true);
		const rejected = TestListQuerySchema.safeParse({ sort: "secret" });
		expect(issueMessages(rejected)).toContain("Sortable fields: name, price, createdAt");
	});

	it("resolves the default order when no sort is sent and flags it as default", () => {
		expect(testListQuery.resolveSort(undefined)).toEqual({ terms: [{ field: "createdAt", direction: "desc" }], isDefault: true });
		expect(testListQuery.resolveSort("-createdAt").isDefault).toBe(true);
		expect(testListQuery.resolveSort("name")).toEqual({ terms: [{ field: "name", direction: "asc" }], isDefault: false });
	});

	it("throws a programming error for an unvalidated sort", () => {
		expect(() => testListQuery.resolveSort("nope")).toThrow(InvalidListSortError);
	});

	it("only allows a cursor with the default order", () => {
		expect(TestListQuerySchema.safeParse({ cursor: "abc" }).success).toBe(true);
		expect(TestListQuerySchema.safeParse({ cursor: "abc", sort: "-createdAt" }).success).toBe(true);
		const rejected = TestListQuerySchema.safeParse({ cursor: "abc", sort: "name" });
		expect(rejected.success).toBe(false);
		expect(issueMessages(rejected)).toContain("Cursor pagination follows the default order");
	});
});

describe("defineListQuery — filter AST", () => {
	it("expands the scalar shorthand to eq and coerces values", () => {
		const parsed = parseQueryString("filter[status]=ACTIVE&filter[price][gte]=10&filter[price][lte]=99.5&filter[isActive]=true&filter[createdAt][gte]=1700000000000");
		expect(parsed.success).toBe(true);
		expect(parsed.data?.filter).toEqual({
			status: { eq: "ACTIVE" },
			price: { gte: 10, lte: 99.5 },
			isActive: { eq: true },
			createdAt: { gte: 1_700_000_000_000 },
		});
	});

	it("splits in / nin comma lists and repeated keys into arrays", () => {
		const parsed = parseQueryString(`filter[status][in]=ACTIVE,LOCKED&filter[ownerId][nin]=${OWNER_ID}`);
		expect(parsed.data?.filter).toEqual({ status: { in: ["ACTIVE", "LOCKED"] }, ownerId: { nin: [OWNER_ID] } });
	});

	it("parses isNull to a boolean and text operators to trimmed strings", () => {
		const parsed = parseQueryString("filter[name][isNull]=false&filter[name][contains]=%20shoe%20");
		expect(parsed.data?.filter).toEqual({ name: { isNull: false, contains: "shoe" } });
	});

	it("rejects a filter field that is not whitelisted, naming the filterable fields", () => {
		const parsed = parseQueryString("filter[passwordHash]=x");
		expect(parsed.success).toBe(false);
		expect(issueMessages(parsed)).toContain("Unknown filter field(s): passwordHash");
	});

	it("rejects an operator the field does not allow, naming the allowed ones", () => {
		const parsed = parseQueryString("filter[status][contains]=ACT");
		expect(parsed.success).toBe(false);
		expect(issueMessages(parsed)).toContain("Allowed: eq, in");
	});

	it("rejects values of the wrong type", () => {
		expect(parseQueryString("filter[price][gte]=cheap").success).toBe(false);
		expect(parseQueryString("filter[price][gte]=").success).toBe(false);
		expect(parseQueryString("filter[status]=UNKNOWN").success).toBe(false);
		expect(parseQueryString("filter[ownerId][nin]=not-a-uuid").success).toBe(false);
		expect(parseQueryString("filter[isActive]=yes").success).toBe(false);
	});

	it("bounds in / nin lists", () => {
		const values = Array.from({ length: LIST_MAX_FILTER_VALUES + 1 }, (): string => "ACTIVE").join(",");
		expect(parseQueryString(`filter[status][in]=${values}`).success).toBe(false);
	});

	it("validates search length and trims it", () => {
		expect(TestListQuerySchema.parse({ search: "  john " }).search).toBe("john");
		expect(TestListQuerySchema.safeParse({ search: "   " }).success).toBe(false);
	});
});

describe("nestBracketQueryParams", () => {
	it("nests filter keys and passes every other key through", () => {
		expect(nestBracketQueryParams({ page: "2", "filter[status][in]": "A,B", "filter[name]": "x" })).toEqual({
			success: true,
			query: { page: "2", filter: { status: { in: "A,B" }, name: { eq: "x" } } },
		});
	});

	it("never turns prototype keys into object paths", () => {
		const raw: RawQueryRecord = { "filter[__proto__][eq]": "x", "__proto__[polluted]": "z" };
		const result = nestBracketQueryParams(raw);
		expect(result.success).toBe(true);
		expect(Object.prototype).not.toHaveProperty("polluted");
		// Not identifiers → passed through untouched, so the strict list schema rejects them by name.
		expect(result.success && Object.keys(result.query)).toEqual(["filter[__proto__][eq]", "__proto__[polluted]"]);
		expect(result.success && TestListQuerySchema.safeParse(result.query).success).toBe(false);
	});

	it("builds the filter object from own data properties only", () => {
		const result = nestBracketQueryParams({ "filter[constructor]": "x" });
		expect(result.success && result.query).toEqual({ filter: { constructor: { eq: "x" } } });
		expect(nestBracketQueryParams({ "filter[constructor][prototype]": "x" }).success).toBe(false);
	});

	it("rejects unknown operators and repeated operators", () => {
		expect(nestBracketQueryParams({ "filter[status][like]": "x" })).toEqual({
			success: false,
			message: expect.stringContaining("Unknown filter operator 'like'"),
		});
		expect(nestBracketQueryParams({ "filter[status]": "x", "filter[status][eq]": "y" }).success).toBe(false);
	});

	it("caps the number of filter keys", () => {
		const raw: Record<string, string> = {};
		for (let index = 0; index <= LIST_MAX_FILTER_PARAMS; index += 1) {
			raw[`filter[field${String(index)}]`] = "x";
		}
		expect(nestBracketQueryParams(raw)).toEqual({ success: false, message: expect.stringContaining(String(LIST_MAX_FILTER_PARAMS)) });
	});

	it("refuses to mix bracket keys with a raw filter object", () => {
		expect(nestBracketQueryParams({ filter: "x", "filter[status]": "A" }).success).toBe(false);
	});
});

describe("flattenQueryParams", () => {
	it("is the inverse of nestBracketQueryParams for list inputs", () => {
		const pairs = flattenQueryParams("filter", { status: { in: ["ACTIVE", "LOCKED"] }, price: { gte: 10 }, isActive: { eq: true }, name: undefined });
		expect(pairs).toEqual([
			["filter[status][in]", "ACTIVE,LOCKED"],
			["filter[price][gte]", "10"],
			["filter[isActive][eq]", "true"],
		]);
		const nested = nestBracketQueryParams(Object.fromEntries(pairs));
		expect(nested.success && TestListQuerySchema.parse(nested.query).filter).toEqual({ status: { in: ["ACTIVE", "LOCKED"] }, price: { gte: 10 }, isActive: { eq: true } });
	});

	it("serializes scalars and skips undefined", () => {
		expect(flattenQueryParams("page", 2)).toEqual([["page", "2"]]);
		expect(flattenQueryParams("search", undefined)).toEqual([]);
	});
});
