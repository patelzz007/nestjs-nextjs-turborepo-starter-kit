import "reflect-metadata";
import { Body, Controller, Get, HttpCode, HttpStatus, Logger, Module, Post } from "@nestjs/common";
import { HttpAdapterHost, Reflector } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { ApiErrorResponseSchema, type JsonValue } from "@workspace/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { createAuditTrailDouble } from "../../../test/support/audit-trail-double";
import { createTestTypedConfig } from "../../../test/support/test-api-env";
import { LogService } from "../../modules/logs/logs.service";
import { RequestContextService } from "../context/request-context";
import { GlobalExceptionFilter } from "../errors/global-exception.filter";
import { AuditLogInterceptor } from "./audit-log.interceptor";

class ProbeController {
	public create(body: JsonValue): { created: JsonValue } {
		return { created: body };
	}

	public accept(): { accepted: boolean } {
		return { accepted: true };
	}

	public fail(): void {
		throw new Error("handler failure");
	}

	public read(): { ok: boolean } {
		return { ok: true };
	}
}

// Decorators applied as calls — the unit-test transformer does not compile decorator syntax.
function route(method: keyof ProbeController, decorate: (descriptor: PropertyDescriptor) => void): void {
	const descriptor = Object.getOwnPropertyDescriptor(ProbeController.prototype, method);
	if (descriptor === undefined) throw new Error(`Missing ${method}`);
	decorate(descriptor);
}
route("create", (d) => {
	Post("things")(ProbeController.prototype, "create", d);
	Body()(ProbeController.prototype, "create", 0);
});
route("accept", (d) => {
	Post("accept")(ProbeController.prototype, "accept", d);
	HttpCode(HttpStatus.ACCEPTED)(ProbeController.prototype, "accept", d);
});
route("fail", (d) => {
	Post("fail")(ProbeController.prototype, "fail", d);
});
route("read", (d) => {
	Get("things")(ProbeController.prototype, "read", d);
});
Controller()(ProbeController);
class ProbeModule {}
Module({ controllers: [ProbeController] })(ProbeModule);

describe("AuditLogInterceptor + GlobalExceptionFilter (one row per state-changing request)", () => {
	const requestContext = new RequestContextService();
	const { auditTrail, append } = createAuditTrailDouble(requestContext);
	let app: NestFastifyApplication;
	let loggerError: MockInstance<Logger["error"]>;

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [ProbeModule] }).compile();
		app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
		const config = createTestTypedConfig();
		app.useGlobalInterceptors(new AuditLogInterceptor(app.get(Reflector), auditTrail));
		app.useGlobalFilters(new GlobalExceptionFilter(app.get(HttpAdapterHost), new LogService(requestContext), requestContext, auditTrail, config));
		app
			.getHttpAdapter()
			.getInstance()
			.addHook("onRequest", (_request, _reply, done): void => {
				requestContext.run({ correlationId: "corr-probe", ip: undefined, userAgent: undefined }, done);
			});
		await app.init();
		await app.getHttpAdapter().getInstance().ready();
	});

	afterAll(async () => {
		await app.close();
	});

	beforeEach(() => {
		append.mockClear();
		append.mockResolvedValue();
		loggerError = vi.spyOn(Logger.prototype, "error").mockImplementation((): void => undefined);
	});

	afterEach(() => {
		// Only the logger spy: the repository spies belong to the shared double for the whole suite.
		loggerError.mockRestore();
	});

	it("writes one SUCCEEDED row with the route's success status (201 default for POST)", async () => {
		const response = await app.inject({ method: "POST", url: "/things", payload: { name: "a" } });

		expect(response.statusCode).toBe(HttpStatus.CREATED);
		expect(append).toHaveBeenCalledTimes(1);
		expect(append).toHaveBeenCalledWith(
			expect.objectContaining({ outcome: "SUCCEEDED", responseStatus: 201, endpoint: "/things", requestBody: { name: "a" }, responseBody: { created: { name: "a" } } }),
		);
	});

	it("uses the status declared with @HttpCode", async () => {
		await app.inject({ method: "POST", url: "/accept" });

		expect(append).toHaveBeenCalledWith(expect.objectContaining({ responseStatus: HttpStatus.ACCEPTED }));
	});

	it("turns the response into a 500 when the success row cannot be written (never a silent unaudited success)", async () => {
		append.mockRejectedValueOnce(new Error("db down"));

		const response = await app.inject({ method: "POST", url: "/things", payload: { name: "a" } });

		expect(response.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
		expect(ApiErrorResponseSchema.parse(response.json()).error.code).toBe("INTERNAL_ERROR");
	});

	it("writes one FAILED row (from the exception filter) for a handler failure", async () => {
		const response = await app.inject({ method: "POST", url: "/fail" });

		expect(response.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
		expect(append).toHaveBeenCalledTimes(1);
		expect(append).toHaveBeenCalledWith(expect.objectContaining({ outcome: "FAILED", responseStatus: 500, errorCode: "INTERNAL_ERROR" }));
	});

	it("writes a FAILED row for a request that never matched a route", async () => {
		const response = await app.inject({ method: "DELETE", url: "/nowhere" });

		expect(response.statusCode).toBe(HttpStatus.NOT_FOUND);
		expect(append).toHaveBeenCalledWith(expect.objectContaining({ outcome: "FAILED", responseStatus: 404, method: "DELETE" }));
	});

	it("writes nothing for a read", async () => {
		await app.inject({ method: "GET", url: "/things" });

		expect(append).not.toHaveBeenCalled();
	});
});
