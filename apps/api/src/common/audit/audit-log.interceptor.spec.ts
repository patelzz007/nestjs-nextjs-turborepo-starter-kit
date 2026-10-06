import "reflect-metadata";
import { Body, Controller, Get, HttpCode, HttpStatus, Logger, Module, Post, Req } from "@nestjs/common";
import { SSE_METADATA } from "@nestjs/common/constants.js";
import { HttpAdapterHost, Reflector } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { ApiErrorResponseSchema, type DataValue, type JsonValue } from "@workspace/shared";
import type { FastifyRequest } from "fastify";
import { lastValueFrom, of, type Observable } from "rxjs";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { createAuditTrailDouble } from "../../../test/support/audit-trail-double";
import { createHttpContext, testRequest } from "../../../test/support/http-execution-context";
import { createTestTypedConfig } from "../../../test/support/test-api-env";
import { LogService } from "../../modules/logs/logs.service";
import { RequestContextService } from "../context/request-context";
import { HEALTH_PROBE_PATHS } from "../http/probe-routes";
import { GlobalExceptionFilter } from "../errors/global-exception.filter";
import { AuditLogInterceptor } from "./audit-log.interceptor";

const requestContext = new RequestContextService();
const { auditTrail, append } = createAuditTrailDouble(requestContext);

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

	public liveness(): { alive: boolean } {
		return { alive: true };
	}

	public async export(request: FastifyRequest): Promise<{ rows: number[] }> {
		await auditTrail.recordSensitiveRead(request, HttpStatus.OK, { released: { rows: 3 } });
		return { rows: [1, 2, 3] };
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
route("liveness", (d) => {
	Get(HEALTH_PROBE_PATHS.liveness)(ProbeController.prototype, "liveness", d);
});
route("export", (d) => {
	Get("export")(ProbeController.prototype, "export", d);
	Req()(ProbeController.prototype, "export", 0);
});
Controller()(ProbeController);
class ProbeModule {}
Module({ controllers: [ProbeController] })(ProbeModule);

describe("AuditLogInterceptor + GlobalExceptionFilter (one row per request)", () => {
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
				requestContext.run({ correlationId: "corr-probe", ip: undefined, userAgent: undefined, edgeLocation: undefined }, done);
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

	it("audits a read too: one SUCCEEDED GET row with the response it released", async () => {
		const response = await app.inject({ method: "GET", url: "/things" });

		expect(response.statusCode).toBe(HttpStatus.OK);
		expect(append).toHaveBeenCalledTimes(1);
		expect(append).toHaveBeenCalledWith(expect.objectContaining({ method: "GET", outcome: "SUCCEEDED", responseStatus: 200, responseBody: { ok: true } }));
	});

	it("writes a FAILED row for a read of a route that does not exist", async () => {
		await app.inject({ method: "GET", url: "/wp-login.php" });

		expect(append).toHaveBeenCalledWith(expect.objectContaining({ method: "GET", outcome: "FAILED", responseStatus: 404 }));
	});

	it("writes exactly ONE row for a sensitive read: the handler's summary, not the full response", async () => {
		const response = await app.inject({ method: "GET", url: "/export" });

		expect(response.statusCode).toBe(HttpStatus.OK);
		expect(append).toHaveBeenCalledTimes(1);
		expect(append).toHaveBeenCalledWith(expect.objectContaining({ method: "GET", responseBody: { released: { rows: 3 } } }));
	});

	it("does not audit the automated health probes", async () => {
		const response = await app.inject({ method: "GET", url: `/${HEALTH_PROBE_PATHS.liveness}` });

		expect(response.statusCode).toBe(HttpStatus.OK);
		expect(append).not.toHaveBeenCalled();
	});

	it("does not write a row per frame of an SSE stream", async () => {
		// Called directly: light-my-request's fake socket cannot carry a real SSE stream.
		const interceptor = new AuditLogInterceptor(new Reflector(), auditTrail);
		const firstFrame: DataValue = { data: { tick: 1 } };
		const lastFrame: DataValue = { data: { tick: 2 } };
		const frames: Observable<DataValue> = of(firstFrame, lastFrame);

		const handled = interceptor.intercept(createHttpContext(testRequest({ method: "GET" }), { [SSE_METADATA]: true }), { handle: () => frames });

		await expect(lastValueFrom(handled)).resolves.toEqual({ data: { tick: 2 } });
		expect(append).not.toHaveBeenCalled();
	});
});
