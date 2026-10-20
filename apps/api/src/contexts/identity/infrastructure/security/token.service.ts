import { randomUUID } from "node:crypto";

import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
// `jsonwebtoken` is CJS; its named export `TokenExpiredError` is not statically
// detectable by Node's ESM-CJS interop (cjs-module-lexer), so a named import
// crashes under true ESM. The default import IS module.exports, which exposes
// the error class at runtime (and is fully typed via `export =` declarations).
import jwt from "jsonwebtoken";

import { ZodError } from "zod";

import {
	AccessTokenPayloadSchema,
	EmailVerificationTokenPayloadSchema,
	TwoFactorChallengeRefPayloadSchema,
	type TwoFactorChallengeRefPayload,
	type EmailVerificationTokenPayload,
	RefreshTokenPayloadSchema,
	type AccessTokenPayload,
	type FlatUserResponse,
	type RefreshTokenPayload,
} from "@workspace/shared";

import { CaughtValueSchema, EMAIL_VERIFICATION_LINK_TTL_HOURS } from "@workspace/shared";
import { parseExpiryToSeconds } from "../../../../platform/infrastructure/utils/expiry";
import { TypedConfigService } from "../../../../config/typed-config.service";
import { IMPERSONATION_TOKEN_TTL_SECONDS } from "../../domain/aggregates/impersonation-session.aggregate";
import type { SessionScope } from "../../domain/policies/session-restriction.policy";
import type { AccessTokenVerifierPort } from "../../../../platform/application/ports/access-token.port";
import type { IdentityTokensPort, VerifiedChallengeRef } from "../../application/ports/identity-tokens.port";

// `TokenExpiredError` is exposed at runtime on the CJS default export — see the
// comment on the `jsonwebtoken` import above for why it can't be named-imported.
const { TokenExpiredError } = jwt;

/** Seconds a two-factor challenge reference is valid (the challenge itself lives 10 minutes). */
const CHALLENGE_REF_EXPIRY_SECONDS = 600;

/** Seconds per hour — converts the shared email-link lifetime (hours) to a JWT `expiresIn`. */
const SECONDS_PER_HOUR = 3600;

export interface AccessTokenGenerationOptions {
	readonly sessionScope?: SessionScope | undefined;
	readonly mfaAssuredAt?: number | undefined;
}

export interface SessionTokenGenerationOptions {
	readonly sessionScope: SessionScope;
	readonly mfaAssuredAt?: number | undefined;
}

@Injectable()
/** JWT issuer and verifier of every identity token (access, refresh, email verification, impersonation, 2FA challenge reference). */
export class TokenService implements IdentityTokensPort, AccessTokenVerifierPort {
	private readonly logger: Logger = new Logger(TokenService.name);

	constructor(
		private readonly jwtService: JwtService,
		private readonly config: TypedConfigService,
	) {}

	/**
	 * Generate an access token and a refresh token in parallel.
	 *
	 * @param user - The FlatUserResponse to embed (roles and permissions are included)
	 * @param refreshTokenId - The UUID of the refresh token record — the device
	 *   session: the refresh token's `jti` and the access token's `sid` (ADR 034).
	 *   Rotation updates the row in place, so it is stable for the session's life.
	 */
	public async generateTokens(
		user: FlatUserResponse,
		refreshTokenId: string,
		options: AccessTokenGenerationOptions = {},
	): Promise<{ accessToken: string; refreshToken: string }> {
		const sessionScope: SessionScope = options.sessionScope ?? "full";
		const accessPayload: AccessTokenPayload = {
			sub: user.id,
			id: user.id,
			email: user.email,
			fullName: user.fullName,
			isActive: user.isActive,
			isSuperAdmin: user.isSuperAdmin,
			isEmailVerified: user.isEmailVerified,
			hasAdminAccess: user.hasAdminAccess,
			tokenVersion: user.tokenVersion,
			sessionScope,
			mfaAssuredAt: options.mfaAssuredAt,
			sid: refreshTokenId,
		};

		// `jti` is the session (refresh-token row) id and stays the same across
		// rotations, and `iat` has one-second resolution — without a per-issue
		// nonce, two rotations within the same second would mint the SAME token,
		// so the "rotated" token would still be the current one and reuse
		// detection could not tell a replay from a legitimate refresh.
		const refreshPayload = {
			sub: user.id,
			email: user.email,
			jti: refreshTokenId,
			tokenType: "refresh",
			nonce: randomUUID(),
		};

		const [accessToken, refreshToken] = await Promise.all([
			this.jwtService.signAsync(accessPayload, {
				secret: this.config.auth.jwtAccessSecret,
				expiresIn: parseExpiryToSeconds(this.config.auth.jwtAccessExpiry),
			}),
			this.jwtService.signAsync(refreshPayload, {
				secret: this.config.auth.jwtRefreshSecret,
				expiresIn: parseExpiryToSeconds(this.config.auth.jwtRefreshExpiry),
			}),
		]);

		return { accessToken, refreshToken };
	}

