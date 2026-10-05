// ── OpenAPI document regression guard ────────────────────────────────────
// Builds the REAL OpenAPI document (the same `buildOpenApiDocument` bootstrap
// serves at `/v1/docs-json`) from the real AppModule, then scans every
// controller's route-argument metadata. Every `@Body` / `@Query` / `@Param`
// input must be:
//   - validated by `ZodValidationPipe`, AND
//   - documented from the same zod schema (the Zod request decorators in
//     src/common/decorators/zod-request.decorators.ts attach it),
// and the matching operation must actually carry the `requestBody` / query /
// path parameters. A future endpoint that uses a bare `@Body()` or
// `@Body(new ZodValidationPipe(X))` (validated but invisible in Swagger)
// fails here, naming the handler.
//
// Responses (ADR 022): every JSON route must carry a response contract
// (`@ZodResponse` / `@ZodPaginatedResponse` / `@ZodRawResponse`) that is
// documented with its success status and the 4XX/5XX error envelope, never
// declares a closed (`.strict()`) object, and — for every `apiContract` leaf —
// uses the very schema the typed client parses with.
import { HTTP_CODE_METADATA, METHOD_METADATA, ROUTE_ARGS_METADATA, SSE_METADATA } from "@nestjs/common/constants.js";
import { RouteParamtypes } from "@nestjs/common/enums/route-paramtypes.enum.js";
import { MetadataScanner, ModulesContainer } from "@nestjs/core";
import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import type { OpenAPIObject, OperationObject, ParameterObject, PathItemObject, ReferenceObject, RequestBodyObject, ResponseObject, SchemaObject } from "@nestjs/swagger";
import { API_VERSION, ApiAccessSchema, apiContract, apiVersionPrefix } from "@workspace/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { BEARER_SECURITY_SCHEME, buildOpenApiDocument, CLIENT_TYPE_SECURITY_SCHEME, collectPublicOperationIds } from "../src/common/api-docs";
import { SKIP_ENVELOPE } from "../src/common/decorators/skip-envelope.decorator";
import {
	getFileResponseContract,
	getResponseContract,
	type FileResponseContract,
	type ResponseContractTarget,
	type RouteResponseContract,
} from "../src/common/decorators/zod-response.decorators";
import { zodToOpenApi } from "../src/common/openapi/zod-openapi-schema";
import { ZodValidationPipe } from "../src/common/pipes/zod-validation.pipe";
import { createE2eApp } from "./e2e-helpers";

type HttpMethod = "get" | "put" | "post" | "delete" | "patch";
const HTTP_METHODS: readonly HttpMethod[] = ["get", "put", "post", "delete", "patch"];

interface LocatedOperation {
	readonly label: string;
	readonly path: string;
	readonly operation: OperationObject;
}

/** One validated-input route argument read from Nest's route metadata. */
interface RequestInputArgument {
	readonly handler: string;
	readonly source: "body" | "query" | "path";
	readonly name: string | undefined;
	readonly schema: z.ZodType | undefined;
	readonly validatedByZodPipe: boolean;
}

/** Nest's `ROUTE_ARGS_METADATA` entry for a `@Body` / `@Query` / `@Param` argument. */
const RouteArgumentSchema = z.object({
	data: z.string().optional(),
	schema: z.instanceof(z.ZodType).optional(),
	// Pipes are instances or classes; `z.instanceof(Object)` keeps their identity for the instanceof check.
	pipes: z.array(z.instanceof(Object)),
});

const SOURCE_BY_PARAMTYPE: ReadonlyMap<number, RequestInputArgument["source"]> = new Map([
	[RouteParamtypes.BODY, "body"],
	[RouteParamtypes.QUERY, "query"],
	[RouteParamtypes.PARAM, "path"],
]);

