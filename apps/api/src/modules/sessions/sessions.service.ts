import { Injectable, UnauthorizedException } from "@nestjs/common";
import {
	DEVICE_SESSION_ERROR_CODES,
	SessionActionEventSchema,
	epochMs,
	type EpochMs,
	type FlatUserResponse,
	type PlatformEventInput,
	type RefreshResponse,
	type Session,
	type SessionActionEvent,
} from "@workspace/shared";

import { NotFoundError } from "../../common/errors/app-error";
import { parseExpiryToMilliseconds } from "../../common/utils/expiry";
import { TypedConfigService } from "../../config/typed-config.service";
import { PlatformOutboxService } from "../../infrastructure/outbox/platform-outbox.service";
import { LogService } from "../../modules/logs/logs.service";
import { AuthorizationInvalidationService } from "../authorization/cache/authorization-invalidation.service";
import { AuthorizationCheckerService } from "../authorization/services/authorization-checker.service";
import { UserSessionRevocationService } from "../authorization/services/user-session-revocation.service";
import { UserRepository } from "../auth/repositories/user.repository";
import { UserResponseMapper } from "../auth/services/user-response.mapper";
import { CryptoService } from "../auth/services/crypto.service";
import { SessionRestrictionService } from "../auth/services/session-restriction.service";
import { TokenService } from "../auth/services/token.service";
import { REFRESH_SUPERSEDED_GRACE_MS } from "./constants/refresh-token-rotation.constants";
import type { SessionDeviceContext } from "./device/session-device";
import { buildSessionDeviceLabel } from "./device/session-device-label";
import { revokedBySystem, revokedByUser } from "./device/session-revoker";
import { RefreshTokenRepository, type DeviceSessionRecord, type SessionRevocationOutcome } from "./repositories/refresh-token.repository";

/** Result of {@link SessionsService.revokeSession}. */
export interface SessionRevocationResult {
	/** The revoked session is the one the request came from: it is signed out. */
	readonly revokedCurrentSession: boolean;
}

