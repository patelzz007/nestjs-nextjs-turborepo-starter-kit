import "reflect-metadata";
import { Controller, Get, HttpStatus, Module } from "@nestjs/common";
import { NestFactory, Reflector } from "@nestjs/core";
import { createObserveModule } from "@nestjs/observe";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { RequestContextService } from "../context/request-context";
import { ResponseInterceptor } from "../interceptors/response.interceptor";
import { ZodResponse } from "./zod-response.decorators";

/**
 * Regression: with `@nestjs/observe` instrumentation (on by default in
 * production — `OBSERVE_ENABLED`), `ExecutionContext.getHandler()` returns a
 * traced wrapper, not the decorated method. Observe copies only the
 * reflect-metadata onto that wrapper, so the response contract must live in
 * Nest metadata — an identity-keyed registry made every route answer
 * `500 MissingResponseContractError`.
 */

const GreetingSchema = z.object({ message: z.string() });
type Greeting = z.output<typeof GreetingSchema>;

class ObservedProbeController {
	public greet(): Greeting & { readonly internal: string } {
		return { message: "hello", internal: "never-on-the-wire" };
	}
}

function descriptorOf(): TypedPropertyDescriptor<ObservedProbeController["greet"]> {
	const descriptor: TypedPropertyDescriptor<ObservedProbeController["greet"]> | undefined = Object.getOwnPropertyDescriptor(ObservedProbeController.prototype, "greet");
	if (descriptor === undefined) throw new Error("probe handler greet missing");
	return descriptor;
}

// Decorators applied as calls — the unit-test transformer does not compile decorator syntax.
ZodResponse(GreetingSchema)(ObservedProbeController.prototype, "greet", descriptorOf());
Get("greet")(ObservedProbeController.prototype, "greet", descriptorOf());
Controller("observed")(ObservedProbeController);

class ObservedProbeModule {}
Module({ controllers: [ObservedProbeController] })(ObservedProbeModule);

describe("Zod response contracts under @nestjs/observe instrumentation", () => {
	let app: NestFastifyApplication;

	beforeAll(async () => {
		const { ObserveInstrument } = createObserveModule();
		if (ObserveInstrument === undefined) throw new Error("@nestjs/observe did not provide ObserveInstrument");
		app = await NestFactory.create<NestFastifyApplication>(ObservedProbeModule, new FastifyAdapter(), { instrument: ObserveInstrument, logger: false });
		app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector), new RequestContextService()));
		await app.init();
		await app.getHttpAdapter().getInstance().ready();
	});

	afterAll(async () => {
		await app.close();
	});

	it("finds the contract on the instrumented handler and enforces it", async () => {
		const response = await app.inject({ method: "GET", url: "/observed/greet" });

		expect(response.statusCode).toBe(HttpStatus.OK);
		expect(
			z
				.object({ success: z.literal(true), data: GreetingSchema.strict() })
				.loose()
				.parse(response.json()).data,
		).toEqual({ message: "hello" });
	});
});
