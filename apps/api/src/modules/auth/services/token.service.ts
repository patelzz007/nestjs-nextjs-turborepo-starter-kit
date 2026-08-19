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
	RefreshTokenPayloadSchema,
	type AccessTokenPayload,
	type FlatUserResponse,
	type JwtPermission,
	type RefreshTokenPayload,
} from "@workspace/shared";

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
		const slimPermissions: JwtPermission[] = compressPermissions(user.permissions);

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
			return AccessTokenPayloadSchema.parse(payload);
		} catch (error: unknown) {
			if (error instanceof TokenExpiredError) {
				throw new UnauthorizedException({
					message: "Access token has expired",
					error: "ACCESS_TOKEN_EXPIRED",
				});
			}
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
			const payload = await this.jwtService.verifyAsync(token, {
				secret: this.config.emailVerificationSecret,
			});
			const parsed = EmailVerificationTokenPayloadSchema.parse(payload);
			return parsed.sub;
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
		const slimPermissions: JwtPermission[] = compressPermissions(user.permissions);

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

		return this.jwtService.signAsync(payload, {
			secret: this.config.jwtAccessSecret,
			expiresIn: 900, // 15 minutes
		});
	}
}

// ── Permission compression ─────────────────────────────────────────────────

/**
 * Compress a full permissions list into the smallest set that still satisfies
 * the PermissionGuard.  For each resource:
 *   - If MANAGE is present, store ONLY MANAGE (it grants every action on that
 *     resource, so the individual actions are redundant).
 *   - Otherwise store all unique actions.
 */
function compressPermissions(permissions: readonly { readonly action: string; readonly resource: string }[]): JwtPermission[] {
	const byResource = new Map<string, Set<string>>();
	for (const p of permissions) {
		let actions = byResource.get(p.resource);
		if (actions === undefined) {
			actions = new Set();
			byResource.set(p.resource, actions);
		}
		actions.add(p.action);
	}

	const result: JwtPermission[] = [];
	for (const [resource, actions] of byResource) {
		if (actions.has("MANAGE")) {
			result.push({ action: "MANAGE", resource });
		} else {
			for (const action of actions) {
				result.push({ action, resource });
			}
		}
	}
	return result;
}
