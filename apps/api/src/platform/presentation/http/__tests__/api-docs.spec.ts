import "reflect-metadata";
import { runInNewContext } from "node:vm";
import { Controller, Get, HttpStatus, Module } from "@nestjs/common";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import type { OpenAPIObject } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { apiDocsPath } from "@workspace/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { Public } from "../security/decorators/public.decorator";
import { ApiController, SinceApiVersion } from "../versioning/api-controller.decorator";
import { enableApiVersioning } from "../versioning/enable-api-versioning";
import {
	BEARER_SECURITY_SCHEME,
	buildOpenApiDocument,
	CLIENT_TYPE_HEADER,
	CLIENT_TYPE_SECURITY_SCHEME,
	setupApiDocs,
	SWAGGER_DEFAULT_CLIENT_TYPE,
	swaggerClientTypeInterceptor,
	type SwaggerUiRequest,
} from "../api-docs";

class DocsProbeController {
	public ping(): string {
		return "pong";
	}

	public status(): string {
		return "ok";
	}
}

const pingDescriptor: PropertyDescriptor | undefined = Object.getOwnPropertyDescriptor(DocsProbeController.prototype, "ping");
if (pingDescriptor === undefined) throw new Error("probe handler ping missing");
// Decorators applied as calls — the unit-test transformer does not compile decorator syntax.
Get("ping")(DocsProbeController.prototype, "ping", pingDescriptor);
const statusDescriptor: PropertyDescriptor | undefined = Object.getOwnPropertyDescriptor(DocsProbeController.prototype, "status");
if (statusDescriptor === undefined) throw new Error("probe handler status missing");
Public()(DocsProbeController.prototype, "status", statusDescriptor);
Get("status")(DocsProbeController.prototype, "status", statusDescriptor);
Controller("docs-probe")(DocsProbeController);

class DocsProbeModule {}
Module({ controllers: [DocsProbeController] })(DocsProbeModule);

const OpenApiHeadSchema = z.object({ openapi: z.string(), paths: z.record(z.string(), z.object({}).loose()) }).loose();

describe("setupApiDocs (public Swagger)", () => {
	let app: NestFastifyApplication;
	/** How many times Swagger asked for the document. */
	let builds = 0;

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [DocsProbeModule] }).compile();
		app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
		await app.init();
		setupApiDocs(app, (): OpenAPIObject => {
			builds += 1;
			return buildOpenApiDocument(app);
		});
		await app.getHttpAdapter().getInstance().ready();
	});

	it("builds the document on the first request for it, not when mounting, and only once", async () => {
		expect(builds).toBe(0);

		await app.inject({ method: "GET", url: `${apiDocsPath()}-json` });
		await app.inject({ method: "GET", url: `${apiDocsPath()}/swagger-ui-init.js` });
		await app.inject({ method: "GET", url: `${apiDocsPath()}-json` });

		expect(builds).toBe(1);
	});

	afterAll(async () => {
		await app.close();
	});

	it("serves the OpenAPI document to an anonymous request", async () => {
		const response = await app.inject({ method: "GET", url: `${apiDocsPath()}-json` });

		expect(response.statusCode).toBe(HttpStatus.OK);
		expect(Object.keys(OpenApiHeadSchema.parse(response.json()).paths)).toContain("/docs-probe/ping");
	});

	it("accepts the bearer token or the X-Client-Type session cookie on protected routes, and requires nothing on @Public() ones", () => {
		const document = buildOpenApiDocument(app);

		expect(document.paths["/docs-probe/ping"]?.get?.security).toEqual([{ [BEARER_SECURITY_SCHEME]: [] }, { [CLIENT_TYPE_SECURITY_SCHEME]: [] }]);
		expect(document.paths["/docs-probe/status"]?.get?.security).toEqual([{}, { [CLIENT_TYPE_SECURITY_SCHEME]: [] }]);
		expect(document.components?.securitySchemes?.[CLIENT_TYPE_SECURITY_SCHEME]).toMatchObject({ type: "apiKey", in: "header", name: CLIENT_TYPE_HEADER });
		expect(Object.keys(document.components?.securitySchemes ?? {})).toContain(BEARER_SECURITY_SCHEME);
	});

	it("ships the X-Client-Type interceptor to the browser in the Swagger UI init script", async () => {
		const response = await app.inject({ method: "GET", url: `${apiDocsPath()}/swagger-ui-init.js` });

		expect(response.statusCode).toBe(HttpStatus.OK);
		expect(response.body).toContain("requestInterceptor");
		expect(response.body).toContain(CLIENT_TYPE_HEADER);
	});

	it("serves the Swagger UI to an anonymous request", async () => {
		const response = await app.inject({ method: "GET", url: apiDocsPath() });

		expect(response.statusCode).toBe(HttpStatus.OK);
		expect(response.headers["content-type"]).toContain("text/html");
	});
});

