import { describe, expect, it } from "vitest";

import { SESSIONS_URL_STATE, toSessionsQuery } from "../sessions-url-state";

describe("SESSIONS_URL_STATE", () => {
	it("reads its own devices* keys and leaves the page's other keys alone", () => {
		const state = SESSIONS_URL_STATE.parse(new URLSearchParams("devicesPage=2&devicesCursor=abc&page=7"));

		expect(state).toMatchObject({ page: 2, cursor: "abc", limit: 20, sort: undefined });
		expect(SESSIONS_URL_STATE.serialize({ ...state, page: 3, cursor: undefined }, new URLSearchParams("page=7"))).toBe("page=7&devicesPage=3");
	});

	it("falls back to the first page for a bad value and omits defaults", () => {
		const state = SESSIONS_URL_STATE.parse(new URLSearchParams("devicesPage=zero&devicesLimit=500&devicesSort=-ipAddress"));

		expect(state).toMatchObject({ page: 1, limit: 20, sort: undefined });
		expect(SESSIONS_URL_STATE.serialize(state, new URLSearchParams())).toBe("");
	});
});

describe("toSessionsQuery", () => {
	it("builds the GET /auth/sessions input, keeping the cursor only in the default order", () => {
		expect(toSessionsQuery({ page: 2, limit: 20, cursor: "abc", sort: undefined })).toEqual({ page: 2, limit: 20, cursor: "abc" });
		expect(toSessionsQuery({ page: 2, limit: 20, cursor: "abc", sort: "createdAt" })).toEqual({ page: 2, limit: 20, sort: "createdAt" });
	});
});
