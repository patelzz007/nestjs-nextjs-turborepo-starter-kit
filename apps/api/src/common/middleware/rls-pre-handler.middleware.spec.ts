import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Controller, Get, Injectable, Module, type CanActivate, type MiddlewareConsumer, type NestModule } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";

import { currentRlsContextOrUnscoped } from "../../prisma/rls-context";
import { RlsPreHandlerMiddleware } from "./rls-pre-handler.middleware";

/** Records the RLS scope guards observe (guards run before any interceptor). */
const observed: { guardOperation: string | null } = { guardOperation: null };

class ScopeProbeGuard implements CanActivate {
	public async canActivate(): Promise<boolean> {
		await Promise.resolve();
		observed.guardOperation = currentRlsContextOrUnscoped().systemOperation;
		return true;
	}
}

class ProbeController {
	public probe(): { operation: string | null } {
		return { operation: currentRlsContextOrUnscoped().systemOperation };
	}
}

class ProbeModule implements NestModule {
	public configure(consumer: MiddlewareConsumer): void {
		consumer.apply(RlsPreHandlerMiddleware).forRoutes("*");
	}
}

// Decorators applied as calls — the unit-test transformer does not compile decorator syntax.
Injectable()(ScopeProbeGuard);
const probeDescriptor = Object.getOwnPropertyDescriptor(ProbeController.prototype, "probe");
if (probeDescriptor !== undefined) {
	Get()(ProbeController.prototype, "probe", probeDescriptor);
}
Controller("probe")(ProbeController);
Module({ controllers: [ProbeController], providers: [{ provide: APP_GUARD, useClass: ScopeProbeGuard }] })(ProbeModule);

describe("RlsPreHandlerMiddleware (Fastify integration)", () => {
	let app: NestFastifyApplication;

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [ProbeModule] }).compile();
		app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
		await app.init();
		await app.getHttpAdapter().getInstance().ready();
	});

	afterAll(async () => {
		await app.close();
	});

	it("gives guards an explicit request.pre_handler scope instead of an implicit bypass", async () => {
		const response = await app.inject({ method: "GET", url: "/probe" });

		expect(response.statusCode).toBe(200);
		expect(observed.guardOperation).toBe("request.pre_handler");
		expect(response.json()).toEqual({ operation: "request.pre_handler" });
	});
});
