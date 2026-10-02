import { HttpStatus } from "@nestjs/common";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { HealthResponseSchema, type HealthResponse, type ReadinessResponse } from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../prisma/prisma.service";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";
import { createTestTypedConfig } from "../../../test/support/test-api-env";

/**
 * Serves `GET /<path>` through a real Nest + Fastify app routing to the given
 * controller, and validates the body against the shared contract. Used for the
 * deprecated `GET /health` alias: the route stays supported for uptime
 * monitors, so it is exercised as a route rather than as a method call.
 */
async function getThroughRouter(service: HealthService, path: string): Promise<HealthResponse> {
	const moduleRef = await Test.createTestingModule({ controllers: [HealthController], providers: [{ provide: HealthService, useValue: service }] }).compile();
	const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
	try {
		await app.init();
		await app.getHttpAdapter().getInstance().ready();
		const response = await app.inject({ method: "GET", url: `/${path}` });
		expect(response.statusCode).toBe(HttpStatus.OK);
		return HealthResponseSchema.parse(response.json());
	} finally {
		await app.close();
	}
}

describe("HealthController", () => {
	const service = new HealthService(new PrismaService(createTestTypedConfig()), []);
	const controller = new HealthController(service);

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns the welcome message", () => {
		expect(controller.getHello()).toBe("Hello from the Freebuff API!");
	});

	it("delegates GET /health/live to the liveness probe", () => {
		const liveness = vi.spyOn(service, "liveness");

		expect(controller.getLiveness().status).toBe("ok");
		expect(liveness).toHaveBeenCalledTimes(1);
	});

	it("delegates GET /health/ready to the readiness probe", async () => {
		const ready: ReadinessResponse = { status: "ready", checks: [], timestamp: service.liveness().timestamp };
		vi.spyOn(service, "readiness").mockResolvedValue(ready);

		await expect(controller.getReadiness()).resolves.toBe(ready);
	});

	it("delegates the legacy GET /health probe", async () => {
		const health = vi.spyOn(service, "healthCheck").mockResolvedValue({ status: "ok", db: "connected", timestamp: service.liveness().timestamp });

		await expect(getThroughRouter(service, "health")).resolves.toMatchObject({ status: "ok", db: "connected" });
		expect(health).toHaveBeenCalledTimes(1);
	});
});
