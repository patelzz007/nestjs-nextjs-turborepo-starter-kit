// ============================================
// http.ts - URL and header building shared by every request
// ============================================
// Platform-neutral: only `URL` and plain records, which browsers and React
// Native both provide.

import {
	API_VERSION_PREFIX,
	APP_VERSION_HEADER,
	apiVersionPrefix,
	clientTypeHeader,
	MUTATION_INTENT_HEADER,
	MUTATION_INTENT_VALUE,
	type ApiVersion,
	type AuthClientType,
} from "@workspace/shared";
import { z } from "zod";

export const HttpMethodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);

export type HttpMethod = z.output<typeof HttpMethodSchema>;

/** HTTP status the session pipeline reacts to: the access token is missing, expired or revoked. */
export const HTTP_UNAUTHORIZED_STATUS = 401;

/** HTTP status the API answers when the refresh token itself is not accepted. */
export const HTTP_FORBIDDEN_STATUS = 403;

/**
 * The `status` of a failure that never got an HTTP answer
 * (network error, CORS, aborted request).
 */
export const NO_HTTP_RESPONSE_STATUS = 0;

/** The `error` of a failure whose request was aborted (its `AbortSignal` fired). */
export const REQUEST_ABORTED_ERROR = "aborted";

/** The `Authorization` header the token transport sends. */
export const AUTHORIZATION_HEADER = "Authorization";

/** Thrown by `fetch` when its `AbortSignal` fired. Browsers, Node and React Native all name it `AbortError`. */
const ABORT_ERROR_NAME = "AbortError";

/**
 * The value `fetch` rejects with when the request was aborted: a `DOMException`
 * in browsers and Node, a plain `Error` in React Native — both named
 * `AbortError`. Matched by shape, never with `instanceof DOMException` (React
 * Native has no such global, and a `DOMException` from another realm — jsdom —
 * is not an `instanceof Error` here).
 */
export const AbortErrorSchema = z.object({ name: z.literal(ABORT_ERROR_NAME) });

/** `path` already carries its query string (`resolveRequest` builds it). */
export function buildUrl(baseUrl: string, path: string, version?: ApiVersion): string {
	const prefix: string = version === undefined ? API_VERSION_PREFIX : apiVersionPrefix(version);
	return new URL(`${prefix}${path}`, baseUrl).toString();
}

export function mutationIntentHeaders(): Record<string, string> {
	return { [MUTATION_INTENT_HEADER]: MUTATION_INTENT_VALUE };
}

/** `X-App-Version` (the shared `APP_VERSION_HEADER`, ADR 033) when the client has a version (mobile); nothing otherwise. */
export function appVersionHeader(appVersion: string | undefined): Record<string, string> {
	return appVersion === undefined ? {} : { [APP_VERSION_HEADER]: appVersion };
}

/** `Authorization: Bearer <token>` when an access token is held; nothing otherwise. */
export function bearerAuthorizationHeader(accessToken: string | null): Record<string, string> {
	return accessToken === null ? {} : { [AUTHORIZATION_HEADER]: `Bearer ${accessToken}` };
}

/**
 * The headers of one procedure call. The procedure's own headers come first;
 * the mutation-intent, client-type and app-version headers come last, so
 * nothing a call site passes can drop or rewrite them.
 */
export function mergeProcedureHeaders(clientType: AuthClientType, headers: Record<string, string> | undefined, appVersion?: string): Record<string, string> {
	return { ...headers, ...mutationIntentHeaders(), ...clientTypeHeader(clientType), ...appVersionHeader(appVersion) };
}
