// ============================================
// lib/proxy-refresh.ts - Server-side (proxy) token refresh
// Node-safe: uses only fetch/atob (no Node APIs), so it runs wherever the
// proxy does. Next.js 16 runs `proxy.ts` on the Node.js runtime by design
// (only legacy `middleware.ts` can opt into Edge), so no Edge runtime setup
// is needed on Node hosts (DigitalOcean / Linode droplets, etc.).
// Imported by apps/web/proxy.ts and apps/admin/proxy.ts.
// ============================================

import { z } from "zod";

import { MUTATION_INTENT_HEADER, MUTATION_INTENT_VALUE } from "@workspace/shared";

import { API_URL_PREFIX } from "../../api/config";
import { apiRouter } from "../../api/endpoints";
import { decodeJwtPayload } from "./jwt";
import { collectSetCookies, extractRotatedAccessToken, hasRotatedAuthCookies } from "./proxy-refresh-cookies";

/** How early (ms) before `exp` we refresh on navigation (absorbs clock drift). */
export const REFRESH_SKEW_MS = 30_000;

/** Hard timeout (ms) for the proxy→API refresh call so navigation never blocks. */
export const REFRESH_TIMEOUT_MS = 3_000;

export const ProxyRefreshConfigSchema = z.object({
	apiBaseUrl: z.string(),
	/** Cookie name carrying the refresh token (`refreshToken` | `adminRefreshToken`). */
	refreshTokenName: z.string(),
	accessTokenName: z.string(),
	refreshToken: z.string(),
	clientType: z.enum(["web", "admin", "merchant"]),
	clientOrigin: z.string(),
});

export type ProxyRefreshConfig = z.output<typeof ProxyRefreshConfigSchema>;

export const ProxyRefreshResultSchema = z.object({
	ok: z.boolean(),
	status: z.number(),
	/** Raw `Set-Cookie` header strings returned by the API (the rotated tokens). */
	setCookies: z.array(z.string()),
	/**
	 * Underlying failure detail when the fetch threw (status 0), e.g.
	 * `connect ECONNREFUSED 127.0.0.1:8080` for a dead API or `Aborted` for a
	 * timeout. Lets the proxy log say WHY the refresh failed, not just that it did.
	 */
	errorDetail: z.string().optional(),
	/**
	 * True when the attempt was short-circuited by the transient-failure cooldown
	 * (see `createProxyRefreshCooldown`) — no network call was made.
	 */
	skipped: z.boolean().optional(),
});

export type ProxyRefreshResult = z.output<typeof ProxyRefreshResultSchema>;

/**
 * True when the access token is already expired or expires within `skewMs`,
 * i.e. the proxy should try a silent refresh before serving the page.
 * Tokens that can't be decoded (no `exp` claim) are left alone — the API
 * decides validity on the next authenticated call.
 */
export function isAccessTokenExpired(accessToken: string, skewMs: number = REFRESH_SKEW_MS): boolean {
	const payload = decodeJwtPayload(accessToken);
	const exp = payload?.exp;
	if (exp === undefined) return false;
	return exp * 1000 <= Date.now() + skewMs;
}

/**
 * True when the request should be treated as authenticated for route gating.
 * A stale access-token cookie alone is not enough — it would pass the proxy,
 * paint the panel, then 401 on the first API call and client-redirect to login
 * (the visible "/" → login flicker). A refresh token without a live access
 * token is still recoverable (the proxy refresh block runs first).
 */
export function hasRouteSession(accessToken: string | undefined, refreshToken: string | undefined, effectiveAccessToken: string | undefined = accessToken): boolean {
	const token: string | undefined = effectiveAccessToken ?? accessToken;
	if (token !== undefined && !isAccessTokenExpired(token)) {
		// A live-looking access token without a refresh token is an orphaned cookie
		// (partial logout / post-revocation) — not a recoverable session.
		return refreshToken !== undefined;
	}
	return refreshToken !== undefined;
}

export const ProxyRefreshTriggerContextSchema = z.object({
	accessToken: z.string().optional(),
	refreshToken: z.string().optional(),
	isDocumentNavigation: z.boolean(),
	isAuthRoute: z.boolean(),
	isPublicRoute: z.boolean(),
});

export type ProxyRefreshTriggerContext = z.output<typeof ProxyRefreshTriggerContextSchema>;

