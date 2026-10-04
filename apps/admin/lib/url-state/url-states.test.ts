// Page-level parsing: each server page parses its `searchParams` record with
// one of these codecs and prefetches the resulting list input; the client
// table builds the same input from `useSearchParams()`. These tests pin the
// URL ⇄ API-input mapping of every admin list/queue page.

import {
	AdminMfaRecoveryListQuerySchema,
	AdminMerchantListQuerySchema,
	AdminUserListQuerySchema,
	CityListQuerySchema,
	CountryListQuerySchema,
	EmailLogListQuerySchema,
	ProductListQuerySchema,
	SampleCategoryListQuerySchema,
	StateListQuerySchema,
} from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { CATEGORIES_TABLE_URL_STATE, toCategoriesListQuery } from "./categories";
import { EMAIL_LOG_PAGE_SIZE, EMAIL_LOG_URL_STATE, toEmailLogListQuery } from "./email-log";
import { DEFAULT_GEO_TAB, GEO_URL_STATE, toCitiesListQuery, toCountriesListQuery, toStatesListQuery } from "./geography";
import { MERCHANTS_TABLE_URL_STATE, toMerchantsListQuery } from "./merchants";
import { MFA_RECOVERY_PENDING_QUEUE_HREF, MFA_RECOVERY_URL_STATE, toMfaRecoveryListQuery } from "./mfa-recovery";
import { PRODUCTS_TABLE_URL_STATE, toProductsListQuery } from "./products";
import { EMAIL_TEMPLATES_URL_STATE, KYB_REVIEW_URL_STATE, STORE_REQUESTS_URL_STATE } from "./selection";
import { toUsersListQuery, USERS_TABLE_URL_STATE } from "./users";

const UUID = "6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b";

describe("users", () => {
	it("maps a full URL to the API input the list schema accepts", () => {
		const input = toUsersListQuery(USERS_TABLE_URL_STATE.parse({ page: "2", limit: "50", sort: "-email", search: "jane", "filter[status]": "locked" }));
		expect(input).toEqual({ page: 2, limit: 50, sort: "-email", search: "jane", filter: { status: { eq: "locked" } } });
		expect(AdminUserListQuerySchema.safeParse(input).success).toBe(true);
	});

	it("falls back to page 1 / 20 rows / default order for an empty or hostile URL", () => {
		expect(toUsersListQuery(USERS_TABLE_URL_STATE.parse({}))).toEqual({ page: 1, limit: 20 });
		expect(toUsersListQuery(USERS_TABLE_URL_STATE.parse({ page: "x", limit: "1000", sort: "password", "filter[status]": "admin", search: "" }))).toEqual({
			page: 1,
			limit: 20,
		});
	});
});

describe("merchants", () => {
	it("maps the KYB and org status filters", () => {
		const input = toMerchantsListQuery(MERCHANTS_TABLE_URL_STATE.parse({ "filter[kybStatus]": "PENDING", "filter[status]": "ACTIVE", search: "café" }));
		expect(input).toEqual({ page: 1, limit: 20, search: "café", filter: { kybStatus: { eq: "PENDING" }, status: { eq: "ACTIVE" } } });
		expect(AdminMerchantListQuerySchema.safeParse(input).success).toBe(true);
	});
});

describe("email log", () => {
	it("uses the log's own default page size and status filter", () => {
		const input = toEmailLogListQuery(EMAIL_LOG_URL_STATE.parse({ "filter[status]": "bounced", sort: "subject" }));
		expect(input).toEqual({ page: 1, limit: EMAIL_LOG_PAGE_SIZE, sort: "subject", filter: { status: { eq: "bounced" } } });
		expect(EmailLogListQuerySchema.safeParse(input).success).toBe(true);
		expect(EMAIL_LOG_URL_STATE.serialize(EMAIL_LOG_URL_STATE.parse({ limit: String(EMAIL_LOG_PAGE_SIZE) }))).toBe("");
	});
});

describe("categories", () => {
	it("maps the active filter (true/false literals only)", () => {
		expect(toCategoriesListQuery(CATEGORIES_TABLE_URL_STATE.parse({ "filter[isActive]": "false" }))).toEqual({ page: 1, limit: 20, filter: { isActive: { eq: false } } });
		expect(toCategoriesListQuery(CATEGORIES_TABLE_URL_STATE.parse({ "filter[isActive]": "yes" }))).toEqual({ page: 1, limit: 20 });
		expect(SampleCategoryListQuerySchema.safeParse(toCategoriesListQuery(CATEGORIES_TABLE_URL_STATE.parse({ "filter[isActive]": "true" }))).success).toBe(true);
	});
});

