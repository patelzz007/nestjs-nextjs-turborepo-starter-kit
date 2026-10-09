// ============================================
// refresh.ts - silent session refresh: cooldown, single flight, body tokens
// ============================================
// Both transports refresh the same way from the request pipeline's point of
// view: a `RefreshCall` that resolves how the refresh ended.
//
// - Cookie transport (browsers): the web auth facade owns the refresh call
//   (`POST /auth/refresh` with the httpOnly cookie) and wraps it with
//   `createRefreshCooldown` and its own single flight.
// - Token transport (mobile, ADR 029): `createBodyTokenRefresh` sends the
//   stored refresh token in the body and saves the rotated pair;
//   `createTokenRequestTransport` (transport.ts) wraps it with the same
//   cooldown and `createSingleFlightRefresh`, so concurrent 401s share ONE
//   refresh — a refresh token is single-use, rotating it twice would end the
//   session.

import { apiContract, RefreshTokenBodySchema, type AuthClientType } from "@workspace/shared";
import { z } from "zod";

import { BodyTokenRefreshResponseSchema, type BodyTokenPair } from "./body-token-contract";
import { buildUrl, HTTP_FORBIDDEN_STATUS, HTTP_UNAUTHORIZED_STATUS, mergeProcedureHeaders } from "./http";
import { parseResponseText } from "./response-contract";
import { createTransientFailureBreaker } from "./transient-failure-breaker";
import type { TokenProvider } from "./token-provider";

export const RefreshResultSchema = z.enum(["ok", "expired", "transient"]);

/**
 * How a refresh ended: `ok` retries the request, `expired` ends the session,
 * `transient` fails only this request — an unreachable API is not a dead session.
 */
export type RefreshResult = z.output<typeof RefreshResultSchema>;

export type RefreshCall = () => Promise<RefreshResult>;

/** After a transient refresh failure, further refreshes are skipped for this long (mirrors the web proxy's fall-through). */
export const REFRESH_TRANSIENT_COOLDOWN_MS = 30_000;

/** The one key of a client's refresh breaker: a client holds one session. */
const CLIENT_SESSION_KEY = "session";

/** Every tracked key of a single-session breaker. */
const SINGLE_SESSION_KEYS = 1;

/**
 * Wraps a refresh so a dead API is not re-hit on every 401: inside the
 * cooldown that follows a transient failure, the call resolves `"transient"`
 * without touching the API. An expired session or a success settles it.
 * Keeps how the refresh ended, so callers can tell a dead session from an
 * unreachable API. Same breaker as the web route proxy
 * (`transient-failure-breaker.ts`), with one key: a client holds one session.
 */
export function createRefreshCooldown(refresh: RefreshCall, cooldownMs = REFRESH_TRANSIENT_COOLDOWN_MS): RefreshCall {
	const breaker = createTransientFailureBreaker({ cooldownMs, circuitThreshold: 1, circuitWindowMs: cooldownMs, maxTrackedKeys: SINGLE_SESSION_KEYS });

	return async (): Promise<RefreshResult> => {
		if (breaker.isCoolingDown(CLIENT_SESSION_KEY)) {
			return "transient";
		}

		const result = await refresh();
		if (result === "transient") {
			breaker.recordTransientFailure(CLIENT_SESSION_KEY);
		} else {
			breaker.recordSettled(CLIENT_SESSION_KEY);
		}
		return result;
	};
}

/**
 * Single flight: while one refresh runs, every caller joins it instead of
 * starting its own. Once it settles, the next call starts a fresh refresh.
 */
export function createSingleFlightRefresh(refresh: RefreshCall): RefreshCall {
	let inFlight: Promise<RefreshResult> | null = null;

	return (): Promise<RefreshResult> => {
		inFlight ??= (async (): Promise<RefreshResult> => {
			try {
				return await refresh();
			} finally {
				inFlight = null;
			}
		})();
		return inFlight;
	};
}

/** The refresh route's method, from the shared contract (never re-typed). */
const REFRESH_METHOD = apiContract.auth.refresh.method;

/** What {@link createBodyTokenRefresh} needs to reach the API as the mobile client. */
export interface BodyTokenRefreshOptions {
	readonly baseUrl: string;
	readonly clientType: AuthClientType;
	readonly appVersion?: string | undefined;
	/** Static headers of the client (`ApiClientConfig.headers`), sent with the refresh too. */
	readonly headers?: Readonly<Record<string, string>> | undefined;
	readonly tokenProvider: TokenProvider;
}

/**
 * One body-token refresh (ADR 029): `POST /auth/refresh` with `{ refreshToken }`,
 * then the rotated pair is saved through the token provider.
 *
 * - `ok` — the rotated pair is saved; the waiting requests retry with it.
 * - `expired` — no valid refresh token is stored, the API refused it (401 / 403:
 *   expired, reused or revoked), or the refresh cannot be completed: the 2xx
 *   body broke its contract, or the rotated pair could not be saved. The API
 *   has already rotated (spent) the old token in the last two cases, so the
 *   session cannot continue either way.
 * - `transient` — no verdict: the stored token could not be read, the API was
 *   unreachable, or it answered anything else (5xx, 429, 426).
 */
export function createBodyTokenRefresh(options: BodyTokenRefreshOptions): RefreshCall {
	const { baseUrl, clientType, appVersion, headers, tokenProvider } = options;
	const route = apiContract.auth.refresh;
	const url: string = buildUrl(baseUrl, route.path, route.version);

	return async (): Promise<RefreshResult> => {
		let refreshToken: string | null;
		try {
			refreshToken = await tokenProvider.getRefreshToken();
		} catch {
			return "transient";
		}
		// No token, or one no API would accept (a corrupted store): there is no session to refresh.
		const body = RefreshTokenBodySchema.safeParse({ refreshToken });
		if (!body.success) {
			return "expired";
		}

		let response: Response;
		try {
			response = await fetch(url, {
				method: REFRESH_METHOD,
				credentials: "omit",
				headers: { Accept: "application/json", "Content-Type": "application/json", ...mergeProcedureHeaders(clientType, headers, appVersion) },
				body: JSON.stringify(body.data),
			});
		} catch {
			return "transient";
		}

		if (response.status === HTTP_UNAUTHORIZED_STATUS || response.status === HTTP_FORBIDDEN_STATUS) {
			return "expired";
		}
		if (!response.ok) {
			return "transient";
		}
		return saveRotatedTokens(tokenProvider, await readRotatedTokens(response, url));
	};
}

/**
 * The rotated pair of a 2xx refresh answer, or `null` when it cannot be read:
 * the body breaks its contract (`ApiResponseContractError`) or the connection
 * dropped while it was read. Either way the API has already rotated the token.
 */
async function readRotatedTokens(response: Response, url: string): Promise<BodyTokenPair | null> {
	try {
		const { accessToken, refreshToken } = parseResponseText(BodyTokenRefreshResponseSchema, await response.text(), {
			method: REFRESH_METHOD,
			url,
			status: response.status,
		}).data;
		return { accessToken, refreshToken };
	} catch {
		return null;
	}
}

async function saveRotatedTokens(tokenProvider: TokenProvider, tokens: BodyTokenPair | null): Promise<RefreshResult> {
	if (tokens === null) {
		return "expired";
	}
	try {
		await tokenProvider.saveTokens(tokens);
		return "ok";
	} catch {
		return "expired";
	}
}
