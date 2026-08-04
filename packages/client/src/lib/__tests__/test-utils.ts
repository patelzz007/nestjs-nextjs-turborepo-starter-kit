import type { Mock } from "vitest";

/** Signature of the stubbed global `fetch` used across the test suite. */
export type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface FetchCall {
	readonly input: RequestInfo | URL;
	readonly init: RequestInit;
}

export function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

export function inputUrl(input: RequestInfo | URL): string {
	if (typeof input === "string") return input;
	if (input instanceof Request) return input.url;
	return input.href;
}

export function headersOf(init: RequestInit): Record<string, string> {
	const headers = init.headers;
	if (headers === undefined) return {};
	if (headers instanceof Headers) {
		const result: Record<string, string> = {};
		headers.forEach((value, key) => {
			result[key] = value;
		});
		return result;
	}
	if (Array.isArray(headers)) return Object.fromEntries(headers);
	return headers;
}

export function firstFetchCall(mock: Mock<FetchImpl>): FetchCall {
	const call = mock.mock.calls[0];
	if (call === undefined) throw new Error("fetch was never called");
	const [input, init] = call;
	return { input, init: init ?? {} };
}

export function fetchCalls(mock: Mock<FetchImpl>): FetchCall[] {
	return mock.mock.calls.map((call) => {
		const [input, init] = call;
		return { input, init: init ?? {} };
	});
}