	/**
	 * Generate rotated session tokens with an explicit scope (login / refresh).
	 * Callers must pass `sessionScope` — refresh must never default to `full`.
	 */
	public async generateSessionTokens(
		user: FlatUserResponse,
		refreshTokenId: string,
		options: SessionTokenGenerationOptions,
	): Promise<{ accessToken: string; refreshToken: string }> {
		return this.generateTokens(user, refreshTokenId, options);
	}

	/** Generate a fresh access token for an existing device session (`sid`), without rotating its refresh token. */
	public async generateAccessToken(user: FlatUserResponse, sessionId: string, options: AccessTokenGenerationOptions = {}): Promise<string> {
		const sessionScope: SessionScope = options.sessionScope ?? "full";
		const accessPayload: AccessTokenPayload = {
			sub: user.id,
			id: user.id,
			email: user.email,
			fullName: user.fullName,
			isActive: user.isActive,
			isSuperAdmin: user.isSuperAdmin,
			isEmailVerified: user.isEmailVerified,
			hasAdminAccess: user.hasAdminAccess,
			tokenVersion: user.tokenVersion,
			sessionScope,
			mfaAssuredAt: options.mfaAssuredAt,
			sid: sessionId,
		};

		return this.jwtService.signAsync(accessPayload, {
			secret: this.config.auth.jwtAccessSecret,
			expiresIn: parseExpiryToSeconds(this.config.auth.jwtAccessExpiry),
		});
	}

