import "reflect-metadata";
import { Controller, HttpStatus, Module, Post } from "@nestjs/common";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import type { OpenAPIObject, OperationObject, ParameterObject, ReferenceObject } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { buildOpenApiDocument } from "../api-docs";
import { ZodBody, ZodParam, ZodParams, ZodQuery } from "./zod-request.decorators";

const ProbeBodySchema = z
	.object({
		email: z.email().meta({ description: "Contact email", example: "probe@example.com" }),
		quantity: z.number().int().min(1).max(10).default(1),
	})
	.strict();
const ProbeQuerySchema = z.object({
	sort: z.enum(["asc", "desc"]).optional().describe("Sort direction"),
	search: z.string().min(1),
});
const ProbeParamsSchema = z.object({ tenant: z.string().min(3) }).strict();
const ProbeIdSchema = z.uuid();

/** What the probe handler echoes back — exactly the values the pipes produced. */
interface ProbeEcho {
	readonly body: z.output<typeof ProbeBodySchema>;
	readonly query: z.output<typeof ProbeQuerySchema>;
	readonly id: string;
}

/**
 * Decorators are applied programmatically (vitest transpiles without
 * `emitDecoratorMetadata`), with `design:paramtypes` defined by hand the way
 * the TypeScript compiler emits it for the real controllers.
 */
class ProbeController {
	public create(body: z.output<typeof ProbeBodySchema>, query: z.output<typeof ProbeQuerySchema>, id: string): ProbeEcho {
		return { body, query, id };
	}

	public byTenant(params: z.output<typeof ProbeParamsSchema>): z.output<typeof ProbeParamsSchema> {
		return params;
	}
}

function decorateProbeController(): void {
	const prototype: ProbeController = ProbeController.prototype;
	Reflect.defineMetadata("design:paramtypes", [Object, Object, String], prototype, "create");
	Reflect.defineMetadata("design:paramtypes", [Object], prototype, "byTenant");
	ZodBody(ProbeBodySchema)(prototype, "create", 0);
	ZodQuery(ProbeQuerySchema)(prototype, "create", 1);
	ZodParam("id", ProbeIdSchema)(prototype, "create", 2);
	ZodParams(ProbeParamsSchema)(prototype, "byTenant", 0);
	const create: PropertyDescriptor | undefined = Object.getOwnPropertyDescriptor(prototype, "create");
	const byTenant: PropertyDescriptor | undefined = Object.getOwnPropertyDescriptor(prototype, "byTenant");
	if (create === undefined || byTenant === undefined) throw new Error("probe handlers missing");
	Post(":id")(prototype, "create", create);
	Post("tenants/:tenant")(prototype, "byTenant", byTenant);
	Controller("probe")(ProbeController);
}

decorateProbeController();

class ProbeModule {}
Module({ controllers: [ProbeController] })(ProbeModule);

const PROBE_ID = "3f1c2a4e-8b7d-4c6e-9a1f-2b3c4d5e6f70";

function isParameter(parameter: ParameterObject | ReferenceObject): parameter is ParameterObject {
	return !("$ref" in parameter);
}

function operation(document: OpenAPIObject, path: string): OperationObject {
	const found: OperationObject | undefined = document.paths[path]?.post;
	if (found === undefined) throw new Error(`missing operation POST ${path}`);
	return found;
}

describe("Zod request decorators", () => {
	let app: NestFastifyApplication;
	let document: OpenAPIObject;

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [ProbeModule] }).compile();
		app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
		await app.init();
		await app.getHttpAdapter().getInstance().ready();
		document = buildOpenApiDocument(app);
	});

	afterAll(async () => {
		await app.close();
	});

	describe("validation (unchanged ZodValidationPipe behaviour)", () => {
		it("passes valid input through, with schema defaults applied", async () => {
			const response = await app.inject({ method: "POST", url: `/probe/${PROBE_ID}?search=abc`, payload: { email: "a@example.com" } });

			expect(response.statusCode).toBe(HttpStatus.CREATED);
			expect(response.json()).toEqual({ body: { email: "a@example.com", quantity: 1 }, query: { search: "abc" }, id: PROBE_ID });
		});

		it("rejects an invalid body with the { message, errors, statusCode } validation contract", async () => {
			const response = await app.inject({ method: "POST", url: `/probe/${PROBE_ID}?search=abc`, payload: { email: "nope", quantity: 99, extra: true } });

			expect(response.statusCode).toBe(HttpStatus.BAD_REQUEST);
			const body = z
				.object({
					message: z.literal("Validation failed"),
					statusCode: z.literal(HttpStatus.BAD_REQUEST),
					errors: z.array(z.object({ path: z.string(), message: z.string(), code: z.string() })),
				})
				.parse(response.json());
			expect(body.errors.map((error): string => error.code)).toEqual(expect.arrayContaining(["format", "maximum", "additionalProperties"]));
		});

		it("rejects an invalid query, named path param and params object", async () => {
			const missingQuery = await app.inject({ method: "POST", url: `/probe/${PROBE_ID}`, payload: { email: "a@example.com" } });
			const badId = await app.inject({ method: "POST", url: "/probe/not-a-uuid?search=abc", payload: { email: "a@example.com" } });
			const badTenant = await app.inject({ method: "POST", url: "/probe/tenants/ab" });

			expect([missingQuery.statusCode, badId.statusCode, badTenant.statusCode]).toEqual([HttpStatus.BAD_REQUEST, HttpStatus.BAD_REQUEST, HttpStatus.BAD_REQUEST]);
		});
	});

	describe("documentation (OpenAPI derived from the same schema)", () => {
		it("documents the body with required fields, bounds, defaults, descriptions and examples", () => {
			// toMatchObject: subset match per property (zod adds the email `pattern`); arrays match exactly.
			expect(operation(document, "/probe/{id}").requestBody).toMatchObject({
				required: true,
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: {
								email: { type: "string", format: "email", description: "Contact email", example: "probe@example.com" },
								quantity: { type: "integer", minimum: 1, maximum: 10, default: 1 },
							},
							required: ["email"],
							additionalProperties: false,
						},
					},
				},
			});
		});

		it("expands the query object into one documented parameter per key", () => {
			const query: readonly ParameterObject[] = (operation(document, "/probe/{id}").parameters ?? [])
				.filter(isParameter)
				.filter((parameter: ParameterObject): boolean => parameter.in === "query");

			expect(query.map((parameter: ParameterObject): string => parameter.name).sort()).toEqual(["search", "sort"]);
			expect(query.find((parameter: ParameterObject): boolean => parameter.name === "sort")).toMatchObject({
				required: false,
				description: "Sort direction",
				schema: { type: "string", enum: ["asc", "desc"] },
			});
			expect(query.find((parameter: ParameterObject): boolean => parameter.name === "search")).toMatchObject({ required: true, schema: { type: "string", minLength: 1 } });
		});

		it("documents a named path param and an expanded params object", () => {
			const idParameter = (operation(document, "/probe/{id}").parameters ?? []).filter(isParameter).find((parameter: ParameterObject): boolean => parameter.in === "path");
			const tenantParameter = (operation(document, "/probe/tenants/{tenant}").parameters ?? [])
				.filter(isParameter)
				.find((parameter: ParameterObject): boolean => parameter.in === "path");

			expect(idParameter).toMatchObject({ name: "id", required: true, schema: { type: "string", format: "uuid" } });
			expect(tenantParameter).toMatchObject({ name: "tenant", required: true, schema: { type: "string", minLength: 3 } });
		});
	});
});