/**
 * True when the proxy should call `POST /auth/refresh` before route gating.
 *
 * - Protected routes: document navigations with an expired access token (existing).
 * - Auth routes: whenever a refresh token is present and the request would
 *   otherwise look authenticated — catches revoked sessions before the login-page
 *   bounce and on RSC `router.refresh()` after client-side logout.
 */
export function shouldAttemptProxyRefresh(context: ProxyRefreshTriggerContext): boolean {
	const accessToken: string | undefined = context.accessToken;
	const refreshToken: string | undefined = context.refreshToken;

	if (accessToken === undefined && refreshToken === undefined) {
		return false;
	}

	if (context.isAuthRoute && refreshToken !== undefined && hasRouteSession(accessToken, refreshToken, accessToken)) {
		return true;
	}

	if (!context.isDocumentNavigation || context.isPublicRoute) {
		return false;
	}

	if (accessToken === undefined || refreshToken === undefined) {
		return false;
	}

	return isAccessTokenExpired(accessToken);
}

export const ProxySessionRefreshInputSchema = z.object({
	accessToken: z.string().optional(),
	refreshToken: z.string().optional(),
	isDocumentNavigation: z.boolean(),
	isAuthRoute: z.boolean(),
	isPublicRoute: z.boolean(),
	accessTokenCookieName: z.string(),
	refreshTokenCookieName: z.string(),
	app: z.enum(["web", "admin", "merchant"]),
	pathname: z.string(),
});

export type ProxySessionRefreshInput = z.output<typeof ProxySessionRefreshInputSchema> & {
	readonly attemptRefresh: (refreshToken: string, options?: { readonly bypassCooldown?: boolean }) => Promise<ProxyRefreshResult>;
};

export const ProxySessionRefreshOutputSchema = z.object({
	rotatedCookies: z.array(z.string()),
	effectiveAccessToken: z.string().optional(),
	sessionDead: z.boolean(),
});

export type ProxySessionRefreshOutput = z.output<typeof ProxySessionRefreshOutputSchema>;

/**
 * Shared proxy refresh block used by web / merchant / admin route proxies.
 * Returns rotated cookies, the effective access token, and whether the refresh
 * token was rejected (401/403) so the caller can clear cookies / redirect.
 */
export async function resolveProxySessionRefresh(input: ProxySessionRefreshInput): Promise<ProxySessionRefreshOutput> {
	const triggerContext: ProxyRefreshTriggerContext = {
		accessToken: input.accessToken,
		refreshToken: input.refreshToken,
		isDocumentNavigation: input.isDocumentNavigation,
		isAuthRoute: input.isAuthRoute,
		isPublicRoute: input.isPublicRoute,
	};

	let rotatedCookies: string[] = [];
	let effectiveAccessToken: string | undefined = input.accessToken;
	let sessionDead = false;

	if (!shouldAttemptProxyRefresh(triggerContext) || input.refreshToken === undefined) {
		return { rotatedCookies, effectiveAccessToken, sessionDead };
	}

	const refreshStartedAt: number = Date.now();
	const result: ProxyRefreshResult = await input.attemptRefresh(input.refreshToken, {
		bypassCooldown: triggerContext.isAuthRoute,
	});
	const elapsedMs: number = Date.now() - refreshStartedAt;

	if (result.ok) {
		const hasBothCookies = hasRotatedAuthCookies(result.setCookies, input.accessTokenCookieName, input.refreshTokenCookieName);
		if (!hasBothCookies) {
			logProxyRefresh({
				app: input.app,
				pathname: input.pathname,
				status: result.status,
				elapsedMs,
				outcome: "transient-failure",
				rotatedCookieCount: result.setCookies.length,
				errorDetail: "refresh response missing rotated auth cookies",
			});
			return { rotatedCookies, effectiveAccessToken, sessionDead };
		}

		rotatedCookies = [...result.setCookies];
		const newAccessToken: string | undefined = extractRotatedAccessToken(result.setCookies, input.accessTokenCookieName);
		if (newAccessToken !== undefined) {
			effectiveAccessToken = newAccessToken;
		}
		logProxyRefresh({
			app: input.app,
			pathname: input.pathname,
			status: result.status,
			elapsedMs,
			outcome: "refreshed",
			rotatedCookieCount: result.setCookies.length,
		});
	} else if (result.status === 401 || result.status === 403) {
		sessionDead = true;
		logProxyRefresh({
			app: input.app,
			pathname: input.pathname,
			status: result.status,
			elapsedMs,
			outcome: "dead-session",
			rotatedCookieCount: 0,
		});
	} else if (result.skipped === true) {
		logProxyRefresh({
			app: input.app,
			pathname: input.pathname,
			status: result.status,
			elapsedMs,
			outcome: "cooldown-active",
			rotatedCookieCount: 0,
		});
	} else {
		logProxyRefresh({
			app: input.app,
			pathname: input.pathname,
			status: result.status,
			elapsedMs,
			outcome: "transient-failure",
			rotatedCookieCount: 0,
			errorDetail: result.errorDetail,
		});
	}

	return { rotatedCookies, effectiveAccessToken, sessionDead };
}