function collectOperations(document: OpenAPIObject): ReadonlyMap<string, LocatedOperation> {
	const operations = new Map<string, LocatedOperation>();
	for (const [path, item] of Object.entries(document.paths)) {
		for (const method of HTTP_METHODS) {
			const operation: OperationObject | undefined = operationOf(item, method);
			if (operation?.operationId !== undefined) {
				operations.set(operation.operationId, { label: `${method.toUpperCase()} ${path}`, path, operation });
			}
		}
	}
	return operations;
}

function operationOf(item: PathItemObject, method: HttpMethod): OperationObject | undefined {
	switch (method) {
		case "get":
			return item.get;
		case "put":
			return item.put;
		case "post":
			return item.post;
		case "delete":
			return item.delete;
		case "patch":
			return item.patch;
	}
}

/** Every `@Body` / `@Query` / `@Param` argument of every registered controller handler, keyed by operationId. */
function collectRequestInputs(app: NestFastifyApplication): ReadonlyMap<string, readonly RequestInputArgument[]> {
	const scanner = new MetadataScanner();
	const inputs = new Map<string, RequestInputArgument[]>();
	for (const module of app.get(ModulesContainer).values()) {
		for (const wrapper of module.controllers.values()) {
			const instance: object = wrapper.instance;
			const controller: string = instance.constructor.name;
			for (const methodName of scanner.getAllMethodNames(instance)) {
				const routeArguments = z.record(z.string(), z.object({}).loose()).parse(Reflect.getMetadata(ROUTE_ARGS_METADATA, instance.constructor, methodName) ?? {});
				for (const [key, raw] of Object.entries(routeArguments)) {
					const source: RequestInputArgument["source"] | undefined = SOURCE_BY_PARAMTYPE.get(Number(key.split(":", 1)[0]));
					if (source === undefined) continue;
					const argument = RouteArgumentSchema.parse(raw);
					const operationId = `${controller}_${methodName}`;
					const list: RequestInputArgument[] = inputs.get(operationId) ?? [];
					list.push({
						handler: `${controller}.${methodName}`,
						source,
						name: argument.data,
						schema: argument.schema,
						validatedByZodPipe: argument.pipes.some((pipe: object): boolean => pipe instanceof ZodValidationPipe),
					});
					inputs.set(operationId, list);
				}
			}
		}
	}
	return inputs;
}

/** One registered route handler and its response contract (if any). */
interface RouteHandler {
	readonly operationId: string;
	readonly handler: string;
	/** Streams / binary downloads write their own reply and carry no JSON contract. */
	readonly isPassThrough: boolean;
	readonly contract: RouteResponseContract | undefined;
	/** A declared file download (`@ZodFileResponse`): its media types — the body is the file, not JSON. */
	readonly fileContract: FileResponseContract | undefined;
	/** `@HttpCode` on the handler — the response decorators set it from the contract. */
	readonly httpCode: number | undefined;
}

const HandlerFunctionSchema = z.custom<ResponseContractTarget>((value) => typeof value === "function", "route handler function");

/** Every HTTP route handler of every registered controller, keyed by operationId. */
function collectRouteHandlers(app: NestFastifyApplication): ReadonlyMap<string, RouteHandler> {
	const scanner = new MetadataScanner();
	const handlers = new Map<string, RouteHandler>();
	for (const module of app.get(ModulesContainer).values()) {
		for (const wrapper of module.controllers.values()) {
			const instance: object = wrapper.instance;
			const prototype: object | null = Reflect.getPrototypeOf(instance);
			if (prototype === null) continue;
			const controller: string = instance.constructor.name;
			for (const methodName of scanner.getAllMethodNames(prototype)) {
				const handler: ResponseContractTarget = HandlerFunctionSchema.parse(Object.getOwnPropertyDescriptor(prototype, methodName)?.value);
				if (Reflect.getMetadata(METHOD_METADATA, handler) === undefined) continue;
				const operationId = `${controller}_${methodName}`;
				handlers.set(operationId, {
					operationId,
					handler: `${controller}.${methodName}`,
					isPassThrough: Reflect.getMetadata(SSE_METADATA, handler) === true || Reflect.getMetadata(SKIP_ENVELOPE, handler) === true,
					contract: getResponseContract(handler),
					fileContract: getFileResponseContract(handler),
					httpCode: z.number().int().optional().parse(Reflect.getMetadata(HTTP_CODE_METADATA, handler)),
				});
			}
		}
	}
	return handlers;
}

