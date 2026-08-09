import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
// `jsonwebtoken` is CJS; its named export `TokenExpiredError` is not statically
// detectable by Node's ESM-CJS interop (cjs-module-lexer), so a named import
// crashes under true ESM. The default import IS module.exports, which exposes
// the error class at runtime (and is fully typed via `export =` declarations).
import jwt from "jsonwebtoken";

import { z, ZodError } from "zod";

import { FlatUserResponse, JwtPermission, JwtPermissionSchema } from "../../rbac/rbac.interface.js";
import { parseExpiryToSeconds } from "../../../common/utils/expiry.js";
import { TypedConfigService } from "../../../config/typed-config.service.js";

// `TokenExpiredError` is exposed at runtime on the CJS default export — see the
// comment on the `jsonwebtoken` import above for why it can't be named-imported.
const { TokenExpiredError } = jwt;

/**
 * The shape embedded in the JWT payload (access token).
 *
 * Permissions use the ultra-slim `JwtPermission` type (action + resource only)
 * so the JWT stays under the browser cookie size limit (~4 KB). The full
 * `PermissionDetails` (with id and description) is reconstructed by AuthGuard
 * when attaching the payload to `request.user` — the guards only check
 * action+resource, so the slim format is sufficient.
 */
export const AccessTokenPayloadSchema = z.object({
	sub: z.string(),
	id: z.string(),
	email: z.string(),
	fullName: z.string(),
	isActive: z.boolean(),
	isSuperAdmin: z.boolean(),
	isEmailVerified: z.boolean(),
	hasAdminAccess: z.boolean(),
	roles: z.array(z.object({ id: z.string(), name: z.string(), description: z.string().nullable() })),
	permissions: z.array(JwtPermissionSchema),

	/** Set to true when a SuperAdmin is impersonating this user */
	isImpersonating: z.boolean().optional(),
	/** The SuperAdmin's original user ID (only set when isImpersonating === true) */
	originalUserId: z.string().optional(),

	iat: z.number().optional(),
	exp: z.number().optional(),
});

export type AccessTokenPayload = z.output<typeof AccessTokenPayloadSchema>;

/**
 * The shape embedded in the refresh token JWT payload.
 * Includes a `jti` (JWT ID) for direct database lookup without iterating all tokens.
 */
export const RefreshTokenPayloadSchema = z.object({
	sub: z.string(),
	email: z.string(),
	/**
	 * JWT ID — stored in the RefreshToken model's `id` field.
	 * Allows direct DB lookup without iterating all tokens.
	 */
	jti: z.string(),
	tokenType: z.literal("refresh"),
	iat: z.number(),
	exp: z.number(),
});

export type RefreshTokenPayload = z.output<typeof RefreshTokenPayloadSchema>;

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
		// Map full PermissionDetails[] → slim JwtPermission[] for the JWT
		// to keep the access token cookie under ~4 KB.
		const slimPermissions: JwtPermission[] = user.permissions.map((p) => ({
			action: p.action,
			resource: p.resource,
		}));

		const accessPayload: AccessTokenPayload = {
			sub: user.id,
			id: user.id,
			email: user.email,
			fullName: user.fullName,
			isActive: user.isActive,
			isSuperAdmin: user.isSuperAdmin,
			isEmailVerified: user.isEmailVerified,
			hasAdminAccess: user.hasAdminAccess,
			roles: user.roles,
			permissions: slimPermissions,
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

	/**
	 * Verify an access token and return the decoded payload.
	 * Throws UnauthorizedException with distinct messages for expired vs invalid tokens.
	 */
	public async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
		try {
			const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
				secret: this.config.jwtAccessSecret,
			});
			// Runtime-validate the decoded claims so a structurally-wrong token
			// (missing fields / wrong types) is rejected here, not deep inside a
			// guard. A malformed payload lands in the same catch below as an
			// invalid token.
			return AccessTokenPayloadSchema.parse(payload);
		} catch (error: unknown) {
			if (error instanceof TokenExpiredError) {
				throw new UnauthorizedException({
					message: "Access token has expired",
					error: "ACCESS_TOKEN_EXPIRED",
				});
			}
			// A ZodError here means OUR schema drifted from the tokens we sign
			// (not a client attack) — log it loudly so it's not mistaken for
			// malicious traffic at 2 AM.
			if (error instanceof ZodError) {
				this.logger.error(`Access token payload failed schema validation: ${error.message}`);
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
			// Runtime-validate the decoded claims (see verifyAccessToken).
			return RefreshTokenPayloadSchema.parse(payload);
		} catch (error: unknown) {
			if (error instanceof TokenExpiredError) {
				throw new UnauthorizedException({
					message: "Refresh token has expired",
					error: "REFRESH_TOKEN_EXPIRED",
				});
			}
			if (error instanceof ZodError) {
				this.logger.error(`Refresh token payload failed schema validation: ${error.message}`);
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
			const payload = await this.jwtService.verifyAsync<{ sub: string; purpose: string }>(token, {
				secret: this.config.emailVerificationSecret,
			});
			if (payload.purpose !== "email_verification") {
				throw new UnauthorizedException("Invalid verification token");
			}
			return payload.sub;
		} catch (error: unknown) {
			if (error instanceof UnauthorizedException) throw error;
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
	 */
	public async generateImpersonationToken(user: FlatUserResponse, originalUserId: string): Promise<string> {
		const slimPermissions: JwtPermission[] = user.permissions.map((p) => ({
			action: p.action,
			resource: p.resource,
		}));

		const payload: AccessTokenPayload = {
			sub: user.id,
			id: user.id,
			email: user.email,
			fullName: user.fullName,
			isActive: user.isActive,
			isSuperAdmin: user.isSuperAdmin,
			isEmailVerified: user.isEmailVerified,
			hasAdminAccess: user.hasAdminAccess,
			roles: user.roles,
			permissions: slimPermissions,
			isImpersonating: true,
			originalUserId,
		};

		// Impersonation tokens are short-lived (15 minutes) to limit exposure
		return this.jwtService.signAsync(payload, {
			secret: this.config.jwtAccessSecret,
			expiresIn: 900, // 15 minutes
		});
	}
}