describe("products", () => {
	it("maps the select and text filters to their grammar operators", () => {
		const input = toProductsListQuery(
			PRODUCTS_TABLE_URL_STATE.parse({ "filter[isFeatured]": "true", "filter[categoryId]": UUID, "filter[brand][contains]": " Acme ", sort: "-price" }),
		);
		expect(input).toEqual({
			page: 1,
			limit: 20,
			sort: "-price",
			filter: { isActive: undefined, isFeatured: { eq: true }, categoryId: { eq: UUID }, brand: { contains: "Acme" } },
		});
		expect(ProductListQuerySchema.safeParse(input).success).toBe(true);
	});

	it("keeps a half-typed category id in the URL state but never sends it", () => {
		const state = PRODUCTS_TABLE_URL_STATE.parse({ "filter[categoryId]": "6f1c" });
		expect(state.categoryId).toBe("6f1c");
		expect(toProductsListQuery(state)).toEqual({ page: 1, limit: 20 });
	});
});

describe("geography", () => {
	it("defaults to the countries tab", () => {
		expect(GEO_URL_STATE.parse({}).tab).toBe(DEFAULT_GEO_TAB);
		expect(GEO_URL_STATE.parse({ tab: "planets" }).tab).toBe(DEFAULT_GEO_TAB);
	});

	it("builds each tab's input with only that resource's sort fields and filters", () => {
		const state = GEO_URL_STATE.parse({ tab: "states", sort: "-stateCode,name", search: "sel", "filter[countryCode]": "my" });
		expect(state.sort).toBe("-stateCode,name");

		const states = toStatesListQuery(state);
		expect(states).toEqual({ page: 1, limit: 20, sort: "name", search: "sel", filter: { countryCode: { eq: "my" } } });
		expect(StateListQuerySchema.safeParse(states).success).toBe(true);

		const cities = toCitiesListQuery(state);
		expect(cities).toEqual({ page: 1, limit: 20, sort: "-stateCode,name", search: "sel", filter: { countryCode: { eq: "my" } } });
		expect(CityListQuerySchema.safeParse(cities).success).toBe(true);

		const countries = toCountriesListQuery(state);
		expect(countries).toEqual({ page: 1, limit: 20, sort: "name", search: "sel" });
		expect(CountryListQuerySchema.safeParse(countries).success).toBe(true);
	});

	it("serializes the tab under ?tab= and omits the default tab", () => {
		expect(GEO_URL_STATE.serialize({ ...GEO_URL_STATE.defaults, tab: "cities", page: 2 })).toBe("tab=cities&page=2");
		expect(GEO_URL_STATE.serialize(GEO_URL_STATE.defaults)).toBe("");
	});
});

describe("mfa recovery", () => {
	it("treats a bare URL as every status: no filter param, no status filter sent", () => {
		const state = MFA_RECOVERY_URL_STATE.parse({});
		const input = toMfaRecoveryListQuery(state);
		expect(state.status).toBeUndefined();
		expect(input).toEqual({ page: 1, limit: 20 });
		expect(AdminMfaRecoveryListQuerySchema.safeParse(input).success).toBe(true);
		expect(MFA_RECOVERY_URL_STATE.serialize(state)).toBe("");
	});

	it("filters by a status named in the URL, and pending links say so explicitly", () => {
		const state = MFA_RECOVERY_URL_STATE.parse({ "filter[status]": "PENDING" });
		expect(toMfaRecoveryListQuery(state)).toEqual({ page: 1, limit: 20, filter: { status: { eq: "PENDING" } } });
		expect(MFA_RECOVERY_PENDING_QUEUE_HREF).toBe("/users/mfa-recovery?filter[status]=PENDING");
	});

	it("has no 'all' sentinel: ?filter[status]=all reads as no filter", () => {
		expect(MFA_RECOVERY_URL_STATE.parse({ "filter[status]": "all" }).status).toBeUndefined();
	});

	it("reads the selected request id and drops an invalid one", () => {
		expect(MFA_RECOVERY_URL_STATE.parse({ requestId: UUID }).requestId).toBe(UUID);
		expect(MFA_RECOVERY_URL_STATE.parse({ requestId: "1 OR 1=1" }).requestId).toBeUndefined();
		expect(MFA_RECOVERY_URL_STATE.parse({ "filter[status]": "unknown" }).status).toBeUndefined();
	});
});

describe("in-page selection", () => {
	it("KYB review: ?organizationId= must be a merchant id (UUID)", () => {
		expect(KYB_REVIEW_URL_STATE.parse({ organizationId: UUID })).toEqual({ organizationId: UUID });
		expect(KYB_REVIEW_URL_STATE.parse({ organizationId: "org-1" })).toEqual({ organizationId: undefined });
		expect(KYB_REVIEW_URL_STATE.href("/merchants/verification", { organizationId: UUID })).toBe(`/merchants/verification?organizationId=${UUID}`);
	});

	it("email templates: ?key= must be a known template key", () => {
		expect(EMAIL_TEMPLATES_URL_STATE.parse({ key: "welcome" })).toEqual({ key: "welcome" });
		expect(EMAIL_TEMPLATES_URL_STATE.parse({ key: "../../etc" })).toEqual({ key: undefined });
	});

	it("store requests: ?requestId= must be a request id (UUID)", () => {
		expect(STORE_REQUESTS_URL_STATE.parse({ requestId: [UUID, "ignored"] })).toEqual({ requestId: UUID });
		expect(STORE_REQUESTS_URL_STATE.parse({ requestId: "x" })).toEqual({ requestId: undefined });
	});
});