/** Minimal structural type so the helper stays framework-free (no `next/*` import). */
interface HeaderProvider {
	get(name: string): string | null;
}

/**
 * True for full page navigations (not prefetches / RSC data requests). The
 * proxy only refreshes on real navigations — that's when a stale access token
 * would otherwise 401 on the first API call after the page loads.
 */
export function isDocumentNavigation(headers: HeaderProvider): boolean {
	const secFetchMode: string | null = headers.get("sec-fetch-mode");
	if (secFetchMode === "navigate") return true;
	return headers.get("accept")?.includes("text/html") ?? false;
}

export const ProxyRefreshOutcomeSchema = z.enum(["refreshed", "dead-session", "transient-failure", "cooldown-active"]);

export type ProxyRefreshOutcome = z.output<typeof ProxyRefreshOutcomeSchema>;

export const ProxyRefreshLogEntrySchema = z.object({
	app: z.enum(["web", "admin", "merchant"]),
	pathname: z.string(),
	status: z.number(),
	elapsedMs: z.number(),
	outcome: ProxyRefreshOutcomeSchema,
	/** Number of rotated `Set-Cookie` headers (0 unless `outcome === "refreshed"`). */
	rotatedCookieCount: z.number(),
	/** Underlying failure detail for `transient-failure` (e.g. `ECONNREFUSED`), omitted otherwise. */
	errorDetail: z.string().optional(),
});

export type ProxyRefreshLogEntry = z.output<typeof ProxyRefreshLogEntrySchema>;

/**
 * Log a proxy refresh attempt to the Next.js server console. This is the only
 * place the server-side refresh is observable — the request never appears in
 * the browser's Network tab. Silently no-ops under vitest (`NODE_ENV ===
 * "test"`) so proxy tests stay quiet.
 */
export function logProxyRefresh(entry: ProxyRefreshLogEntry): void {
	if (process.env.NODE_ENV === "test") return;

	const detail: Record<ProxyRefreshOutcome, string> = {
		refreshed: `rotated ${String(entry.rotatedCookieCount)} cookie(s)`,
		"dead-session": "refresh rejected, clearing cookies",
		"transient-failure": `refresh failed (network/5xx)${entry.errorDetail === undefined ? "" : ` — ${entry.errorDetail}`}, keeping stale session`,
		"cooldown-active": "transient failure recently — refresh skipped (cooldown)",
	};
	// `warn` is the only lint-clean channel (`no-console` allows warn/error);
	// the [proxy:*] prefix makes these lines easy to grep in server logs.
	console.warn(`[proxy:${entry.app}] ${entry.pathname}: ${entry.outcome} — ${detail[entry.outcome]} (API ${String(entry.status)}, ${String(entry.elapsedMs)}ms)`);
}

/**
 * Call `POST /auth/refresh` from the proxy (server-to-server), forwarding the
 * refresh-token cookie (+ `X-Client-Type: admin` for the admin cookie set).
 * Returns the rotated tokens as raw `Set-Cookie` header strings so the proxy
 * can forward them to the browser. Never throws: network/timeout errors
 * surface as `{ ok: false, status: 0 }`.
 */
/**
 * How long (ms) the proxy suppresses refresh re-attempts after a transient
 * failure (dead / 5xx API) so a broken API isn't hammered on every navigation
 * inside the expiry-skew window. `Date.now()`-based, not wall-clock-based.
 */
export const PROXY_REFRESH_COOLDOWN_MS = 60_000;

