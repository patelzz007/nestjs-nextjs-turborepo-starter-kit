import { Logger, SetMetadata } from "@nestjs/common";
import { SSE_METADATA } from "@nestjs/common/constants.js";
import { Reflector } from "@nestjs/core";
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host";
import { lastValueFrom, of, type Observable } from "rxjs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { captureFastifyRequest } from "../../../../../../e2e/support/fastify-request";
import { PerformanceInterceptor, SLOW_REQUEST_THRESHOLD_MS } from "../performance.interceptor";

/** Past the threshold: what a slow JSON response, or any open event stream, has taken. */
const LONG_MS = SLOW_REQUEST_THRESHOLD_MS * 175;

/** An ordinary route's handler. */
function listRoute(): string {
	return "list";
}

/** An event stream's handler, marked exactly as `@Sse()` marks one (SSE_METADATA on the handler function). */
function streamRoute(): string {
	return "frame";
}
SetMetadata(SSE_METADATA, true)(streamRoute);

/** The controller the handlers belong to. */
class TestController {}

async function context(handler: () => string, headers: Record<string, string> = {}): Promise<ExecutionContextHost> {
	const request = await captureFastifyRequest({ headers });
	return new ExecutionContextHost([request], TestController, handler);
}

/** Runs one response through the interceptor, `LONG_MS` after the request began. */
async function respond(executionContext: ExecutionContextHost): Promise<void> {
	const start = Date.now();
	vi.spyOn(Date, "now")
		.mockReturnValueOnce(start)
		.mockReturnValue(start + LONG_MS);
	await lastValueFrom(new PerformanceInterceptor(new Reflector()).intercept(executionContext, { handle: (): Observable<string> => of("frame") }));
}

describe("PerformanceInterceptor", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("warns about a slow ordinary request", async () => {
		const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation((): void => undefined);

		await respond(await context(listRoute));

		expect(warn).toHaveBeenCalledWith(`Slow request: POST /capture took ${String(LONG_MS)}ms`);
	});

	it("never times an @Sse() stream: it stays open by design, so its length is not a slow response", async () => {
		const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation((): void => undefined);

		await respond(await context(streamRoute));

		expect(warn).not.toHaveBeenCalled();
	});

	it("never times a request that asks for an event stream", async () => {
		const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation((): void => undefined);

		await respond(await context(listRoute, { accept: "text/event-stream, */*" }));

		expect(warn).not.toHaveBeenCalled();
	});
});