/** One `apiContract` leaf — the half the typed client parses responses with. */
const ContractLeafSchema = z.object({
	method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
	path: z.string(),
	version: z.enum(["v1", "v2"]).optional(),
	access: ApiAccessSchema.optional(),
	response: z.discriminatedUnion("kind", [
		z.object({ kind: z.enum(["single", "paginated"]), schema: z.instanceof(z.ZodType) }),
		z.object({ kind: z.literal("file"), contentTypes: z.array(z.string()) }),
	]),
});
const ContractBranchSchema = z.record(z.string(), z.instanceof(Object));

interface ContractLeaf extends z.output<typeof ContractLeafSchema> {
	readonly name: string;
}

function collectContractLeaves(node: z.output<typeof ContractBranchSchema>, prefix: string, leaves: ContractLeaf[]): readonly ContractLeaf[] {
	for (const [key, value] of Object.entries(node)) {
		const leaf = ContractLeafSchema.safeParse(value);
		if (leaf.success) leaves.push({ name: `${prefix}${key}`, ...leaf.data });
		else collectContractLeaves(ContractBranchSchema.parse(value), `${prefix}${key}.`, leaves);
	}
	return leaves;
}

/** The OpenAPI path of a contract leaf: version prefix + `:param` → `{param}`. */
function documentPathOf(leaf: ContractLeaf): string {
	return `${apiVersionPrefix(leaf.version ?? API_VERSION)}${leaf.path.replace(/:(\w+)/g, "{$1}")}`;
}

/** The documented 2xx status codes of an operation. */
function successStatusesOf(operation: OperationObject): readonly string[] {
	return Object.keys(operation.responses).filter((status: string): boolean => /^2\d\d$/.test(status));
}

function isReference(value: SchemaObject | ReferenceObject | RequestBodyObject | ParameterObject): value is ReferenceObject {
	return "$ref" in value;
}

function jsonBodySchema(operation: OperationObject): SchemaObject | ReferenceObject | undefined {
	const body: RequestBodyObject | ReferenceObject | undefined = operation.requestBody;
	if (body === undefined || isReference(body)) return undefined;
	return body.content["application/json"]?.schema;
}

function documentedParameters(operation: OperationObject, location: "query" | "path"): ReadonlySet<string> {
	return new Set(
		(operation.parameters ?? [])
			.filter((parameter: ParameterObject | ReferenceObject): parameter is ParameterObject => !isReference(parameter) && parameter.in === location)
			.map((parameter: ParameterObject): string => parameter.name),
	);
}

/** Top-level keys an object schema documents (the parameters a `ZodQuery` / `ZodParams` schema expands to). */
function objectKeys(schema: z.ZodType): readonly string[] {
	const converted: SchemaObject | ReferenceObject = zodToOpenApi(schema).schema;
	return isReference(converted) ? [] : Object.keys(converted.properties ?? {});
}

/** True when a schema position carries real structure (not the `{}` "anything" placeholder). */
function isNonEmptySchema(schema: SchemaObject | ReferenceObject | undefined): boolean {
	if (schema === undefined) return false;
	if (isReference(schema)) return true;
	return schema.type !== undefined || schema.allOf !== undefined || schema.anyOf !== undefined || schema.oneOf !== undefined;
}

