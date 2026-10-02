import { adminUserListQuery, AdminUserListQuerySchema, AdminUserStatusSchema, LIST_MAX_PAGE, nestBracketQueryParams, type DataValue } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { resolveRequest } from "../api/endpoints";
import { eqFilter, listStateToListQuery, type ListSortSpec, type SortColumnAliases } from "../api/list-query";
import {
	LIST_FIRST_PAGE,
	listFilterKey,
	listPagePatch,
	listSearchParam,
	listSortToTableSorting,
	listTextFilterParam,
	listUrlParams,
	normalizeListSortParam,
	tableSortingToUrlSort,
} from "./list-url-state";
import { defineUrlState, InvalidUrlStateDefinitionError, optionalUrlParam } from "./url-state";

const PAGE_SIZES: readonly number[] = [10, 20, 50];
const DEFAULT_LIMIT = 20;

const USERS_URL_STATE = defineUrlState(
	{
		...listUrlParams(adminUserListQuery, { pageSizes: PAGE_SIZES, defaultLimit: DEFAULT_LIMIT }),
		search: listSearchParam(),
		status: optionalUrlParam(AdminUserStatusSchema),
	},
	{ urlKeys: { status: listFilterKey("status") } },
);

type UsersUrlState = typeof USERS_URL_STATE.defaults;

function toUsersInput(state: UsersUrlState): ReturnType<typeof listStateToListQuery> {
	return listStateToListQuery(adminUserListQuery, {
		pagination: state,
		sort: state.sort,
		search: state.search,
		filter: { status: eqFilter(state.status) },
	});
}

describe("listFilterKey", () => {
	it("uses the shorthand key for eq and the operator form otherwise", () => {
		expect(listFilterKey("status")).toBe("filter[status]");
		expect(listFilterKey("status", "eq")).toBe("filter[status]");
		expect(listFilterKey("brand", "contains")).toBe("filter[brand][contains]");
	});
});

describe("normalizeListSortParam", () => {
	it("keeps a whitelisted sort in canonical form", () => {
		expect(normalizeListSortParam(" -email , fullName ", adminUserListQuery)).toBe("-email,fullName");
	});

	it("drops a missing, invalid or default sort", () => {
		expect(normalizeListSortParam(undefined, adminUserListQuery)).toBeUndefined();
		expect(normalizeListSortParam("passwordHash", adminUserListQuery)).toBeUndefined();
		expect(normalizeListSortParam("email,email", adminUserListQuery)).toBeUndefined();
		expect(normalizeListSortParam("-createdAt", adminUserListQuery)).toBeUndefined();
	});
});

describe("listUrlParams", () => {
	it("parses the defaults from an empty URL", () => {
		expect(USERS_URL_STATE.defaults).toEqual({ page: LIST_FIRST_PAGE, limit: DEFAULT_LIMIT, cursor: undefined, sort: undefined, search: undefined, status: undefined });
		expect(USERS_URL_STATE.serialize(USERS_URL_STATE.defaults)).toBe("");
	});

	it("parses a full table URL", () => {
		expect(USERS_URL_STATE.parse(new URLSearchParams("page=3&limit=50&cursor=abc&sort=-email&search=jane&filter[status]=locked"))).toEqual({
			page: 3,
			limit: 50,
			cursor: "abc",
			sort: "-email",
			search: "jane",
			status: "locked",
		});
	});

	it.each([
		["page=0", { page: LIST_FIRST_PAGE }],
		["page=-2", { page: LIST_FIRST_PAGE }],
		["page=2.5", { page: LIST_FIRST_PAGE }],
		["page=abc", { page: LIST_FIRST_PAGE }],
		[`page=${String(LIST_MAX_PAGE + 1)}`, { page: LIST_FIRST_PAGE }],
		["limit=25", { limit: DEFAULT_LIMIT }],
		["limit=1000", { limit: DEFAULT_LIMIT }],
		["sort=passwordHash", { sort: undefined }],
		["sort=-createdAt", { sort: undefined }],
		["search=%20%20", { search: undefined }],
		[`search=${"x".repeat(201)}`, { search: undefined }],
		["filter[status]=superuser", { status: undefined }],
		["cursor=", { cursor: undefined }],
	])("falls back to the default for %s", (query: string, expected: Partial<UsersUrlState>) => {
		expect(USERS_URL_STATE.parse(new URLSearchParams(query))).toEqual({ ...USERS_URL_STATE.defaults, ...expected });
	});

	it("rejects invalid page-size configuration at definition time", () => {
		expect(() => listUrlParams(adminUserListQuery, { pageSizes: [10, 20], defaultLimit: 25 })).toThrow(InvalidUrlStateDefinitionError);
		expect(() => listUrlParams(adminUserListQuery, { pageSizes: [10, 500], defaultLimit: 10 })).toThrow(/page sizes must be whole numbers/);
		expect(() => listUrlParams(adminUserListQuery, { pageSizes: [], defaultLimit: 10 })).toThrow(InvalidUrlStateDefinitionError);
	});
});

