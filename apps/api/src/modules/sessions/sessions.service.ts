import { Injectable, UnauthorizedException } from "@nestjs/common";
import {
	SessionActionEventSchema,
	SessionSchema,
	epochMs,
	type EpochMs,
	type FlatUserResponse,
	type PlatformEventInput,
	type RefreshResponse,
	type Session,
	type SessionActionEvent,
} from "@workspace/shared";

import { parseExpiryToMilliseconds } from "../../common/utils/expiry";
import { TypedConfigService } from "../../config/typed-config.service";
import { PlatformOutboxService } from "../../infrastructure/outbox/platform-outbox.service";
import { LogService } from "../../modules/logs/logs.service";
import { AuthorizationCheckerService } from "../authorization/services/authorization-checker.service";
import { UserSessionRevocationService } from "../authorization/services/user-session-revocation.service";
import { UserRepository } from "../auth/repositories/user.repository";
import { UserResponseMapper } from "../auth/services/user-response.mapper";
import { CryptoService } from "../auth/services/crypto.service";
import { SessionRestrictionService } from "../auth/services/session-restriction.service";
import { TokenService } from "../auth/services/token.service";
import { REFRESH_SUPERSEDED_GRACE_MS } from "./constants/refresh-token-rotation.constants";
import { RefreshTokenRepository } from "./repositories/refresh-token.repository";

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
		private readonly outbox: PlatformOutboxService,
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
			// Only the IMMEDIATE predecessor of the current token (its hash is
			// `previousTokenHash`), presented within the grace window, is a benign
			// concurrent refresh. Any other token of this session is reuse.
			const isWithinGrace: boolean = storedToken.updatedAt >= Date.now() - REFRESH_SUPERSEDED_GRACE_MS;
			const isImmediatePredecessor: boolean =
				isWithinGrace && storedToken.previousTokenHash !== null && (await this.cryptoService.compare(rawRefreshTokenJwt, storedToken.previousTokenHash));
			if (isImmediatePredecessor) {
				await this.outbox.recordTelemetry(sessionActionEvent("refresh", user.id, "REFRESH_TOKEN_SUPERSEDED", actionStartedAt));
				throw new UnauthorizedException({
					message: "Refresh token was already rotated. Please retry with the latest session.",
					error: "REFRESH_TOKEN_SUPERSEDED",
				});
			}

			throw await this.revokeAllSessionsOnReuse(user.id, storedToken.id, actionStartedAt);
		}

		const userPermissions = await this.authorizationChecker.getUserPermissionDetails(user.id);
		const isEmailVerified = user.emailVerifiedAt !== null && user.emailVerifiedAt <= Date.now();
		const flatUser: FlatUserResponse = this.mapper.toFlatUser(user, userPermissions, isEmailVerified);
		const now: number = Date.now();
		const { sessionScope, mfaAssuredAt } = this.sessionRestriction.resolveSessionTokens(user, now);

		const expiryMs = parseExpiryToMilliseconds(this.config.auth.jwtRefreshExpiry);
		const expiresAt: EpochMs = epochMs(now + expiryMs);

		const tokens = await this.tokenService.generateSessionTokens(flatUser, storedToken.id, {
			sessionScope,
			mfaAssuredAt,
		});
		const hashedRt = await this.cryptoService.hash(tokens.refreshToken);

		const rotationResult = await this.repository.rotateTokenIfHashMatches(
			storedToken.id,
			storedToken.token,
			{
				token: hashedRt,
				deviceInfo: deviceInfo ?? storedToken.deviceInfo,
				ipAddress: ipAddress ?? storedToken.ipAddress,
				expiresAt,
			},
			async (tx): Promise<void> => {
				await this.outbox.enqueueInTransaction(tx, sessionActionEvent("refresh", user.id, null, actionStartedAt));
			},
		);

		if (rotationResult === "superseded") {
			await this.outbox.recordTelemetry(sessionActionEvent("refresh", user.id, "REFRESH_TOKEN_SUPERSEDED", actionStartedAt));
			throw new UnauthorizedException({
				message: "Refresh token was already rotated. Please retry with the latest session.",
				error: "REFRESH_TOKEN_SUPERSEDED",
			});
		}

		if (rotationResult === "reused") {
			throw await this.revokeAllSessionsOnReuse(user.id, storedToken.id, actionStartedAt);
		}

		if (rotationResult === "missing") {
			throw new UnauthorizedException({
				message: "Invalid refresh token",
				error: "REFRESH_TOKEN_INVALID",
			});
		}

		return tokens;
	}

	public async logoutDevice(userId: string, refreshTokenJti: string): Promise<void> {
		const actionStartedAt: number = performance.now();
		const revoked: boolean = await this.repository.revokeLiveToken(refreshTokenJti, userId, async (tx): Promise<void> => {
			await this.outbox.enqueueInTransaction(tx, sessionActionEvent("logout-device", userId, null, actionStartedAt));
		});

		if (!revoked) {
			// Nothing to revoke (unknown, foreign, or already-revoked token) — logout is
			// idempotent, so the outcome is still "succeeded", but there was no domain
			// write for the event to be atomic with.
			await this.outbox.recordTelemetry(sessionActionEvent("logout-device", userId, null, actionStartedAt));
		}
	}

	public async logoutAllDevices(userId: string): Promise<void> {
		const actionStartedAt: number = performance.now();
		await this.sessionRevocation.revokeAllSessionsForUser(userId, "logout_all_devices", async (tx): Promise<void> => {
			await this.outbox.enqueueInTransaction(tx, sessionActionEvent("logout-all", userId, null, actionStartedAt));
		});
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

	/**
	 * Refresh-token reuse (theft signal): revoke every session of the user and
	 * bump `tokenVersion`, recording the event in the same transaction. Returns
	 * the 401 the caller throws (`throw await …`).
	 */
	private async revokeAllSessionsOnReuse(userId: string, tokenId: string, actionStartedAt: number): Promise<UnauthorizedException> {
		this.logService.warn("Suspicious activity: token reuse detected — revoking all sessions", {
			userId,
			context: "SessionsService",
			metadata: { tokenId },
		});

		await this.sessionRevocation.revokeAllSessionsForUser(userId, "refresh_token_reuse", async (tx): Promise<void> => {
			await this.outbox.enqueueInTransaction(tx, sessionActionEvent("refresh", userId, "TOKEN_THEFT_DETECTED", actionStartedAt));
		});
		return new UnauthorizedException({
			message: "Suspicious activity detected. All sessions have been revoked. Please log in again.",
			error: "TOKEN_THEFT_DETECTED",
		});
	}
}

/**
 * `session.action` outbox event. `error === null` means the action succeeded;
 * a non-null error code marks it failed.
 */
function sessionActionEvent(action: SessionActionEvent["action"], userId: string, error: string | null, startedAt: number): PlatformEventInput {
	return {
		type: "session.action",
		payload: SessionActionEventSchema.parse({
			action,
			userId,
			status: error === null ? "succeeded" : "failed",
			error,
			durationMs: Math.round(performance.now() - startedAt),
		}),
	};
}
