import { Injectable, UnauthorizedException } from "@nestjs/common";
import { SessionActionEventSchema, SessionSchema, epochMs, type EpochMs, type FlatUserResponse, type RefreshResponse, type Session } from "@workspace/shared";

import { parseExpiryToMilliseconds } from "../../common/utils/expiry";
import { TypedConfigService } from "../../config/typed-config.service";
import { LogService } from "../../modules/logs/logs.service";
import { AuthorizationCheckerService } from "../authorization/services/authorization-checker.service";
import { UserSessionRevocationService } from "../authorization/services/user-session-revocation.service";
import { UserRepository } from "../auth/repositories/user.repository";
import { UserResponseMapper } from "../auth/services/user-response.mapper";
import { CryptoService } from "../auth/services/crypto.service";
import { AccessTokenStateService } from "../auth/services/access-token-state.service";
import { SessionRestrictionService } from "../auth/services/session-restriction.service";
import { TokenService } from "../auth/services/token.service";
import { RefreshTokenRepository } from "./repositories/refresh-token.repository";
import { SessionsEventsService } from "./sessions-events.service";

/** Grace window after rotation where a stale presentation is treated as superseded, not theft. */
const REFRESH_SUPERSEDED_GRACE_MS = 30_000;

/**
 * Owns the refresh-token / active-session lifecycle: token rotation,
 * device logout, logout-all, and the active-session list.
 */
@Injectable()
export class SessionsService {
	public constructor(
		private readonly repository: RefreshTokenRepository,
		private readonly users: UserRepository,
		private readonly tokenService: TokenService,
		private readonly cryptoService: CryptoService,
		private readonly config: TypedConfigService,
		private readonly logService: LogService,
		private readonly authorizationChecker: AuthorizationCheckerService,
		private readonly mapper: UserResponseMapper,
		private readonly sessionsEvents: SessionsEventsService,
		private readonly accessTokenState: AccessTokenStateService,
		private readonly sessionRevocation: UserSessionRevocationService,
		private readonly sessionRestriction: SessionRestrictionService,
	) {}