	/**
	 * Verify an access token and return the decoded payload.
	 * Throws UnauthorizedException with distinct messages for expired vs invalid tokens.
	 */
	public async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
		try {
			const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
				secret: this.config.auth.jwtAccessSecret,
			});
			return AccessTokenPayloadSchema.parse(payload);
		} catch (error) {
			const caught = CaughtValueSchema.parse(error);
			if (caught instanceof TokenExpiredError) {
				throw new UnauthorizedException({
					message: "Access token has expired",
					error: "ACCESS_TOKEN_EXPIRED",
				});
			}
			if (caught instanceof ZodError) {
				this.logger.error(`Access token payload failed schema validation: ${caught.message}`);
			}
			throw new UnauthorizedException({
				message: "Invalid or malformed access token",
				error: "ACCESS_TOKEN_INVALID",
			});
		}
	}

	/**
	 * Verify a refresh token and return the decoded payload.
	 * Throws UnauthorizedException with distinct messages.
	 */
	public async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
		try {
			const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(token, {
				secret: this.config.auth.jwtRefreshSecret,
			});
			return RefreshTokenPayloadSchema.parse(payload);
		} catch (error) {
			const caught = CaughtValueSchema.parse(error);
			if (caught instanceof TokenExpiredError) {
				throw new UnauthorizedException({
					message: "Refresh token has expired",
					error: "REFRESH_TOKEN_EXPIRED",
				});
			}
			if (caught instanceof ZodError) {
				this.logger.error(`Refresh token payload failed schema validation: ${caught.message}`);
			}
			throw new UnauthorizedException({
				message: "Invalid or malformed refresh token",
				error: "REFRESH_TOKEN_INVALID",
			});
		}
	}

	/**
	 * Generate a short-lived email verification JWT for the given email.
	 */
	public async generateEmailVerificationToken(email: string): Promise<string> {
		return this.jwtService.signAsync(
			{ sub: email, purpose: "email_verification" },
			{
				secret: this.config.auth.emailVerificationSecret,
				expiresIn: EMAIL_VERIFICATION_LINK_TTL_HOURS * SECONDS_PER_HOUR,
			},
		);
	}

	/**
	 * Verify an email verification token and return the email.
	 */
	public async verifyEmailToken(token: string): Promise<string> {
		try {
			const payload: EmailVerificationTokenPayload = EmailVerificationTokenPayloadSchema.parse(
				await this.jwtService.verifyAsync(token, {
					secret: this.config.auth.emailVerificationSecret,
				}),
			);
			return payload.sub;
		} catch (error) {
			const caught = CaughtValueSchema.parse(error);
			if (caught instanceof UnauthorizedException) throw caught;
			throw new UnauthorizedException("Invalid or expired verification token");
		}
	}

	/**
	 * Generate a short-lived impersonation access token.
	 * Used when a SuperAdmin impersonates another user.
	 * No refresh token is created — the SuperAdmin's original session remains intact.
	 * The token is bound to its server-side impersonation session
	 * (`impersonationSessionId`), which `AuthGuard` checks on every request, so
	 * stopping the impersonation revokes the token before it expires.
	 *
	 * @param user - The impersonated user's FlatUserResponse
	 * @param originalUserId - The SuperAdmin's actual user ID
	 * @param impersonationSessionId - The `ImpersonationSession` row id
	 */
	public async generateImpersonationToken(user: FlatUserResponse, originalUserId: string, impersonationSessionId: string): Promise<string> {
		// JWT carries identity + lightweight flags (same as generateTokens).
		const payload: AccessTokenPayload = {
			sub: user.id,
			id: user.id,
			email: user.email,
			fullName: user.fullName,
			isActive: user.isActive,
			isSuperAdmin: user.isSuperAdmin,
			isEmailVerified: user.isEmailVerified,
			hasAdminAccess: user.hasAdminAccess,
			tokenVersion: user.tokenVersion,
			isImpersonating: true,
			originalUserId,
			impersonationSessionId,
		};

		return this.jwtService.signAsync(payload, {
			secret: this.config.auth.jwtAccessSecret,
			expiresIn: IMPERSONATION_TOKEN_TTL_SECONDS,
		});
	}

	/** Signs the reference of a two-factor login challenge (the `tempToken` between password and second factor). */
	public async signChallengeRef(payload: TwoFactorChallengeRefPayload): Promise<string> {
		return this.jwtService.signAsync(payload, {
			secret: this.config.auth.twoFactorPendingSecret,
			expiresIn: CHALLENGE_REF_EXPIRY_SECONDS,
		});
	}

	/** Verifies a challenge reference. Throws 401 for an expired or invalid one. */
	public async verifyChallengeRef(token: string): Promise<VerifiedChallengeRef> {
		try {
			const payload = TwoFactorChallengeRefPayloadSchema.parse(await this.jwtService.verifyAsync(token, { secret: this.config.auth.twoFactorPendingSecret }));
			return {
				userId: payload.sub,
				challengeId: payload.challengeId,
				purpose: payload.purpose,
				clientType: payload.clientType,
				deviceInfo: payload.deviceInfo,
				ipAddress: payload.ipAddress,
			};
		} catch (error) {
			const caught = CaughtValueSchema.parse(error);
			if (caught instanceof UnauthorizedException) {
				throw caught;
			}
			if (caught instanceof TokenExpiredError) {
				throw new UnauthorizedException("MFA challenge expired — sign in again");
			}
			if (caught instanceof ZodError) {
				this.logger.error(`MFA challenge ref payload failed schema validation: ${caught.message}`);
			}
			throw new UnauthorizedException("Invalid or expired MFA challenge");
		}
	}
}