describe("listPagePatch", () => {
	const ON_PAGE_2: UsersUrlState = { ...USERS_URL_STATE.defaults, page: 2, cursor: "cursor-of-page-2" };

	it("reuses the response's keyset cursor for a sequential next in the default order", () => {
		expect(listPagePatch(ON_PAGE_2, 3, "cursor-of-page-3")).toEqual({ page: 3, cursor: "cursor-of-page-3" });
	});

	it("pages by offset when going back or jumping", () => {
		expect(listPagePatch(ON_PAGE_2, 1, "cursor-of-page-3")).toEqual({ page: 1, cursor: undefined });
		expect(listPagePatch(ON_PAGE_2, 5, "cursor-of-page-3")).toEqual({ page: 5, cursor: undefined });
	});

	it("pages by offset under a custom sort or when the response has no cursor", () => {
		expect(listPagePatch({ ...ON_PAGE_2, sort: "-email" }, 3, "cursor-of-page-3")).toEqual({ page: 3, cursor: undefined });
		expect(listPagePatch(ON_PAGE_2, 3, null)).toEqual({ page: 3, cursor: undefined });
	});
});

describe("listSearchParam / listTextFilterParam", () => {
	it("trim and drop blank values", () => {
		expect(listSearchParam().parse("  jane ")).toBe("jane");
		expect(listSearchParam().parse("   ")).toBeUndefined();
		expect(listTextFilterParam().parse(" Acme ")).toBe("Acme");
		expect(listTextFilterParam().parse("")).toBeUndefined();
	});
});

describe("sort ⇄ table sorting", () => {
	const ALIASES: SortColumnAliases<"id" | "name" | "iso2"> = { countryCode: "iso2" };

	it("maps the URL sort onto table columns, reversing aliases", () => {
		expect(listSortToTableSorting("-iso2,name", ALIASES)).toEqual([
			{ id: "countryCode", desc: true },
			{ id: "name", desc: false },
		]);
		expect(listSortToTableSorting(undefined)).toEqual([]);
	});

	it("maps table sorting to a normalized URL sort (default order → undefined)", () => {
		expect(tableSortingToUrlSort([{ id: "email", desc: true }], adminUserListQuery)).toBe("-email");
		expect(tableSortingToUrlSort([{ id: "createdAt", desc: true }], adminUserListQuery)).toBeUndefined();
		expect(tableSortingToUrlSort([{ id: "roles", desc: false }], adminUserListQuery)).toBeUndefined();
		expect(tableSortingToUrlSort([], adminUserListQuery)).toBeUndefined();
	});
});

describe("URL ⇄ list input (1:1)", () => {
	it("builds the list input the API schema accepts", () => {
		const state = USERS_URL_STATE.parse({ page: "2", sort: "fullName", search: "jane", "filter[status]": "locked" });
		const input = toUsersInput(state);
		expect(input).toEqual({ page: 2, limit: DEFAULT_LIMIT, sort: "fullName", search: "jane", filter: { status: { eq: "locked" } } });
		expect(AdminUserListQuerySchema.safeParse(input).success).toBe(true);
	});

	it("sends the same query string the URL carries (plus the explicit page and limit)", () => {
		const url = "sort=-email&search=jane&filter[status]=locked";
		const input = toUsersInput(USERS_URL_STATE.parse(new URLSearchParams(url)));
		const path = "/auth/admin/users";
		const sent = new URLSearchParams(resolveRequest(path, input).url.slice(path.length + 1));
		const fromUrl = new URLSearchParams(url);
		expect(sent.get("sort")).toBe(fromUrl.get("sort"));
		expect(sent.get("search")).toBe(fromUrl.get("search"));
		expect(sent.get("filter[status][eq]")).toBe(fromUrl.get("filter[status]"));
		expect(sent.get("page")).toBe("1");
		expect(sent.get("limit")).toBe(String(DEFAULT_LIMIT));
	});

	it("parses the URL's bracket keys exactly like the API does", () => {
		const record: Record<string, DataValue> = Object.fromEntries(new URLSearchParams("filter[status]=locked&page=2"));
		const nested = nestBracketQueryParams(record);
		expect(nested.success).toBe(true);
		const apiQuery = AdminUserListQuerySchema.parse(nested.success ? nested.query : {});
		expect(apiQuery.filter).toEqual({ status: { eq: "locked" } });
		expect(toUsersInput(USERS_URL_STATE.parse(new URLSearchParams("filter[status]=locked&page=2"))).filter).toEqual(apiQuery.filter);
	});

	it("keeps a keyset cursor only with the default order", () => {
		expect(toUsersInput(USERS_URL_STATE.parse(new URLSearchParams("page=2&cursor=abc"))).cursor).toBe("abc");
		expect(toUsersInput(USERS_URL_STATE.parse(new URLSearchParams("page=2&cursor=abc&sort=email"))).cursor).toBeUndefined();
	});

	it("drops sort fields the target resource does not whitelist", () => {
		const geoLike: ListSortSpec<"id" | "name"> = { sortable: ["id", "name"], defaultSort: [{ field: "id", direction: "asc" }] };
		expect(listStateToListQuery(geoLike, { pagination: { page: 1, limit: 20 }, sort: "-stateCode,name" }).sort).toBe("name");
		expect(listStateToListQuery(geoLike, { pagination: { page: 1, limit: 20 }, sort: "stateCode" }).sort).toBeUndefined();
	});
});
