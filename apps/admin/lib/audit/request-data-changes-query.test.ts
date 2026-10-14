import { DataChangeLogListQuerySchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { REQUEST_DATA_CHANGES_LIMIT, requestDataChangesQuery } from "./request-data-changes-query";

describe("requestDataChangesQuery", () => {
	it("asks for one page of the rows one request changed, oldest first, as the API accepts it", () => {
		const input = requestDataChangesQuery("corr-9", 2);

		expect(input).toEqual({ page: 2, limit: REQUEST_DATA_CHANGES_LIMIT, sort: "occurredAt", filter: { correlationId: { eq: "corr-9" } } });
		expect(DataChangeLogListQuerySchema.safeParse(input).success).toBe(true);
	});
});