/** A versioned controller: `ping` replaced in v2, `list` inherited by v2. */
class VersionedDocsProbeController {
	public ping(): string {
		return "pong v1";
	}

	public pingV2(): string {
		return "pong v2";
	}

	public list(): string {
		return "list";
	}
}

function probeHandler(name: string): PropertyDescriptor {
	const descriptor: PropertyDescriptor | undefined = Object.getOwnPropertyDescriptor(VersionedDocsProbeController.prototype, name);
	if (descriptor === undefined) throw new Error(`probe handler ${name} missing`);
	return descriptor;
}

Get("ping")(VersionedDocsProbeController.prototype, "ping", probeHandler("ping"));
Get("ping")(VersionedDocsProbeController.prototype, "pingV2", probeHandler("pingV2"));
SinceApiVersion("v2")(VersionedDocsProbeController.prototype, "pingV2", probeHandler("pingV2"));
Get("list")(VersionedDocsProbeController.prototype, "list", probeHandler("list"));
Public()(VersionedDocsProbeController.prototype, "list", probeHandler("list"));
ApiController("/product")(VersionedDocsProbeController);

class VersionedDocsProbeModule {}
Module({ controllers: [VersionedDocsProbeController, DocsProbeController] })(VersionedDocsProbeModule);

describe("buildOpenApiDocument (one document per API version)", () => {
	let app: NestFastifyApplication;

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [VersionedDocsProbeModule] }).compile();
		app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
		enableApiVersioning(app);
		await app.init();
	});

	afterAll(async () => {
		await app.close();
	});

	it("lists a version's own paths, the routes it inherits, and every unversioned path", () => {
		expect(Object.keys(buildOpenApiDocument(app, "v1").paths).sort()).toEqual(["/api/v1/product/list", "/api/v1/product/ping", "/docs-probe/ping", "/docs-probe/status"]);
		expect(Object.keys(buildOpenApiDocument(app, "v2").paths).sort()).toEqual(["/api/v2/product/list", "/api/v2/product/ping", "/docs-probe/ping", "/docs-probe/status"]);
	});

	it("names each operation after its handler, without a version suffix", () => {
		const v1 = buildOpenApiDocument(app, "v1");
		const v2 = buildOpenApiDocument(app, "v2");

		expect(v1.paths["/api/v1/product/ping"]?.get?.operationId).toBe("VersionedDocsProbeController_ping");
		expect(v2.paths["/api/v2/product/ping"]?.get?.operationId).toBe("VersionedDocsProbeController_pingV2");
		expect(v2.paths["/api/v2/product/list"]?.get?.operationId).toBe("VersionedDocsProbeController_list");
	});

	it("keeps an inherited @Public() route public in the newer version's document", () => {
		expect(buildOpenApiDocument(app, "v2").paths["/api/v2/product/list"]?.get?.security).toEqual([{}, { [CLIENT_TYPE_SECURITY_SCHEME]: [] }]);
	});
});

describe("swaggerClientTypeInterceptor", () => {
	function request(headers: Record<string, string>): SwaggerUiRequest {
		return { headers: { ...headers } };
	}

	it("defaults to the admin session when Authorize holds no X-Client-Type", () => {
		expect(swaggerClientTypeInterceptor(request({})).headers[CLIENT_TYPE_HEADER]).toBe(SWAGGER_DEFAULT_CLIENT_TYPE);
		expect(swaggerClientTypeInterceptor(request({ [CLIENT_TYPE_HEADER]: " " })).headers[CLIENT_TYPE_HEADER]).toBe(SWAGGER_DEFAULT_CLIENT_TYPE);
	});

	it("keeps the session chosen under Authorize", () => {
		expect(swaggerClientTypeInterceptor(request({ [CLIENT_TYPE_HEADER]: "web" })).headers[CLIENT_TYPE_HEADER]).toBe("web");
	});

	it("is self-contained, so it still works after @nestjs/swagger serializes it to the browser", () => {
		// Evaluate the serialized source in an empty context (no module scope, like the browser) and call it there.
		const result = z.object({ headers: z.record(z.string(), z.string()) }).parse(runInNewContext(`(${swaggerClientTypeInterceptor.toString()})({ headers: {} })`));

		expect(result.headers[CLIENT_TYPE_HEADER]).toBe(SWAGGER_DEFAULT_CLIENT_TYPE);
	});
});
