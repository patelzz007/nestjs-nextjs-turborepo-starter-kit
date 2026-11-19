import { SetMetadata } from "@nestjs/common";
import { SSE_METADATA } from "@nestjs/common/constants.js";
import { Reflector } from "@nestjs/core";
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host";
import { Subject, type Observable } from "rxjs";
import { describe, expect, it } from "vitest";

import { captureFastifyRequest } from "../../../../../../e2e/support/fastify-request";
import { HttpServerClosing } from "../../lifecycle/http-server-closing";
import { EventStreamShutdownInterceptor } from "../event-stream-shutdown.interceptor";

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
	return new ExecutionContextHost([await captureFastifyRequest({ headers })], TestController, handler);
}

/** What one response observed: the frames it sent, and whether it ended. */
interface Observed {
	readonly frames: string[];
	readonly completed: () => boolean;
}

function observe(response: Observable<string>): Observed {
	const frames: string[] = [];
	let completed = false;
	response.subscribe({
		next: (frame: string): void => {
			frames.push(frame);
		},
		complete: (): void => {
			completed = true;
		},
	});
	return { frames, completed: (): boolean => completed };
}

describe("EventStreamShutdownInterceptor", () => {
	it("ends an @Sse() stream when the HTTP server starts closing", async () => {
		const server = new HttpServerClosing();
		const frames = new Subject<string>();
		const response = observe(new EventStreamShutdownInterceptor(new Reflector(), server).intercept(await context(streamRoute), { handle: (): Observable<string> => frames }));

		frames.next("ping");
		server.begin();
		frames.next("after-close");

		expect(response.frames).toStrictEqual(["ping"]);
		expect(response.completed()).toBe(true);
	});

	it("treats a request that asks for text/event-stream as a stream too", async () => {
		const server = new HttpServerClosing();
		const response = observe(
			new EventStreamShutdownInterceptor(new Reflector(), server).intercept(await context(listRoute, { accept: "text/event-stream" }), {
				handle: (): Observable<string> => new Subject<string>(),
			}),
		);

		server.begin();

		expect(response.completed()).toBe(true);
	});

	it("ends at once a stream that opens after closing began", async () => {
		const server = new HttpServerClosing();
		server.begin();

		const response = observe(
			new EventStreamShutdownInterceptor(new Reflector(), server).intercept(await context(streamRoute), { handle: (): Observable<string> => new Subject<string>() }),
		);

		expect(response.completed()).toBe(true);
	});

	it("never cuts an ordinary response: the server waits for it instead", async () => {
		const server = new HttpServerClosing();
		const body = new Subject<string>();
		const response = observe(new EventStreamShutdownInterceptor(new Reflector(), server).intercept(await context(listRoute), { handle: (): Observable<string> => body }));

		server.begin();
		body.next("list");
		body.complete();

		expect(response.frames).toStrictEqual(["list"]);
		expect(response.completed()).toBe(true);
	});
});

describe("HttpServerClosing", () => {
	it("emits once, and a second begin() changes nothing", () => {
		const server = new HttpServerClosing();
		const emissions: string[] = [];
		server.closing.subscribe({
			next: (): void => {
				emissions.push("closing");
			},
		});

		server.begin();
		server.begin();

		expect(emissions).toStrictEqual(["closing"]);
	});
});
