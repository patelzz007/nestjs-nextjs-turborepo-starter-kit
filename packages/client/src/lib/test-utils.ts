// Test-only helpers shared by the auth/ and api/ suites. NEVER import this in
// production code — it exists solely so tests can assert on fetch calls.
import type { DataValue } from "@workspace/shared";
import { isStringPrimitive, LIST_SLOT_INDEX } from "@workspace/shared";
import type { Mock } from "vitest";
import { z } from "zod";

/** Signature of the stubbed global `fetch` used across the test suite. */
export type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface FetchCall {
	readonly input: RequestInfo | URL;
	readonly init: RequestInit;
}

export function jsonResponse(status: number, body: DataValue): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

export function inputUrl(input: RequestInfo | URL): string {
	if (isStringPrimitive(input)) return input;
	if (input instanceof Request) return input.url;
	return input.href;
}

/** `HeadersInit` as a list of `[name, value]` pairs. */
const HeaderPairsSchema = z.array(z.tuple([z.string(), z.string()]));
/** `HeadersInit` as a plain `name → value` record. */
const HeaderRecordSchema = z.record(z.string(), z.string());

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
	const pairs = HeaderPairsSchema.safeParse(headers);
	if (pairs.success) return Object.fromEntries(pairs.data);
	return HeaderRecordSchema.parse(headers);
}

export function firstFetchCall(mock: Mock<FetchImpl>): FetchCall {
	const call = mock.mock.calls[LIST_SLOT_INDEX.first];
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
