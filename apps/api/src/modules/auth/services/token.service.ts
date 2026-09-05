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
	TwoFactorPendingTokenPayloadSchema,
	type EmailVerificationTokenPayload,
	RefreshTokenPayloadSchema,
	type AccessTokenPayload,
	type FlatUserResponse,
	type RefreshTokenPayload,
} from "@workspace/shared";

import { CaughtValueSchema } from "@workspace/shared";
import { parseExpiryToSeconds } from "../../../common/utils/expiry";
import { TypedConfigService } from "../../../config/typed-config.service";

// `TokenExpiredError` is exposed at runtime on the CJS default export — see the
// comment on the `jsonwebtoken` import above for why it can't be named-imported.
const { TokenExpiredError } = jwt;

export type { AccessTokenPayload, RefreshTokenPayload } from "@workspace/shared";

@Injectable()
export class TokenService {
	private readonly logger: Logger = new Logger(TokenService.name);

	constructor(
		private readonly jwtService: JwtService,
		private readonly config: TypedConfigService,
	) {}

	/**
	 * Generate an access token and a refresh token in parallel.
	 *
	 * @param user - The FlatUserResponse to embed (roles and permissions are included)
	 * @param refreshTokenId - The UUID of the refresh token record (used as JWT `jti`)
	 */
	public async generateTokens(user: FlatUserResponse, refreshTokenId: string): Promise<{ accessToken: string; refreshToken: string }> {
		// JWT carries identity + lightweight flags. Full permission resolution
		// happens at guard time via AuthorizationCheckerService.
		// `hasAdminAccess` is included because the Next.js proxy (proxy.ts)
		// needs it synchronously for route-level gating.
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
		};

		const refreshPayload = {
			sub: user.id,
			email: user.email,
			jti: refreshTokenId,
			tokenType: "refresh",
		};

		const [accessToken, refreshToken] = await Promise.all([
			this.jwtService.signAsync(accessPayload, {
				secret: this.config.jwtAccessSecret,
				expiresIn: parseExpiryToSeconds(this.config.jwtAccessExpiry),
			}),
			this.jwtService.signAsync(refreshPayload, {
				secret: this.config.jwtRefreshSecret,
				expiresIn: parseExpiryToSeconds(this.config.jwtRefreshExpiry),
			}),
		]);

		return { accessToken, refreshToken };
	}

	/** Generate a fresh access token (no refresh token rotation). */
	public async generateAccessToken(user: FlatUserResponse): Promise<string> {
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
		};

		return this.jwtService.signAsync(accessPayload, {
			secret: this.config.jwtAccessSecret,
			expiresIn: parseExpiryToSeconds(this.config.jwtAccessExpiry),
		});
	}

	/**
	 * Verify an access token and return the decoded payload.
	 * Throws UnauthorizedException with distinct messages for expired vs invalid tokens.
	 */
	public async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
		try {
			const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
				secret: this.config.jwtAccessSecret,
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
				secret: this.config.jwtRefreshSecret,
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
				secret: this.config.emailVerificationSecret,
				expiresIn: 86400, // 24 hours
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
					secret: this.config.emailVerificationSecret,
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
	 *
	 * @param user - The impersonated user's FlatUserResponse
	 * @param originalUserId - The SuperAdmin's actual user ID
	 */ public async generateImpersonationToken(user: FlatUserResponse, originalUserId: string): Promise<string> {
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
		};

		return this.jwtService.signAsync(payload, {
			secret: this.config.jwtAccessSecret,
			expiresIn: 900, // 15 minutes
		});
	}

	/**
	 * Generate a short-lived token used between password login and 2FA verification.
	 */
	public async generateTwoFactorPendingToken(userId: string, clientType: string | null, deviceInfo: string | null, ipAddress: string | null): Promise<string> {
		return this.jwtService.signAsync(
			{
				sub: userId,
				purpose: "two_factor_login",
				clientType,
				deviceInfo,
				ipAddress,
			},
			{
				secret: this.config.twoFactorPendingSecret,
				expiresIn: 600,
			},
		);
	}

	/**
	 * Verify a 2FA login step token and return its payload.
	 */
	public async verifyTwoFactorPendingToken(token: string): Promise<{
		readonly sub: string;
		readonly clientType: string | null;
		readonly deviceInfo: string | null;
		readonly ipAddress: string | null;
	}> {
		try {
			const payload = TwoFactorPendingTokenPayloadSchema.parse(
				await this.jwtService.verifyAsync(token, {
					secret: this.config.twoFactorPendingSecret,
				}),
			);
			return {
				sub: payload.sub,
				clientType: payload.clientType,
				deviceInfo: payload.deviceInfo,
				ipAddress: payload.ipAddress,
			};
		} catch (error) {
			const caught = CaughtValueSchema.parse(error);
			if (caught instanceof UnauthorizedException) throw caught;
			if (caught instanceof TokenExpiredError) {
				throw new UnauthorizedException("2FA session expired — sign in again");
			}
			if (caught instanceof ZodError) {
				this.logger.error(`2FA pending token payload failed schema validation: ${caught.message}`);
			}
			throw new UnauthorizedException("Invalid or expired 2FA session");
		}
	}
}
