import { describe, expect, it } from "vitest";

import { PAYMENTS_PAGE_SIZE, PAYMENTS_URL_STATE, toPaymentsQuery } from "../payments";

describe("toPaymentsQuery", () => {
	it("asks for the first page, newest first, by default", () => {
		expect(toPaymentsQuery(PAYMENTS_URL_STATE.defaults)).toMatchObject({ page: 1, limit: PAYMENTS_PAGE_SIZE });
	});

	it("carries the page from the URL", () => {
		expect(toPaymentsQuery({ ...PAYMENTS_URL_STATE.defaults, page: 3 })).toMatchObject({ page: 3 });
	});
});
