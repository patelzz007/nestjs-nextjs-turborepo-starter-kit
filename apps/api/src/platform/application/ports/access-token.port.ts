import type { AccessTokenPayload, AuthFlowEvent, RefreshTokenPayload } from "@workspace/shared";

/*
 * What the HTTP security kit (guards, the API-docs gate, `@TrackAuthFlow`) needs from identity. Declared
 * on the consumer side so the kit never imports a context at runtime (no module cycle with the context
 * that registers the guarded controllers); identity binds these tokens (`IdentityModule`).
 */

/** Verifies the signature and claims of session tokens. Exposed to the HTTP security kit. */
export interface AccessTokenVerifierPort {
	/** Throws 401 (`ACCESS_TOKEN_EXPIRED` / `ACCESS_TOKEN_INVALID`). */
	verifyAccessToken(token: string): Promise<AccessTokenPayload>;
	/** Throws 401 (`REFRESH_TOKEN_EXPIRED` / `REFRESH_TOKEN_INVALID`). */
	verifyRefreshToken(token: string): Promise<RefreshTokenPayload>;
}

/**
 * Server-side revocation state of access tokens (cached, short TTL, dropped after every revocation
 * on every instance). Exposed to the security kit and to authorization's invalidation transport.
 */
export interface AccessTokenStatePort {
	/** Throws 401 for a deleted or inactive account, a stale `tokenVersion`, or a revoked `sid`. */
	assertTokenValid(userId: string, tokenVersion: number, sessionId?: string): Promise<void>;
	/** Drops this instance's cached state of the user. */
	invalidate(userId: string): void;
}

/** An impersonation token is valid only while its server-side session is live. Exposed to the security kit. */
export interface ImpersonationTokenCheckPort {
	/** No-op for a non-impersonation token; throws 401 `IMPERSONATION_SESSION_INVALID` otherwise unless the session is live. */
	assertLiveIfImpersonating(payload: AccessTokenPayload): Promise<void>;
}

/** Durably records one completed auth flow (outbox `auth.flow`). Never throws. Read by `@TrackAuthFlow` from its host's `authEvents`. */
export interface AuthFlowRecorder {
	recordFlow(event: AuthFlowEvent): Promise<object>;
}

export const ACCESS_TOKEN_VERIFIER = Symbol("ACCESS_TOKEN_VERIFIER");
export const ACCESS_TOKEN_STATE = Symbol("ACCESS_TOKEN_STATE");
export const IMPERSONATION_TOKEN_CHECK = Symbol("IMPERSONATION_TOKEN_CHECK");
export const AUTH_FLOW_RECORDER = Symbol("AUTH_FLOW_RECORDER");
