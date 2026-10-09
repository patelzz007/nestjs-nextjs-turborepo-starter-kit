// The API boundary under Jest: `fetch` answers per "METHOD /path" with the
// standard envelopes (ADR 016, ADR 022). Everything above fetch — the
// api-client, its validation and refresh, TanStack Query — is the real code.

import type { DataValue } from "@workspace/shared";
import { z } from "zod";

const META = { correlationId: "corr-test", timestamp: 1_791_504_000_000 };

/** What a route answers. */
export interface StubResponse {
	readonly kind: "response";
	readonly status: number;
	readonly body: DataValue;
}

/** `{ success: true, data }` with a 200 (or `status`). */
export function ok(data: DataValue, status = 200): StubResponse {
	return { kind: "response", status, body: { success: true, data, meta: META } };
}

/** The standard error envelope. */
export function fail(status: number, code: string, message: string, details?: DataValue): StubResponse {
	return { kind: "response", status, body: { success: false, error: { code, message, ...(details === undefined ? {} : { details }) }, meta: META } };
}

/** One recorded request. */
export interface StubCall {
	readonly method: string;
	readonly path: string;
	readonly headers: Readonly<Record<string, string>>;
	readonly body: string | null;
}

export type StubHandler = (call: StubCall) => StubResponse;

/** A route whose answer depends on the request or on earlier calls. */
export interface DynamicStubRoute {
	readonly kind: "dynamic";
	readonly handle: StubHandler;
}

export type StubRoute = StubResponse | DynamicStubRoute;

export function dynamic(handle: StubHandler): DynamicStubRoute {
	return { kind: "dynamic", handle };
}

export interface ApiStub {
	readonly calls: StubCall[];
	/** The calls to "METHOD /path". */
	readonly callsTo: (route: string) => StubCall[];
}

const API_PREFIX = "/api/v1";

function headersOf(init: RequestInit | undefined): Record<string, string> {
	const result: Record<string, string> = {};
	new Headers(init?.headers).forEach((value: string, key: string): void => {
		result[key.toLowerCase()] = value;
	});
	return result;
}

/**
 * Replaces `fetch`. Routes are keyed "POST /auth/login" (without the version
 * prefix) and answer a fixed response (`ok` / `fail`) or a `dynamic` one; an
 * unknown route answers 404 so a test never hangs on it.
 */
export function stubApi(routes: Readonly<Record<string, StubRoute>>): ApiStub {
	const calls: StubCall[] = [];
	const fetchStub = jest.fn((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
		const url = new URL(input instanceof Request ? input.url : input.toString());
		const path = url.pathname.startsWith(API_PREFIX) ? url.pathname.slice(API_PREFIX.length) : url.pathname;
		const call: StubCall = {
			method: init?.method ?? "GET",
			path: `${path}${url.search}`,
			headers: headersOf(init),
			body: z.string().safeParse(init?.body).data ?? null,
		};
		calls.push(call);
		const route = routes[`${call.method} ${call.path}`];
		const answer: StubResponse =
			route === undefined ? fail(404, "NOT_FOUND", `No stub for ${call.method} ${call.path}`) : route.kind === "dynamic" ? route.handle(call) : route;
		return Promise.resolve(new Response(JSON.stringify(answer.body), { status: answer.status, headers: { "content-type": "application/json" } }));
	});
	globalThis.fetch = fetchStub;
	return { calls, callsTo: (key: string): StubCall[] => calls.filter((call: StubCall): boolean => `${call.method} ${call.path}` === key) };
}