describe("OpenAPI document (e2e)", () => {
	let app: NestFastifyApplication;
	let document: OpenAPIObject;
	let operations: ReadonlyMap<string, LocatedOperation>;
	let inputs: ReadonlyMap<string, readonly RequestInputArgument[]>;
	let routes: ReadonlyMap<string, RouteHandler>;

	beforeAll(async () => {
		app = await createE2eApp();
		document = buildOpenApiDocument(app);
		operations = collectOperations(document);
		inputs = collectRequestInputs(app);
		routes = collectRouteHandlers(app);
	});

	afterAll(async () => {
		await app.close();
	});

	it("finds the controllers' request inputs (guards against a scan that silently sees nothing)", () => {
		const bodies: number = [...inputs.values()].flat().filter((input: RequestInputArgument): boolean => input.source === "body").length;
		expect(operations.size).toBeGreaterThan(100);
		expect(bodies).toBeGreaterThan(50);
	});

	it("validates every @Body / @Query / @Param with ZodValidationPipe AND attaches its zod schema for the docs", () => {
		const offenders: string[] = [...inputs.values()]
			.flat()
			.filter((input: RequestInputArgument): boolean => !input.validatedByZodPipe || input.schema === undefined)
			.map((input: RequestInputArgument): string => `${input.handler} (${input.source}${input.name === undefined ? "" : ` "${input.name}"`})`);
		expect(offenders).toEqual([]);
	});

	it("documents a non-empty JSON requestBody for every operation whose handler takes a body", () => {
		const missing: string[] = [];
		for (const [operationId, handlerInputs] of inputs) {
			if (!handlerInputs.some((input: RequestInputArgument): boolean => input.source === "body")) continue;
			const located: LocatedOperation | undefined = operations.get(operationId);
			if (located === undefined || !isNonEmptySchema(jsonBodySchema(located.operation))) missing.push(located?.label ?? operationId);
		}
		expect(missing).toEqual([]);
	});

	it("documents every query and path parameter the handler validates", () => {
		const missing: string[] = [];
		for (const [operationId, handlerInputs] of inputs) {
			const located: LocatedOperation | undefined = operations.get(operationId);
			if (located === undefined) {
				missing.push(`${operationId}: no operation in the document`);
				continue;
			}
			for (const input of handlerInputs) {
				if (input.source === "body" || input.schema === undefined) continue;
				const documented: ReadonlySet<string> = documentedParameters(located.operation, input.source);
				const expected: readonly string[] = input.name === undefined ? objectKeys(input.schema) : [input.name];
				for (const name of expected) {
					if (!documented.has(name)) missing.push(`${located.label}: ${input.source} "${name}"`);
				}
			}
		}
		expect(missing).toEqual([]);
	});

	it("validates the WHOLE params object: a ZodParams schema covers every {templated} segment of its route", () => {
		// `@ZodParams(schema)` validates `request.params` as one object; a strict
		// schema missing a segment rejects every request, a loose one leaves it unvalidated.
		const uncovered: string[] = [];
		for (const [operationId, handlerInputs] of inputs) {
			const located: LocatedOperation | undefined = operations.get(operationId);
			if (located === undefined) continue;
			for (const input of handlerInputs) {
				if (input.source !== "path" || input.name !== undefined || input.schema === undefined) continue;
				const keys: ReadonlySet<string> = new Set(objectKeys(input.schema));
				for (const match of located.path.matchAll(/\{([^}]+)\}/g)) {
					const segment: string | undefined = match[1];
					if (segment !== undefined && !keys.has(segment)) uncovered.push(`${located.label}: "${segment}"`);
				}
			}
		}
		expect(uncovered).toEqual([]);
	});

	it("documents a named @ZodParam / @ZodQuery value with a scalar schema, never an object", () => {
		const objectValued: string[] = [...inputs.values()]
			.flat()
			.filter(
				(input: RequestInputArgument): boolean => input.source !== "body" && input.name !== undefined && input.schema !== undefined && objectKeys(input.schema).length > 0,
			)
			.map((input: RequestInputArgument): string => `${input.handler} (${input.source} "${input.name ?? ""}")`);
		expect(objectValued).toEqual([]);
	});

	it("documents every {templated} path segment as a required path parameter", () => {
		const missing: string[] = [];
		for (const located of operations.values()) {
			const documented: ReadonlySet<string> = documentedParameters(located.operation, "path");
			for (const match of located.path.matchAll(/\{([^}]+)\}/g)) {
				const name: string | undefined = match[1];
				if (name !== undefined && !documented.has(name)) missing.push(`${located.label}: "${name}"`);
			}
		}
		expect(missing).toEqual([]);
	});

	describe("authentication (what Swagger UI sends on Try it out)", () => {
		it("declares security on every operation: none for @Public() routes, the bearer token for all others", () => {
			const publicIds: ReadonlySet<string> = collectPublicOperationIds(app);
			const wrong: string[] = [...operations.values()]
				.filter(({ operation }: LocatedOperation): boolean => {
					const expected =
						operation.operationId !== undefined && publicIds.has(operation.operationId)
							? [{}, { [CLIENT_TYPE_SECURITY_SCHEME]: [] }]
							: [{ [BEARER_SECURITY_SCHEME]: [] }, { [CLIENT_TYPE_SECURITY_SCHEME]: [] }];
					return JSON.stringify(operation.security) !== JSON.stringify(expected);
				})
				.map(({ label }: LocatedOperation): string => label);

			expect(publicIds.size).toBeGreaterThan(0);
			expect(wrong).toEqual([]);
		});

		it('marks an apiContract leaf access: "public" exactly when its handler is @Public() (the SSR caller relies on it)', () => {
			const publicIds: ReadonlySet<string> = collectPublicOperationIds(app);
			const byLabel = new Map<string, string>();
			for (const located of operations.values()) byLabel.set(located.label, located.operation.operationId ?? "");
			const drift: string[] = [];
			for (const leaf of collectContractLeaves(ContractBranchSchema.parse(apiContract), "", [])) {
				const operationId: string | undefined = byLabel.get(`${leaf.method} ${documentPathOf(leaf)}`);
				if (operationId === undefined) continue;
				const contractIsPublic: boolean = leaf.access === "public";
				if (contractIsPublic !== publicIds.has(operationId)) {
					drift.push(
						`${leaf.name}: contract says ${contractIsPublic ? "public" : "authenticated"}, handler ${operationId} is ${publicIds.has(operationId) ? "@Public()" : "protected"}`,
					);
				}
			}
			expect(drift).toEqual([]);
		});

		it("authenticates the admin audit log and roles endpoints by bearer or session cookie, and requires nothing on login", () => {
			const protectedSecurity = [{ [BEARER_SECURITY_SCHEME]: [] }, { [CLIENT_TYPE_SECURITY_SCHEME]: [] }];
			expect(document.paths["/api/v1/admin/audit"]?.get?.security).toEqual(protectedSecurity);
			expect(document.paths["/api/v1/admin/roles"]?.get?.security).toEqual(protectedSecurity);
			expect(document.paths["/api/v1/auth/login"]?.post?.security).toEqual([{}, { [CLIENT_TYPE_SECURITY_SCHEME]: [] }]);
		});
	});

	it("leaves no dangling $ref and no nestjs-zod internal markers in the document", () => {
		const serialized: string = JSON.stringify(document);
		const schemas: Readonly<Record<string, SchemaObject | ReferenceObject>> = document.components?.schemas ?? {};
		const dangling: string[] = [...serialized.matchAll(/"#\/components\/schemas\/([^"]+)"/g)]
			.map((match: RegExpExecArray): string => match[1] ?? "")
			.filter((name: string): boolean => !(name in schemas));
		expect([...new Set(dangling)]).toEqual([]);
		expect(serialized).not.toContain("x-nestjs_zod");
	});

	describe("response contracts (ADR 022)", () => {
		it("finds the route handlers (guards against a scan that silently sees nothing)", () => {
			expect(routes.size).toBe(operations.size);
		});

		it("gives every JSON route a response contract (only streams and binary downloads pass through)", () => {
			const missing: string[] = [...routes.values()]
				.filter((route: RouteHandler): boolean => !route.isPassThrough && route.contract === undefined && route.fileContract === undefined)
				.map((route: RouteHandler): string => route.handler);
			const passThrough: string[] = [...routes.values()].filter((route: RouteHandler): boolean => route.isPassThrough).map((route: RouteHandler): string => route.handler);
			expect(missing).toEqual([]);
			// The deliberate exclusions — adding one is a reviewed decision (docs/technical/api/response-contracts.md).
			expect(passThrough.sort()).toEqual(["EmailLogController.stream", "LocalStorageTransferController.localDownload", "LocalStorageTransferController.localPublic"]);
		});

		it("sends exactly the status the contract documents (no stray @HttpCode overriding it)", () => {
			const mismatched: string[] = [];
			for (const route of routes.values()) {
				const status: number | undefined = route.contract?.status ?? route.fileContract?.status;
				if (status !== undefined && route.httpCode !== status) mismatched.push(`${route.handler}: contract ${String(status)}, sends ${String(route.httpCode)}`);
			}
			expect(mismatched).toEqual([]);
		});

		it("documents one success response with a JSON schema, plus the 4XX / 5XX error envelope, for every contract route", () => {
			const problems: string[] = [];
			for (const route of routes.values()) {
				if (route.contract === undefined) continue;
				const located: LocatedOperation | undefined = operations.get(route.operationId);
				if (located === undefined) {
					problems.push(`${route.handler}: not in the document`);
					continue;
				}
				const successes: readonly string[] = successStatusesOf(located.operation);
				const documented: ResponseObject | ReferenceObject | undefined = located.operation.responses[String(route.contract.status)];
				if (successes.length !== 1 || documented === undefined || isReference(documented) || !isNonEmptySchema(documented.content?.["application/json"]?.schema)) {
					problems.push(`${located.label}: success response`);
				}
				for (const range of ["4XX", "5XX"]) {
					if (located.operation.responses[range] === undefined) problems.push(`${located.label}: ${range}`);
				}
			}
			expect(problems).toEqual([]);
		});

		it("documents every file download (@ZodFileResponse) as one binary 200 body per media type, plus the 4XX / 5XX error envelope", () => {
			const problems: string[] = [];
			const fileRoutes: readonly RouteHandler[] = [...routes.values()].filter((route: RouteHandler): boolean => route.fileContract !== undefined);
			for (const route of fileRoutes) {
				const located: LocatedOperation | undefined = operations.get(route.operationId);
				const contentTypes: readonly string[] = route.fileContract?.contentTypes ?? [];
				const documented: ResponseObject | ReferenceObject | undefined = located?.operation.responses["200"];
				if (located === undefined || documented === undefined || isReference(documented)) {
					problems.push(`${route.handler}: 200 response`);
					continue;
				}
				if (JSON.stringify(Object.keys(documented.content ?? {}).sort()) !== JSON.stringify([...contentTypes].sort())) problems.push(`${located.label}: media types`);
				for (const contentType of contentTypes) {
					if (JSON.stringify(documented.content?.[contentType]?.schema) !== JSON.stringify({ type: "string", format: "binary" }))
						problems.push(`${located.label}: ${contentType} body`);
				}
				for (const range of ["4XX", "5XX"]) {
					if (located.operation.responses[range] === undefined) problems.push(`${located.label}: ${range}`);
				}
			}
			expect(fileRoutes.map((route: RouteHandler): string => route.handler).sort()).toEqual([
				"OrganizationAnalyticsController.exportReport",
				"RewardsAdminAnalyticsController.exportReport",
			]);
			expect(problems).toEqual([]);
		});

		it("never uses a closed (.strict()) response schema — the API strips unknown keys and clients must tolerate additive fields", () => {
			const closed: string[] = [];
			for (const route of routes.values()) {
				if (route.contract === undefined) continue;
				const inputShape: string = JSON.stringify(z.toJSONSchema(route.contract.schema, { io: "input", unrepresentable: "any" }));
				if (inputShape.includes('"additionalProperties":false')) closed.push(route.handler);
			}
			expect(closed).toEqual([]);
		});

		it("uses, for every apiContract leaf, the exact response schema and envelope kind the typed client parses with", () => {
			const byOperation = new Map<string, string>();
			for (const located of operations.values()) byOperation.set(located.label, located.operation.operationId ?? "");
			const drift: string[] = [];
			for (const leaf of collectContractLeaves(ContractBranchSchema.parse(apiContract), "", [])) {
				const label = `${leaf.method} ${documentPathOf(leaf)}`;
				const route: RouteHandler | undefined = routes.get(byOperation.get(label) ?? "");
				if (leaf.response.kind === "file") {
					if (route?.fileContract === undefined) drift.push(`${leaf.name}: no @ZodFileResponse handler at ${label}`);
					else if (JSON.stringify(route.fileContract.contentTypes) !== JSON.stringify(leaf.response.contentTypes))
						drift.push(`${leaf.name} (${route.handler}): handler and contract declare different media types`);
					continue;
				}
				if (route?.contract === undefined) {
					drift.push(`${leaf.name}: no handler with a response contract at ${label}`);
					continue;
				}
				if (route.contract.kind !== leaf.response.kind || route.contract.schema !== leaf.response.schema)
					drift.push(`${leaf.name} (${route.handler}): handler and contract use different response schemas`);
			}
			expect(drift).toEqual([]);
		});
	});

	it("POST /api/v1/product documents the create body with required fields (snapshot)", () => {
		const schema = jsonBodySchema(requireOperation(operations, "ProductController_create"));
		expect(schema).toMatchObject({ type: "object", required: ["categoryId", "name", "price", "sku", "slug"], additionalProperties: false });
		expect(schema).toMatchSnapshot();
	});

	it("POST /api/v1/auth/login documents email + password with examples for Try-it-out (snapshot)", () => {
		const schema = jsonBodySchema(requireOperation(operations, "AuthController_login"));
		expect(schema).toMatchObject({
			type: "object",
			required: ["email", "password"],
			properties: { email: { type: "string", format: "email", example: "admin@example.com" }, password: { type: "string", example: "Admin@123" } },
		});
		expect(schema).toMatchSnapshot();
	});

	it("GET /api/v1/product documents the list query grammar (pagination, sort whitelist, filter, search)", () => {
		const parameters = (requireOperation(operations, "ProductController_list").parameters ?? []).filter(
			(parameter: ParameterObject | ReferenceObject): parameter is ParameterObject => !isReference(parameter) && parameter.in === "query",
		);
		const byName = (name: string): ParameterObject | undefined => parameters.find((parameter: ParameterObject): boolean => parameter.name === name);
		expect(byName("limit")).toMatchObject({ required: false, schema: { type: "integer", default: 20, maximum: 100 } });
		expect(byName("page")).toMatchObject({ required: false, schema: { type: "integer", default: 1, minimum: 1 } });
		expect(byName("sort")).toMatchObject({ required: false, schema: { type: "string" } });
		expect(byName("sort")?.description).toContain("Sortable: name, price, compareAtPrice, sku, slug, stockQuantity, createdAt");
		expect(byName("filter")).toMatchObject({ required: false });
		expect(byName("filter")?.description).toContain("Filterable: isActive, isFeatured, categoryId, brand, price, stockQuantity, createdAt");
		expect(byName("search")).toMatchObject({ required: false });
		// The pre-C1 parameter names are gone (docs/technical/api/list-queries.md, ADR 021).
		expect(byName("sortBy")).toBeUndefined();
		expect(byName("sortDirection")).toBeUndefined();
	});
});

function requireOperation(operations: ReadonlyMap<string, LocatedOperation>, operationId: string): OperationObject {
	const located: LocatedOperation | undefined = operations.get(operationId);
	if (located === undefined) throw new Error(`Operation ${operationId} is missing from the OpenAPI document`);
	return located.operation;
}
