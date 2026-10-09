// ============================================
// @workspace/api-client/testing — test-only fetch helpers ("./testing")
// ============================================
// Shared by this package's suites and by the suites of the packages built on
// it (`@workspace/client`). NEVER import this in production code — it exists
// solely so tests can stub `fetch`, assert on its calls, and keep tokens in
// memory instead of a device's secret store.
import type { DataValue } from "@workspace/shared";
import { isStringPrimitive, LIST_SLOT_INDEX } from "@workspace/shared";
import type { Mock } from "vitest";
import { z } from "zod";

import type { BodyTokenPair } from "../body-token-contract";
import type { TokenProvider } from "../token-provider";

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

/**
 * The `data` of a successful `POST /auth/refresh` for client type `mobile`
 * (`RefreshMobileResponseSchema`): the message, the body-transport marker and
 * the rotated pair — what the API answers.
 */
export function rotatedTokensBody(pair: BodyTokenPair): DataValue {
	return { message: "Tokens refreshed successfully", tokenTransport: "body", accessToken: pair.accessToken, refreshToken: pair.refreshToken };
}

/**
 * A {@link TokenProvider} kept in memory, recording what the client did with
 * it. Stands in for the device's secret store in tests.
 */
export class MemoryTokenProvider implements TokenProvider {
	/** Every pair the client saved, oldest first. */
	public readonly savedPairs: BodyTokenPair[] = [];
	private _tokens: BodyTokenPair | null;
	private _clearCount = 0;

	public constructor(tokens: BodyTokenPair | null = null) {
		this._tokens = tokens;
	}

	/** How many times the client cleared the tokens. */
	public get clearCount(): number {
		return this._clearCount;
	}

	public getAccessToken(): Promise<string | null> {
		return Promise.resolve(this._tokens?.accessToken ?? null);
	}

	public getRefreshToken(): Promise<string | null> {
		return Promise.resolve(this._tokens?.refreshToken ?? null);
	}

	public saveTokens(tokens: BodyTokenPair): Promise<void> {
		this._tokens = tokens;
		this.savedPairs.push(tokens);
		return Promise.resolve();
	}

	public clearTokens(): Promise<void> {
		this._tokens = null;
		this._clearCount += 1;
		return Promise.resolve();
	}
}
