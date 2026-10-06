import { HttpAuditLogListQuerySchema, type HttpAuditLogListQuery } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { buildHttpAuditLogListOrder, buildHttpAuditLogListWhere } from "./http-audit-log.repository";

const ACTOR_ID = "11111111-1111-4111-8111-111111111111";

/** The query string as Fastify parses it (`filter[outcome][eq]=FAILED` → nested objects). */
type RawQuery = Readonly<Record<string, string | Readonly<Record<string, Readonly<Record<string, string>>>>>>;

function query(input: RawQuery): HttpAuditLogListQuery {
	return HttpAuditLogListQuerySchema.parse(input);
}

describe("buildHttpAuditLogListWhere", () => {
	it("is unconditional without filters — audit rows are never soft-deleted", () => {
		expect(buildHttpAuditLogListWhere(query({}))).toEqual({ AND: [] });
	});

	it("maps each whitelisted filter to exactly its column", () => {
		const where = buildHttpAuditLogListWhere(
			query({
				filter: {
					outcome: { eq: "FAILED" },
					method: { in: "POST,DELETE" },
					responseStatus: { gte: "400" },
					actorUserId: { eq: ACTOR_ID },
					impersonatorUserId: { isNull: "false" },
					occurredAt: { gte: "1790812800000" },
				},
			}),
		);

		expect(where.AND).toEqual([
			{ outcome: { equals: "FAILED" } },
			{ method: { in: ["POST", "DELETE"] } },
			{ responseStatus: { gte: 400 } },
			{ actorUserId: { equals: ACTOR_ID } },
			{ impersonatorUserId: { not: null } },
			{ occurredAt: { gte: 1_790_812_800_000 } },
		]);
	});

	it("maps the device, network and country filters", () => {
		const where = buildHttpAuditLogListWhere(
			query({ filter: { deviceType: { eq: "MOBILE" }, ipScope: { in: "PUBLIC,SHARED" }, browserName: { eq: "Safari" }, osName: { eq: "iOS" }, geoCountry: { eq: "MY" } } }),
		);

		expect(where.AND).toEqual([
			{ ipScope: { in: ["PUBLIC", "SHARED"] } },
			{ deviceType: { equals: "MOBILE" } },
			{ browserName: { equals: "Safari", mode: "insensitive" } },
			{ osName: { equals: "iOS", mode: "insensitive" } },
			{ geoCountry: { equals: "MY", mode: "insensitive" } },
		]);
	});

	it("filters anonymous requests by auth method IS NULL", () => {
		expect(buildHttpAuditLogListWhere(query({ filter: { authMethod: { isNull: "true" } } })).AND).toEqual([{ authMethod: { equals: null } }]);
	});

	it("searches the path, route template, correlation id, error code, IP address and User-Agent", () => {
		const where = buildHttpAuditLogListWhere(query({ search: "203.0.113" }));

		expect(where.AND).toEqual([
			{
				OR: [
					{ path: { contains: "203.0.113", mode: "insensitive" } },
					{ endpoint: { contains: "203.0.113", mode: "insensitive" } },
					{ correlationId: { equals: "203.0.113" } },
					{ errorCode: { contains: "203.0.113", mode: "insensitive" } },
					{ ipAddress: { startsWith: "203.0.113" } },
					{ userAgent: { contains: "203.0.113", mode: "insensitive" } },
				],
			},
		]);
	});

	it("rejects a filter field the contract does not whitelist", () => {
		expect(() => query({ filter: { requestBody: { eq: "x" } } })).toThrow();
	});
});

describe("buildHttpAuditLogListOrder", () => {
	it("defaults to newest first with the id as tie-breaker", () => {
		const order = buildHttpAuditLogListOrder(query({}));

		expect(order.isDefault).toBe(true);
		expect(order.orderBy).toEqual([{ occurredAt: "desc" }, { id: "desc" }]);
	});

	it("sorts by a whitelisted column on request", () => {
		const order = buildHttpAuditLogListOrder(query({ sort: "responseStatus" }));

		expect(order.isDefault).toBe(false);
		expect(order.orderBy).toEqual([{ responseStatus: "asc" }, { id: "asc" }]);
	});
});