	public async refreshToken(userId: string, rawRefreshTokenJwt: string, refreshTokenJti: string, deviceInfo?: string, ipAddress?: string): Promise<RefreshResponse> {
		const actionStartedAt: number = performance.now();
		const user = await this.users.findLoginById(userId);

		if (!user) {
			throw new UnauthorizedException({
				message: "User account no longer exists. Please log in again.",
				error: "USER_NOT_FOUND",
			});
		}

		if (!user.isActive) {
			throw new UnauthorizedException({
				message: "Account is inactive. Please contact support.",
				error: "ACCOUNT_IS_INACTIVE",
			});
		}

		if (user.isDeleted) {
			throw new UnauthorizedException({
				message: "Account has been deleted. Please contact support.",
				error: "ACCOUNT_DELETED",
			});
		}

		const storedToken = await this.repository.findByIdIncludingDeleted(refreshTokenJti);

		if (storedToken?.userId !== userId) {
			throw new UnauthorizedException({
				message: "Invalid refresh token",
				error: "REFRESH_TOKEN_INVALID",
			});
		}

		if (storedToken.expiresAt < Date.now()) {
			throw new UnauthorizedException("Refresh token has expired");
		}

		if (storedToken.isDeleted) {
			throw new UnauthorizedException({
				message: "Refresh token has been revoked. Please log in again.",
				error: "REFRESH_TOKEN_REVOKED",
			});
		}

		const tokenMatches = await this.cryptoService.compare(rawRefreshTokenJwt, storedToken.token);
		if (!tokenMatches) {
			const recentlyRotated: boolean = storedToken.updatedAt >= Date.now() - REFRESH_SUPERSEDED_GRACE_MS;
			if (recentlyRotated && storedToken.previousTokenHash !== null) {
				const matchesPrevious = await this.cryptoService.compare(rawRefreshTokenJwt, storedToken.previousTokenHash);
				if (matchesPrevious) {
					this.sessionsEvents.emitAction(
						SessionActionEventSchema.parse({
							action: "refresh",
							userId: user.id,
							status: "failed",
							error: "REFRESH_TOKEN_SUPERSEDED",
							durationMs: Math.round(performance.now() - actionStartedAt),
						}),
					);
					throw new UnauthorizedException({
						message: "Refresh token was already rotated. Please retry with the latest session.",
						error: "REFRESH_TOKEN_SUPERSEDED",
					});
				}
			}

			if (recentlyRotated) {
				this.sessionsEvents.emitAction(
					SessionActionEventSchema.parse({
						action: "refresh",
						userId: user.id,
						status: "failed",
						error: "REFRESH_TOKEN_SUPERSEDED",
						durationMs: Math.round(performance.now() - actionStartedAt),
					}),
				);
				throw new UnauthorizedException({
					message: "Refresh token was already rotated. Please retry with the latest session.",
					error: "REFRESH_TOKEN_SUPERSEDED",
				});
			}

			this.logService.warn("Suspicious activity: token reuse detected — revoking all sessions", {
				userId: user.id,
				context: "SessionsService",
				metadata: { tokenId: storedToken.id },
			});

			await this.repository.revokeAllForUsers([user.id]);
			await this.accessTokenState.bumpTokenVersion(user.id);

			this.sessionsEvents.emitAction(
				SessionActionEventSchema.parse({
					action: "refresh",
					userId: user.id,
					status: "failed",
					error: "TOKEN_THEFT_DETECTED",
					durationMs: Math.round(performance.now() - actionStartedAt),
				}),
			);
			throw new UnauthorizedException({
				message: "Suspicious activity detected. All sessions have been revoked. Please log in again.",
				error: "TOKEN_THEFT_DETECTED",
			});
		}

		const userPermissions = await this.authorizationChecker.getUserPermissionDetails(user.id);
		const isEmailVerified = user.emailVerifiedAt !== null && user.emailVerifiedAt <= Date.now();
		const flatUser: FlatUserResponse = this.mapper.toFlatUser(user, userPermissions, isEmailVerified);
		const now: number = Date.now();
		const { sessionScope, mfaAssuredAt } = this.sessionRestriction.resolveSessionTokens(user, now);

		const expiryMs = parseExpiryToMilliseconds(this.config.jwtRefreshExpiry);
		const expiresAt: EpochMs = epochMs(now + expiryMs);

		const tokens = await this.tokenService.generateSessionTokens(flatUser, storedToken.id, {
			sessionScope,
			mfaAssuredAt,
		});
		const hashedRt = await this.cryptoService.hash(tokens.refreshToken);

		const rotationResult = await this.repository.rotateTokenIfHashMatches(storedToken.id, storedToken.token, {
			token: hashedRt,
			deviceInfo: deviceInfo ?? storedToken.deviceInfo,
			ipAddress: ipAddress ?? storedToken.ipAddress,
			expiresAt,
		});

		if (rotationResult === "superseded") {
			this.sessionsEvents.emitAction(
				SessionActionEventSchema.parse({
					action: "refresh",
					userId: user.id,
					status: "failed",
					error: "REFRESH_TOKEN_SUPERSEDED",
					durationMs: Math.round(performance.now() - actionStartedAt),
				}),
			);
			throw new UnauthorizedException({
				message: "Refresh token was already rotated. Please retry with the latest session.",
				error: "REFRESH_TOKEN_SUPERSEDED",
			});
		}

		if (rotationResult === "missing") {
			throw new UnauthorizedException({
				message: "Invalid refresh token",
				error: "REFRESH_TOKEN_INVALID",
			});
		}

		this.sessionsEvents.emitAction(
			SessionActionEventSchema.parse({
				action: "refresh",
				userId: user.id,
				status: "succeeded",
				error: null,
				durationMs: Math.round(performance.now() - actionStartedAt),
			}),
		);

		return tokens;
	}

	public async logoutDevice(userId: string, refreshTokenJti: string): Promise<void> {
		const actionStartedAt: number = performance.now();
		const storedToken = await this.repository.findByIdIncludingDeleted(refreshTokenJti);

		if (storedToken?.userId === userId) {
			await this.repository.revokeById(storedToken.id);
		}

		this.sessionsEvents.emitAction(
			SessionActionEventSchema.parse({
				action: "logout-device",
				userId,
				status: "succeeded",
				error: null,
				durationMs: Math.round(performance.now() - actionStartedAt),
			}),
		);
	}

	public async logoutAllDevices(userId: string): Promise<void> {
		const actionStartedAt: number = performance.now();
		await this.sessionRevocation.revokeAllSessionsForUser(userId);

		this.sessionsEvents.emitAction(
			SessionActionEventSchema.parse({
				action: "logout-all",
				userId,
				status: "succeeded",
				error: null,
				durationMs: Math.round(performance.now() - actionStartedAt),
			}),
		);
	}

	public async getSessions(userId: string): Promise<Session[]> {
		const tokens = await this.repository.listActiveSessionsForUser(userId);

		return tokens.map((token) =>
			SessionSchema.parse({
				id: token.id,
				deviceInfo: token.deviceInfo,
				ipAddress: token.ipAddress,
				createdAt: token.createdAt,
				expiresAt: token.expiresAt,
			}),
		);
	}
}
