import "reflect-metadata";
import { Controller, Get, HttpStatus, Module } from "@nestjs/common";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import type { OpenAPIObject, OperationObject, ParameterObject, ReferenceObject } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { defineListQuery, listFilter, ListSearchSchema } from "@workspace/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { buildOpenApiDocument } from "../api-docs";
import { ZodListQuery } from "./zod-request.decorators";

const ProbeStatusSchema = z.enum(["ACTIVE", "LOCKED"]);

const probeListQuery = defineListQuery({
	sortable: ["name", "createdAt"],
	defaultSort: [{ field: "createdAt", direction: "desc" }],
	filter: {
		status: listFilter.enumeration(ProbeStatusSchema, { eq: true, in: true }),
		price: listFilter.number({ gte: true, lte: true }),
	},
	params: { search: ListSearchSchema },
});
const ProbeListQuerySchema = probeListQuery.schema;
type ProbeListQuery = z.output<typeof ProbeListQuerySchema>;

/** Echoes the parsed list query so the test sees exactly what a handler receives. */
class ProbeListController {
	public list(query: ProbeListQuery): ProbeListQuery {
		return query;
	}
}

function decorateProbeListController(): void {
	const prototype: ProbeListController = ProbeListController.prototype;
	Reflect.defineMetadata("design:paramtypes", [Object], prototype, "list");
	ZodListQuery(ProbeListQuerySchema)(prototype, "list", 0);
	const list: PropertyDescriptor | undefined = Object.getOwnPropertyDescriptor(prototype, "list");
	if (list === undefined) throw new Error("probe handler missing");
	Get()(prototype, "list", list);
	Controller("probe-list")(ProbeListController);
}

decorateProbeListController();

class ProbeListModule {}
Module({ controllers: [ProbeListController] })(ProbeListModule);

const ValidationBodySchema = z.object({ message: z.string(), errors: z.array(z.object({ path: z.string(), message: z.string() })) });

function isParameter(parameter: ParameterObject | ReferenceObject): parameter is ParameterObject {
	return !("$ref" in parameter);
}

describe("@ZodListQuery", () => {
	let app: NestFastifyApplication;
	let document: OpenAPIObject;

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [ProbeListModule] }).compile();
		app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
		await app.init();
		await app.getHttpAdapter().getInstance().ready();
		document = buildOpenApiDocument(app);
	});

	afterAll(async () => {
		await app.close();
	});

	async function get(url: string): Promise<{ readonly status: number; readonly body: string }> {
		const response = await app.inject({ method: "GET", url });
		return { status: response.statusCode, body: response.body };
	}

	it("nests bracket filter keys from the real Fastify query string and hands the handler the parsed AST", async () => {
		const response = await get("/probe-list?page=2&limit=5&sort=-name&search=%20bob%20&filter[status][in]=ACTIVE,LOCKED&filter[price][gte]=10");
		expect(response.status).toBe(HttpStatus.OK);
		expect(JSON.parse(response.body)).toEqual({
			page: 2,
			limit: 5,
			sort: "-name",
			search: "bob",
			filter: { status: { in: ["ACTIVE", "LOCKED"] }, price: { gte: 10 } },
		});
	});

	it("applies the defaults when the query string is empty", async () => {
		const response = await get("/probe-list");
		expect(JSON.parse(response.body)).toEqual({ page: 1, limit: 20 });
	});

	it.each([
		["an unknown sort field", "/probe-list?sort=passwordHash", "Unknown sort field 'passwordHash'"],
		["an unknown filter field", "/probe-list?filter[passwordHash]=x", "Unknown filter field(s): passwordHash"],
		["an operator the field does not allow", "/probe-list?filter[status][gte]=ACTIVE", "Allowed: eq, in"],
		["an unknown operator", "/probe-list?filter[status][like]=A", "Unknown filter operator 'like'"],
		["a wrongly typed value", "/probe-list?filter[price][gte]=cheap", "number"],
		["a cursor combined with a custom sort", "/probe-list?cursor=abc&sort=name", "Cursor pagination follows the default order"],
		["a legacy sortBy parameter", "/probe-list?sortBy=name", "sortBy"],
		["a prototype-pollution key", "/probe-list?filter[__proto__][polluted]=1", "__proto__"],
	])("rejects %s with a 400 validation body", async (_label: string, url: string, expected: string) => {
		const response = await get(url);
		expect(response.status).toBe(HttpStatus.BAD_REQUEST);
		const body = ValidationBodySchema.parse(JSON.parse(response.body));
		expect(body.message).toBe("Validation failed");
		expect(JSON.stringify(body.errors)).toContain(expected);
		expect(Object.prototype).not.toHaveProperty("polluted");
	});

	it("documents page, limit, cursor, sort, filter and search as query parameters", () => {
		const found: OperationObject | undefined = document.paths["/probe-list"]?.get;
		if (found === undefined) throw new Error("missing operation GET /probe-list");
		const names: readonly string[] = (found.parameters ?? []).filter(isParameter).map((parameter: ParameterObject): string => parameter.name);
		expect(names).toEqual(expect.arrayContaining(["page", "limit", "cursor", "sort", "filter", "search"]));
		const sort: ParameterObject | undefined = (found.parameters ?? []).filter(isParameter).find((parameter: ParameterObject): boolean => parameter.name === "sort");
		expect(sort?.description).toContain("Sortable: name, createdAt");
	});
});
