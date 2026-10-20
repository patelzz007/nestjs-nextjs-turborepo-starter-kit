import type { AccessTokenPayload, FlatUserResponse, RefreshTokenPayload, TwoFactorChallengeRefPayload } from "@workspace/shared";

import type { SessionScope } from "../../domain/policies/session-restriction.policy";

export interface SessionTokenOptions {
	readonly sessionScope: SessionScope;
	readonly mfaAssuredAt?: number | undefined;
}

export interface SessionTokens {
	readonly accessToken: string;
	readonly refreshToken: string;
}

/** A verified two-factor challenge reference (the `tempToken` between password and second factor). */
export interface VerifiedChallengeRef {
	readonly userId: string;
	readonly challengeId: string;
	readonly purpose: TwoFactorChallengeRefPayload["purpose"];
	readonly clientType: string | null;
	readonly deviceInfo: string | null;
	readonly ipAddress: string | null;
}

/** Signed tokens identity issues and verifies. Implemented by the infrastructure `TokenService` (JWT). */
export interface IdentityTokensPort {
	/** Access + refresh token of one device session (`sid` / `jti` = `sessionId`). */
	generateSessionTokens(user: FlatUserResponse, sessionId: string, options: SessionTokenOptions): Promise<SessionTokens>;
	/**
	 * An access token for an existing device session (`sid` = `sessionId`) without rotating its
	 * refresh token: the administrator's restored token after impersonation.
	 */
	generateAccessToken(user: FlatUserResponse, sessionId: string): Promise<string>;
	generateImpersonationToken(user: FlatUserResponse, originalUserId: string, impersonationSessionId: string): Promise<string>;
	generateEmailVerificationToken(email: string): Promise<string>;
	/** The email of a valid verification token; throws 401 otherwise. */
	verifyEmailToken(token: string): Promise<string>;
	signChallengeRef(payload: TwoFactorChallengeRefPayload): Promise<string>;
	/** Throws 401 for an expired or invalid reference. */
	verifyChallengeRef(token: string): Promise<VerifiedChallengeRef>;
	verifyAccessToken(token: string): Promise<AccessTokenPayload>;
	verifyRefreshToken(token: string): Promise<RefreshTokenPayload>;
}
