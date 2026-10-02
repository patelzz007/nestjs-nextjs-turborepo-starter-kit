import "reflect-metadata";
import { runInNewContext } from "node:vm";
import { Controller, Get, HttpStatus, Module } from "@nestjs/common";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { apiDocsPath } from "@workspace/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { Public } from "../modules/auth/decorators/public.decorator";
import {
	BEARER_SECURITY_SCHEME,
	buildOpenApiDocument,
	CLIENT_TYPE_HEADER,
	CLIENT_TYPE_SECURITY_SCHEME,
	setupApiDocs,
	SWAGGER_DEFAULT_CLIENT_TYPE,
	swaggerClientTypeInterceptor,
	type SwaggerUiRequest,
} from "./api-docs";

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

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [DocsProbeModule] }).compile();
		app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
		await app.init();
		setupApiDocs(app, buildOpenApiDocument(app));
		await app.getHttpAdapter().getInstance().ready();
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