/**
 * Owns the device-session lifecycle (docs/technical/mobile/mobile-app.md §8):
 * token rotation, device logout, logout-all, revoking one session from the
 * device list, and the device list itself. Every revocation records who
 * revoked the session (`deletedBy`) and, after commit, drops the cached
 * access-token state on every API instance so the session's `sid` is
 * rejected on its next request (ADR 034).
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
		private readonly authorizationInvalidation: AuthorizationInvalidationService,
	) {}

	/**
	 * Rotate a session's refresh token. The session row is updated in place:
	 * its id (`sid`) and every device detail carry forward, and the refresh
	 * records the activity — `lastActiveAt` and the refreshing request's IP as
	 * `lastIpAddress`.
	 */
	public async refreshToken(userId: string, rawRefreshTokenJwt: string, refreshTokenJti: string, refreshing: SessionDeviceContext): Promise<RefreshResponse> {
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

		if (!this.cryptoService.isRefreshTokenDigest(storedToken.token)) {
			// A session stored before refresh tokens were digested (bcrypt): it cannot
			// be verified safely, and it is not evidence of theft — sign in again.
			throw new UnauthorizedException({
				message: "This session must sign in again.",
				error: "REFRESH_TOKEN_INVALID",
			});
		}

		const tokenMatches: boolean = this.cryptoService.matchesRefreshToken(rawRefreshTokenJwt, storedToken.token);
		if (!tokenMatches) {
			// Only the IMMEDIATE predecessor of the current token (its hash is
			// `previousTokenHash`), presented within the grace window, is a benign
			// concurrent refresh. Any other token of this session is reuse.
			const isWithinGrace: boolean = storedToken.updatedAt >= Date.now() - REFRESH_SUPERSEDED_GRACE_MS;
			const isImmediatePredecessor: boolean =
				isWithinGrace && storedToken.previousTokenHash !== null && this.cryptoService.matchesRefreshToken(rawRefreshTokenJwt, storedToken.previousTokenHash);
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
		const hashedRt = this.cryptoService.hashRefreshToken(tokens.refreshToken);

		const rotationResult = await this.repository.rotateTokenIfHashMatches(
			storedToken.id,
			storedToken.token,
			{
				token: hashedRt,
				expiresAt,
				lastIpAddress: refreshing.ipAddress,
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

	/** Sign out the session whose refresh token the request presented (`deletedBy` = the user). Idempotent. */
	public async logoutDevice(userId: string, refreshTokenJti: string): Promise<void> {
		const actionStartedAt: number = performance.now();
		const outcome: SessionRevocationOutcome = await this.repository.revokeOwnSession(refreshTokenJti, userId, revokedByUser(userId), async (tx): Promise<void> => {
			await this.outbox.enqueueInTransaction(tx, sessionActionEvent("logout-device", userId, null, actionStartedAt));
		});

		if (outcome === "revoked") {
			await this.rejectRevokedSessionTokens(userId);
			return;
		}
		// Nothing to revoke (unknown, foreign, or already-revoked token) — logout is
		// idempotent, so the outcome is still "succeeded", but there was no domain
		// write for the event to be atomic with.
		await this.outbox.recordTelemetry(sessionActionEvent("logout-device", userId, null, actionStartedAt));
	}

	/** Sign out every session of the user, on every client type (`deletedBy` = the user). */
	public async logoutAllDevices(userId: string): Promise<void> {
		const actionStartedAt: number = performance.now();
		await this.sessionRevocation.revokeAllSessionsForUser(userId, revokedByUser(userId), "logout_all_devices", async (tx): Promise<void> => {
			await this.outbox.enqueueInTransaction(tx, sessionActionEvent("logout-all", userId, null, actionStartedAt));
		});
	}

	/**
	 * Revoke one of the caller's sessions from the device list (ADR 034):
	 * soft-deleted with `deletedBy` = the caller, the `revoke-device` event in
	 * the same transaction, then the session's `sid` rejected on every instance.
	 * Idempotent: a session already revoked answers success with no second
	 * event. A session that is not the caller's is a 404 — never 403, so the
	 * id of someone else's session is not confirmed to exist.
	 */
	public async revokeSession(userId: string, sessionId: string, currentSessionId: string | undefined): Promise<SessionRevocationResult> {
		const actionStartedAt: number = performance.now();
		const outcome: SessionRevocationOutcome = await this.repository.revokeOwnSession(sessionId, userId, revokedByUser(userId), async (tx): Promise<void> => {
			await this.outbox.enqueueInTransaction(tx, sessionActionEvent("revoke-device", userId, null, actionStartedAt));
		});

		if (outcome === "not_found") {
			throw new NotFoundError({ code: DEVICE_SESSION_ERROR_CODES.SESSION_NOT_FOUND, message: "Session not found." });
		}
		if (outcome === "revoked") {
			await this.rejectRevokedSessionTokens(userId);
		}
		return { revokedCurrentSession: sessionId === currentSessionId };
	}

	/**
	 * The user's active sessions with every device detail, a server-built label
	 * and `isCurrent` (the request's own session, from the access token's
	 * `sid`): the current session first, then by last activity, newest first.
	 */
	public async getSessions(userId: string, currentSessionId: string | undefined): Promise<Session[]> {
		const records: DeviceSessionRecord[] = await this.repository.listActiveSessionsForUser(userId);
		return records.map((record: DeviceSessionRecord): Session => toSession(record, record.id === currentSessionId)).sort(compareSessionsForList);
	}

	/**
	 * After a single session was revoked (committed): drop the user's cached
	 * access-token state on every instance, so the next request carrying the
	 * session's `sid` is rejected (ADR 034).
	 */
	private async rejectRevokedSessionTokens(userId: string): Promise<void> {
		await this.authorizationInvalidation.invalidateUsers([userId], { accessTokenState: true, trigger: "session_revoked" });
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

		await this.sessionRevocation.revokeAllSessionsForUser(userId, revokedBySystem("system:rotation-reuse"), "refresh_token_reuse", async (tx): Promise<void> => {
			await this.outbox.enqueueInTransaction(tx, sessionActionEvent("refresh", userId, "TOKEN_THEFT_DETECTED", actionStartedAt));
		});
		return new UnauthorizedException({
			message: "Suspicious activity detected. All sessions have been revoked. Please log in again.",
			error: "TOKEN_THEFT_DETECTED",
		});
	}
}

/** Device-list order: the current session first, then by last activity, newest first. */
function compareSessionsForList(left: Session, right: Session): number {
	if (left.isCurrent !== right.isCurrent) {
		return left.isCurrent ? -1 : 1;
	}
	return right.lastActiveAt - left.lastActiveAt;
}

function toSession(record: DeviceSessionRecord, isCurrent: boolean): Session {
	return { ...record, label: buildSessionDeviceLabel(record), isCurrent };
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
