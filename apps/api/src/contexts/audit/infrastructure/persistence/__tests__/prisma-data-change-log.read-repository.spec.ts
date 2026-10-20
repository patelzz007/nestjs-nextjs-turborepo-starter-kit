import { DataChangeLogListQuerySchema, type DataChangeLogListQuery } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { buildDataChangeLogListOrder, buildDataChangeLogListWhere } from "../prisma-data-change-log.read-repository";

const ACTOR_ID = "11111111-1111-4111-8111-111111111111";
const TENANT_ID = "33333333-3333-4333-8333-333333333333";

/** The query string as Fastify parses it (`filter[operation][eq]=UPDATE` → nested objects). */
type RawQuery = Readonly<Record<string, string | Readonly<Record<string, Readonly<Record<string, string>>>>>>;

function query(input: RawQuery): DataChangeLogListQuery {
	return DataChangeLogListQuerySchema.parse(input);
}

describe("buildDataChangeLogListWhere", () => {
	it("is unconditional without filters — change records are never soft-deleted", () => {
		expect(buildDataChangeLogListWhere(query({}))).toEqual({ AND: [] });
	});

	it("maps each whitelisted filter to exactly its column — identifiers compared exactly, so their indexes serve them", () => {
		const where = buildDataChangeLogListWhere(
			query({
				filter: {
					tableName: { eq: "User" },
					operation: { in: "UPDATE,DELETE" },
					actorKind: { eq: "UNATTRIBUTED" },
					actorUserId: { eq: ACTOR_ID },
					tenantId: { isNull: "false" },
					systemOperation: { eq: "geo.reference_data.write" },
					correlationId: { eq: "corr-1" },
					rowId: { eq: TENANT_ID },
					transactionId: { eq: "4242" },
					occurredAt: { gte: "1790812800000" },
				},
			}),
		);

		expect(where.AND).toEqual([
			{ tableName: { equals: "User" } },
			{ operation: { in: ["UPDATE", "DELETE"] } },
			{ actorKind: { equals: "UNATTRIBUTED" } },
			{ actorUserId: { equals: ACTOR_ID } },
			{ tenantId: { not: null } },
			{ systemOperation: { equals: "geo.reference_data.write" } },
			{ correlationId: { equals: "corr-1" } },
			{ rowId: { equals: TENANT_ID } },
			{ transactionId: { equals: 4242 } },
			{ occurredAt: { gte: 1_790_812_800_000 } },
		]);
	});

	it("searches a table-name prefix, or exactly a row id or a correlation id (all index-served)", () => {
		expect(buildDataChangeLogListWhere(query({ search: "reward" })).AND).toEqual([
			{ OR: [{ tableName: { startsWith: "reward" } }, { rowId: { equals: "reward" } }, { correlationId: { equals: "reward" } }] },
		]);
	});

	it("rejects a filter field the contract does not whitelist (the row images are not filterable)", () => {
		expect(() => query({ filter: { newData: { eq: "x" } } })).toThrow();
	});
});

describe("buildDataChangeLogListOrder", () => {
	it("defaults to newest first, tie-broken by the write sequence so one transaction's changes keep their order", () => {
		const order = buildDataChangeLogListOrder(query({}));

		expect(order.isDefault).toBe(true);
		expect(order.orderBy).toEqual([{ occurredAt: "desc" }, { changeSequence: "desc" }]);
	});

	it("sorts oldest first on request — how a request's changes read in order", () => {
		const order = buildDataChangeLogListOrder(query({ sort: "occurredAt" }));

		expect(order.isDefault).toBe(false);
		expect(order.orderBy).toEqual([{ occurredAt: "asc" }, { changeSequence: "asc" }]);
	});
});