/**
 * Wrap a proxy refresh attempt with a transient-failure cooldown. After a
 * network/5xx failure, calls within `cooldownMs` short-circuit to
 * `{ ok: false, status: 0, skipped: true }` without making a network call —
 * this is what kills the ECONNREFUSED log noise when the API is down and the
 * user navigates repeatedly inside the expiry-skew window. A success, a
 * dead-session (401/403), or a fresh login (different token ⇒ different
 * attempt closure) resets the cooldown.
 *
 * The returned function owns the closure state, so the proxies instantiate it
 * once at module scope — it then survives across requests in the server
 * process, which is what makes the cooldown effective for real navigations.
 * (Dev-mode hot reloads can reset module state; that only re-arms the cooldown
 * window, which is harmless.)
 *
 * This is the PROXY-SIDE cooldown (Node runtime). The CLIENT-SIDE cooldown
 * lives in `use-api.ts` (`createRefreshCooldown`) — same pattern, different
 * return type. Both are intentionally separate to avoid coupling runtimes.
 */
export function createProxyRefreshCooldown(
	refreshAttempt: (refreshToken: string) => Promise<ProxyRefreshResult>,
	cooldownMs: number = PROXY_REFRESH_COOLDOWN_MS,
): ((refreshToken: string, options?: { readonly bypassCooldown?: boolean }) => Promise<ProxyRefreshResult>) & { reset: () => void } {
	let lastTransientFailureAt: number | null = null;

	const attemptRefresh = async (refreshToken: string, options?: { readonly bypassCooldown?: boolean }): Promise<ProxyRefreshResult> => {
		if (options?.bypassCooldown !== true && lastTransientFailureAt !== null && Date.now() - lastTransientFailureAt < cooldownMs) {
			return { ok: false, status: 0, setCookies: [], skipped: true };
		}

		const result: ProxyRefreshResult = await refreshAttempt(refreshToken);
		// Transient = network failure (status 0) or server error (5xx). A 401/403
		// is a dead session, not a blip — never memoize it (the proxy must clear
		// cookies and redirect to login on every navigation until re-login).
		if (!result.ok && result.status !== 401 && result.status !== 403) {
			lastTransientFailureAt = Date.now();
		} else {
			lastTransientFailureAt = null;
		}
		return result;
	};

	return Object.assign(attemptRefresh, {
		reset(): void {
			lastTransientFailureAt = null;
		},
	});
}

export async function refreshSessionFromProxy(config: ProxyRefreshConfig): Promise<ProxyRefreshResult> {
	const controller: AbortController = new AbortController();
	const timeoutId: ReturnType<typeof setTimeout> = setTimeout((): void => {
		controller.abort();
	}, REFRESH_TIMEOUT_MS);

	try {
		const response: Response = await fetch(`${config.apiBaseUrl}${API_URL_PREFIX}${apiRouter.auth.refresh.path}`, {
			method: "POST",
			headers: {
				Accept: "application/json",
				Cookie: `${config.refreshTokenName}=${config.refreshToken}`,
				Origin: config.clientOrigin,
				[MUTATION_INTENT_HEADER]: MUTATION_INTENT_VALUE,
				...(config.clientType === "web" ? {} : { "X-Client-Type": config.clientType }),
			},
			signal: controller.signal,
		});
		return { ok: response.ok, status: response.status, setCookies: collectSetCookies(response.headers) };
	} catch (error: unknown) {
		// Surface the underlying cause (e.g. `connect ECONNREFUSED 127.0.0.1:8080`
		// when the API is down) so the proxy log line is actually diagnosable.
		const cause: unknown = typeof error === "object" && error !== null && "cause" in error ? error.cause : undefined;
		const causeMessage: unknown = typeof cause === "object" && cause !== null && "message" in cause ? cause.message : undefined;
		const errorDetail: string = typeof causeMessage === "string" && causeMessage.length > 0 ? causeMessage : error instanceof Error ? error.message : String(error);
		return { ok: false, status: 0, setCookies: [], errorDetail };
	} finally {
		clearTimeout(timeoutId);
	}
}

export {
	applyRotatedSetCookies,
	clearAuthCookies,
	collectSetCookies,
	extractRotatedAccessToken,
	hasRotatedAuthCookies,
	parseSetCookie,
	ParsedCookieSchema,
	type AuthCookieClearOptions,
	type ParsedCookie,
	type RotatedCookieWriter,
} from "./proxy-refresh-cookies";
