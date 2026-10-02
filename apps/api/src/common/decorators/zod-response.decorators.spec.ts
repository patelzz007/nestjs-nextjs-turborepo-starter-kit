import "reflect-metadata";
import { Controller, Get, HttpStatus, Logger, Module, Post } from "@nestjs/common";
import { HttpAdapterHost, Reflector } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import type { OpenAPIObject, OperationObject, ReferenceObject, ResponseObject, SchemaObject } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { ApiErrorResponseSchema, ApiPaginatedMetaSchema, ApiResponseMetaSchema, type PaginatedServiceResult } from "@workspace/shared";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { createTestTypedConfig } from "../../../test/support/test-api-env";
import { LogService } from "../../modules/logs/logs.service";
import { buildOpenApiDocument } from "../api-docs";
import { RequestContextService } from "../context/request-context";
import { GlobalExceptionFilter } from "../errors/global-exception.filter";
import { ResponseInterceptor } from "../interceptors/response.interceptor";
import { getResponseContract, ZodPaginatedResponse, ZodRawResponse, ZodResponse } from "./zod-response.decorators";

/** The public contract of the probe resource (what a client may see). */
const AccountSchema = z.object({
	id: z.uuid(),
	email: z.email(),
	createdAt: z.number().int().nonnegative(),
});
type Account = z.output<typeof AccountSchema>;

const ProbeHealthSchema = z.object({ status: z.literal("ok") });

const ACCOUNT: Account = { id: "3f1c2a4e-8b7d-4c6e-9a1f-2b3c4d5e6f70", email: "probe@example.com", createdAt: 1_790_812_800_000 };
/** A field that exists on the server-side row but must never reach the wire. */
const INTERNAL_SECRET = "$2b$12$internal-password-hash";
/** A value that violates the contract — it must not be echoed to the client either. */
const NOT_AN_EMAIL = "definitely-not-an-email";

let handlerRuns = 0;

class ProbeController {
	public account(): Account & { readonly passwordHash: string } {
		return { ...ACCOUNT, passwordHash: INTERNAL_SECRET };
	}

	public create(): Promise<Account> {
		return Promise.resolve(ACCOUNT);
	}

	public list(): PaginatedServiceResult<Account & { readonly passwordHash: string }> {
		return { items: [{ ...ACCOUNT, passwordHash: INTERNAL_SECRET }], limit: 20, total: 1, page: 1, totalPages: 1, nextCursor: null, hasNext: false, hasPrevious: false };
	}

	public broken(): Account {
		return { ...ACCOUNT, email: NOT_AN_EMAIL };
	}

	public health(): z.output<typeof ProbeHealthSchema> {
		return { status: "ok" };
	}

	public undocumented(): Account {
		handlerRuns += 1;
		return ACCOUNT;
	}
}

/** Typed descriptor of a probe method — what TypeScript hands a method decorator. */
function descriptorOf<TKey extends keyof ProbeController>(key: TKey): TypedPropertyDescriptor<ProbeController[TKey]> {
	const descriptor: TypedPropertyDescriptor<ProbeController[TKey]> | undefined = Object.getOwnPropertyDescriptor(ProbeController.prototype, key);
	if (descriptor === undefined) throw new Error(`probe handler ${key} missing`);
	return descriptor;
}

/** The probe handler function itself — the key `ExecutionContext.getHandler()` returns. */
function handlerOf<TKey extends keyof ProbeController>(key: TKey): ProbeController[TKey] {
	const handler: ProbeController[TKey] | undefined = descriptorOf(key).value;
	if (handler === undefined) throw new Error(`probe handler ${key} missing`);
	return handler;
}

// Decorators applied as calls — the unit-test transformer does not compile decorator syntax.
const prototype: ProbeController = ProbeController.prototype;
ZodResponse(AccountSchema, { description: "The account" })(prototype, "account", descriptorOf("account"));
ZodResponse(AccountSchema, { status: HttpStatus.CREATED })(prototype, "create", descriptorOf("create"));
ZodPaginatedResponse(AccountSchema)(prototype, "list", descriptorOf("list"));
ZodResponse(AccountSchema)(prototype, "broken", descriptorOf("broken"));
ZodRawResponse(ProbeHealthSchema)(prototype, "health", descriptorOf("health"));
Get("account")(prototype, "account", descriptorOf("account"));
Post("accounts")(prototype, "create", descriptorOf("create"));
Get("accounts")(prototype, "list", descriptorOf("list"));
Get("broken")(prototype, "broken", descriptorOf("broken"));
Get("health")(prototype, "health", descriptorOf("health"));
Get("undocumented")(prototype, "undocumented", descriptorOf("undocumented"));
Controller("probe")(ProbeController);

