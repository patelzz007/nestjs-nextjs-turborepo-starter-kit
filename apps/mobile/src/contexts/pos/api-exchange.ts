// What the till sent and got back — for a scanned code (`POST /integration/redemptions/validate`) and
// for redeeming it on the bill (`POST /integration/redemptions/checkout`) — shown under the result so
// the person setting a till up can see the exact request body, the till's own headers and the
// response body. The API key is masked: only its first characters show, so a
// screenshot of the screen never leaks the till's secret.

import { ApiError, posCredentialHeaders, type PosTerminalCredentials } from "@workspace/api-client";
import { apiContract } from "@workspace/shared";

/** How many characters of the API key stay readable (enough to tell two keys apart). */
const API_KEY_VISIBLE_CHARACTERS = 6;
/** Spaces per level in the pretty-printed JSON. */
const JSON_INDENT = 2;

const API_KEY_HEADER_NAME = "x-api-key";
const MASK = "••••••••";

/** One request the till made and the answer it got (or the error the API answered with). */
export interface ApiExchange {
	readonly method: string;
	readonly path: string;
	readonly requestHeaders: Readonly<Record<string, string>>;
	readonly requestBody: object;
	readonly responseBody: object;
	readonly succeeded: boolean;
}

/** A header value safe to show: the API key cut to its first characters. */
export function maskHeaderValue(name: string, value: string): string {
	return name.toLowerCase() === API_KEY_HEADER_NAME ? `${value.slice(0, API_KEY_VISIBLE_CHARACTERS)}${MASK}` : value;
}

/** The headers the till adds to a redemption call, safe to show. */
export function tillRequestHeaders(credentials: PosTerminalCredentials): Readonly<Record<string, string>> {
	return Object.fromEntries([
		["Content-Type", "application/json"],
		...Object.entries(posCredentialHeaders(credentials)).map(([name, value]): [string, string] => [name, maskHeaderValue(name, value)]),
	]);
}

/** What an error answer looked like, as plain JSON (the client's `ApiError` flattened back to the API's words). */
export function errorBodyOf(error: Error): object {
	if (!(error instanceof ApiError)) {
		return { error: { message: error.message } };
	}
	return {
		success: false,
		error: { code: error.code ?? null, message: error.message },
		statusCode: error.statusCode ?? null,
		correlationId: error.correlationId ?? null,
	};
}

/** How a call ended: the answer's body, or the error it failed with. */
export type ExchangeOutcome = { readonly ok: true; readonly body: object } | { readonly ok: false; readonly error: Error };

/** The validate call's exchange, from what was sent and what came back. */
export function validateExchange(credentials: PosTerminalCredentials, requestBody: object, outcome: ExchangeOutcome): ApiExchange {
	return exchangeOf(apiContract.integration.validateRedemption, credentials, requestBody, outcome);
}

/** The checkout call's exchange: the bill, its idempotency key and the codes redeemed on it, and the receipt. */
export function checkoutExchange(credentials: PosTerminalCredentials, requestBody: object, outcome: ExchangeOutcome): ApiExchange {
	return exchangeOf(apiContract.integration.checkoutRedemption, credentials, requestBody, outcome);
}

function exchangeOf(
	contract: { readonly method: string; readonly path: string },
	credentials: PosTerminalCredentials,
	requestBody: object,
	outcome: ExchangeOutcome,
): ApiExchange {
	return {
		method: contract.method,
		path: contract.path,
		requestHeaders: tillRequestHeaders(credentials),
		requestBody,
		responseBody: outcome.ok ? outcome.body : errorBodyOf(outcome.error),
		succeeded: outcome.ok,
	};
}

/** Pretty JSON for a code block. */
export function prettyJson(value: object): string {
	return JSON.stringify(value, null, JSON_INDENT);
}
