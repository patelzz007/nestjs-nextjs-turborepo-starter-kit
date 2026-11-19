import { Controller, Get, Module, Post } from "@nestjs/common";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { afterEach, describe, expect, it } from "vitest";

import { ApiController, ConflictingApiVersionsError, SinceApiVersion } from "../api-controller.decorator";
import { enableApiVersioning } from "../enable-api-versioning";

/**
 * Decorators are applied programmatically, as the other HTTP specs do: each method's decorators first, then the
 * class decorator — the order TypeScript applies them in a real controller.
 */
function handlerOf(prototype: object, name: string): PropertyDescriptor {
	const descriptor: PropertyDescriptor | undefined = Object.getOwnPropertyDescriptor(prototype, name);
	if (descriptor === undefined) throw new Error(`${name} is not a method`);
	return descriptor;
}

class RewardsProbeController {
	public get(): string {
		return "get v1";
	}

	public getV2(): string {
		return "get v2";
	}

	public list(): string {
		return "list";
	}

	public create(): string {
		return "create";
	}
}

const rewardsPrototype: object = RewardsProbeController.prototype;
Get(":id")(rewardsPrototype, "get", handlerOf(rewardsPrototype, "get"));
Get(":id")(rewardsPrototype, "getV2", handlerOf(rewardsPrototype, "getV2"));
SinceApiVersion("v2")(rewardsPrototype, "getV2", handlerOf(rewardsPrototype, "getV2"));
Get()(rewardsPrototype, "list", handlerOf(rewardsPrototype, "list"));
Post()(rewardsPrototype, "create", handlerOf(rewardsPrototype, "create"));
ApiController("/rewards")(RewardsProbeController);

/** Unversioned, like the health probe, the version manifest and the email webhook. */
class HealthProbeController {
	public check(): string {
		return "ok";
	}
}

const healthPrototype: object = HealthProbeController.prototype;
Get()(healthPrototype, "check", handlerOf(healthPrototype, "check"));
Controller("health")(HealthProbeController);

class VersioningProbeModule {}
Module({ controllers: [RewardsProbeController, HealthProbeController] })(VersioningProbeModule);

describe("ApiController", () => {
	let app: NestFastifyApplication | undefined;

	afterEach(async () => {
		await app?.close();
		app = undefined;
	});

	async function answer(method: "GET" | "POST", url: string): Promise<{ readonly status: number; readonly body: string }> {
		const moduleRef = await Test.createTestingModule({ imports: [VersioningProbeModule] }).compile();
		app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
		enableApiVersioning(app);
		await app.init();
		await app.getHttpAdapter().getInstance().ready();
		const response = await app.inject({ method, url });
		return { status: response.statusCode, body: response.body };
	}

	it("answers v1 with the v1 handler", async () => {
		expect(await answer("GET", "/api/v1/rewards/7")).toEqual({ status: 200, body: "get v1" });
	});

	it("answers v2 with the handler that replaces it", async () => {
		expect(await answer("GET", "/api/v2/rewards/7")).toEqual({ status: 200, body: "get v2" });
	});

	it("answers v2 with the v1 handler of a route v2 does not replace", async () => {
		expect(await answer("GET", "/api/v2/rewards")).toEqual({ status: 200, body: "list" });
		expect(await answer("POST", "/api/v2/rewards")).toEqual({ status: 201, body: "create" });
	});

	it("serves nothing under a version that does not exist", async () => {
		expect((await answer("GET", "/api/v3/rewards")).status).toBe(404);
	});

	it("serves no business route without a version", async () => {
		expect((await answer("GET", "/rewards")).status).toBe(404);
	});

	it("leaves a controller without versions at its own path", async () => {
		expect(await answer("GET", "/health")).toEqual({ status: 200, body: "ok" });
		expect((await answer("GET", "/api/v1/health")).status).toBe(404);
	});

	it("refuses two handlers of one route that start at the same version", () => {
		class ConflictingProbeController {
			public first(): string {
				return "first";
			}

			public second(): string {
				return "second";
			}
		}
		const prototype: object = ConflictingProbeController.prototype;
		Get()(prototype, "first", handlerOf(prototype, "first"));
		Get()(prototype, "second", handlerOf(prototype, "second"));

		expect(() => {
			ApiController("/rewards")(ConflictingProbeController);
		}).toThrow(ConflictingApiVersionsError);
	});
});