class ProbeModule {}
Module({ controllers: [ProbeController] })(ProbeModule);

function successResponse(document: OpenAPIObject, path: string, method: "get" | "post", status: string): ResponseObject {
	const item = document.paths[path];
	const operation: OperationObject | undefined = method === "get" ? item?.get : item?.post;
	const response: ResponseObject | ReferenceObject | undefined = operation?.responses[status];
	if (response === undefined || "$ref" in response) throw new Error(`missing ${status} response for ${method.toUpperCase()} ${path}`);
	return response;
}

function jsonSchemaOf(response: ResponseObject): SchemaObject {
	const schema: SchemaObject | ReferenceObject | undefined = response.content?.["application/json"]?.schema;
	if (schema === undefined || "$ref" in schema) throw new Error("expected an inline JSON schema");
	return schema;
}

describe("Zod response decorators", () => {
	let app: NestFastifyApplication;
	let document: OpenAPIObject;
	const logService = new LogService(createTestTypedConfig(), new RequestContextService());
	const errorLog = vi.spyOn(logService, "error");
	vi.spyOn(Logger.prototype, "error").mockImplementation((): void => undefined);

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [ProbeModule] }).compile();
		app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
		app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector), new RequestContextService()));
		app.useGlobalFilters(new GlobalExceptionFilter(app.get(HttpAdapterHost), logService, new RequestContextService(), createTestTypedConfig()));
		await app.init();
		await app.getHttpAdapter().getInstance().ready();
		document = buildOpenApiDocument(app);
	});

	afterAll(async () => {
		await app.close();
	});

	afterEach(() => {
		errorLog.mockClear();
	});

	describe("documentation (Swagger, from the same schema)", () => {
		it("documents the single success envelope with the data schema at the declared status", () => {
			const response = successResponse(document, "/probe/account", "get", "200");
			const schema = jsonSchemaOf(response);

			expect(response.description).toBe("The account");
			expect(schema).toMatchObject({ type: "object", required: ["success", "data", "meta"] });
			expect(schema.properties?.data).toMatchObject({ type: "object", required: ["id", "email", "createdAt"], properties: { email: { type: "string", format: "email" } } });
			expect(schema.properties?.meta).toMatchObject({ type: "object", properties: { correlationId: { type: "string" }, timestamp: { type: "integer" } } });
		});

		it("documents the paginated envelope: an item array plus pagination meta", () => {
			const schema = jsonSchemaOf(successResponse(document, "/probe/accounts", "get", "200"));

			expect(schema.properties?.data).toMatchObject({ type: "array", items: { type: "object", required: ["id", "email", "createdAt"] } });
			const meta: SchemaObject | ReferenceObject | undefined = schema.properties?.meta;
			expect(meta !== undefined && !("$ref" in meta) ? meta.required : []).toEqual(
				expect.arrayContaining(["limit", "total", "page", "totalPages", "nextCursor", "hasNext", "hasPrevious"]),
			);
		});

		it("documents a raw response without the envelope", () => {
			expect(jsonSchemaOf(successResponse(document, "/probe/health", "get", "200"))).toMatchObject({
				type: "object",
				required: ["status"],
				properties: { status: { enum: ["ok"] } },
			});
		});

		it("documents the declared non-default status, and only that success status", () => {
			const responses = document.paths["/probe/accounts"]?.post?.responses ?? {};

			expect(Object.keys(responses).sort()).toEqual(["201", "4XX", "5XX"]);
		});

		it("documents every 4XX / 5XX as the standard error envelope (ADR 016)", () => {
			for (const status of ["4XX", "5XX"]) {
				expect(jsonSchemaOfRef(successResponse(document, "/probe/account", "get", status))).toBe("#/components/schemas/ApiErrorResponseDto");
			}
		});

		it("never documents a response object as closed (additive fields must stay safe for clients)", () => {
			expect(JSON.stringify(jsonSchemaOf(successResponse(document, "/probe/account", "get", "200")))).not.toContain('"additionalProperties":false');
		});
	});

	describe("enforcement (ResponseInterceptor)", () => {
		it("sends the declared status and wraps the parsed data in the success envelope", async () => {
			const created = await app.inject({ method: "POST", url: "/probe/accounts" });

			expect(created.statusCode).toBe(HttpStatus.CREATED);
			const envelope = z
				.object({ success: z.literal(true), data: AccountSchema.strict(), meta: ApiResponseMetaSchema.strict() })
				.strict()
				.parse(created.json());
			expect(envelope.data).toEqual(ACCOUNT);
		});

		it("strips a field the contract does not declare — an internal value never reaches the wire", async () => {
			const response = await app.inject({ method: "GET", url: "/probe/account" });

			expect(response.statusCode).toBe(HttpStatus.OK);
			expect(response.body).not.toContain(INTERNAL_SECRET);
			expect(response.body).not.toContain("passwordHash");
			expect(z.object({ data: AccountSchema.strict() }).parse(response.json()).data).toEqual(ACCOUNT);
		});

		it("parses every list item and moves the pagination fields into meta", async () => {
			const response = await app.inject({ method: "GET", url: "/probe/accounts" });

			expect(response.body).not.toContain(INTERNAL_SECRET);
			const envelope = z
				.object({ success: z.literal(true), data: z.array(AccountSchema.strict()), meta: ApiPaginatedMetaSchema.strict() })
				.strict()
				.parse(response.json());
			expect(envelope.data).toEqual([ACCOUNT]);
			expect(envelope.meta).toMatchObject({ limit: 20, total: 1, page: 1, totalPages: 1, nextCursor: null, hasNext: false, hasPrevious: false });
		});

		it("sends a raw contract's body without an envelope", async () => {
			const response = await app.inject({ method: "GET", url: "/probe/health" });

			expect(response.json()).toEqual({ status: "ok" });
		});

		it("answers a contract violation with a logged 500 standard error envelope that echoes nothing", async () => {
			const response = await app.inject({ method: "GET", url: "/probe/broken" });

			expect(response.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
			expect(ApiErrorResponseSchema.parse(response.json()).error.code).toBe("INTERNAL_ERROR");
			expect(response.body).not.toContain(NOT_AN_EMAIL);
			expect(errorLog).toHaveBeenCalledTimes(1);
			const metadata = z
				.object({ errorName: z.string(), errorMessage: z.string() })
				.parse(z.object({ metadata: z.looseObject({}) }).parse(errorLog.mock.calls[0]?.[1]).metadata);
			expect(metadata.errorName).toBe("ResponseContractViolationError");
			expect(metadata.errorMessage).toContain("ProbeController.broken");
			expect(metadata.errorMessage).toContain("email");
			expect(metadata.errorMessage).not.toContain(NOT_AN_EMAIL);
		});

		it("refuses a JSON route without a contract with a 500, before its handler runs", async () => {
			const response = await app.inject({ method: "GET", url: "/probe/undocumented" });

			expect(response.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
			expect(handlerRuns).toBe(0);
			expect(z.object({ metadata: z.object({ errorName: z.string() }).loose() }).parse(errorLog.mock.calls[0]?.[1]).metadata.errorName).toBe("MissingResponseContractError");
		});
	});

	describe("getResponseContract", () => {
		it("returns the registered contract for a decorated handler and nothing for an undecorated one", () => {
			expect(getResponseContract(handlerOf("list"))).toMatchObject({ kind: "paginated", schema: AccountSchema, status: HttpStatus.OK });
			expect(getResponseContract(handlerOf("create"))).toMatchObject({ kind: "single", schema: AccountSchema, status: HttpStatus.CREATED });
			expect(getResponseContract(handlerOf("undocumented"))).toBeUndefined();
		});
	});
});

function jsonSchemaOfRef(response: ResponseObject): string | undefined {
	const schema: SchemaObject | ReferenceObject | undefined = response.content?.["application/json"]?.schema;
	return schema !== undefined && "$ref" in schema ? schema.$ref : undefined;
}
