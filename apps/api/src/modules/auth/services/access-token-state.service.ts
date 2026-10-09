import { Injectable, UnauthorizedException } from "@nestjs/common";
import { BoundedTtlCache } from "@workspace/shared";

import { parseExpiryToMilliseconds } from "../../../common/utils/expiry";
import { TypedConfigService } from "../../../config/typed-config.service";
import { PrismaService } from "../../../prisma/prisma.service";

/** Cached account state used to reject stale or revoked access tokens. */
export interface AccessTokenAccountState {
	readonly tokenVersion: number;
	readonly isActive: boolean;
	readonly isDeleted: boolean;
	/**
	 * Device sessions of the user revoked recently enough that an access token
	 * they issued may still be unexpired (ADR 034) — a token whose `sid` is in
	 * here is rejected.
	 */
	readonly revokedSessionIds: ReadonlySet<string>;
}

/**
 * Slack added to the access-token lifetime when looking back for revoked
 * sessions: covers clock skew between API instances and the database, so a
 * token signed just before its session was revoked can never outlive the window.
 */
export const REVOKED_SESSION_LOOKBACK_MARGIN_MS = 60_000;

/**
 * Short-lived cache of account revocation state for access-token validation.
 *
 * Every authenticated request checks `tokenVersion`, `isActive`, and
 * `isDeleted` so password resets and session revocations take effect
 * without waiting for JWT expiry — and, for a token carrying `sid`, that its
 * device session was not revoked (ADR 034: signing out one device takes
 * effect on that device's next request).
 *
 * The state is read from the database on a cache miss (one query) and dropped
 * after commit by every revocation (on every API instance — see
 * `AuthorizationInvalidationService`), so the hot path adds no query.
 */
@Injectable()
export class AccessTokenStateService {
	private readonly store: BoundedTtlCache<string, AccessTokenAccountState>;
	private readonly ttlMs: number;
	/** How far back a revoked session can still have an unexpired access token. */
	private readonly revokedSessionLookbackMs: number;

	public constructor(
		private readonly prisma: PrismaService,
		config: TypedConfigService,
	) {
		this.ttlMs = config.caches.accessTokenStateTtlMs;
		this.revokedSessionLookbackMs = parseExpiryToMilliseconds(config.auth.jwtAccessExpiry) + REVOKED_SESSION_LOOKBACK_MARGIN_MS;
		this.store = new BoundedTtlCache<string, AccessTokenAccountState>({
			maxEntries: config.caches.accessTokenStateMaxEntries,
			defaultTtlMs: this.ttlMs,
			capacityPolicy: "evict-oldest",
		});
	}

	/**
	 * Throws a 401 when the account is deleted or inactive, the token version is
	 * stale, or the token's device session (`sessionId`, its `sid` claim) was
	 * revoked. A token without `sid` (minted before the claim existed, or an
	 * impersonation token) is accepted until it expires.
	 */
	public async assertTokenValid(userId: string, tokenVersion: number, sessionId?: string): Promise<void> {
		const state = await this.getAccountState(userId);

		if (state.isDeleted) {
			throw new UnauthorizedException({
				message: "Account has been deleted. Please contact support.",
				error: "ACCOUNT_DELETED",
			});
		}

		if (!state.isActive) {
			throw new UnauthorizedException({
				message: "Account is inactive. Please contact support.",
				error: "ACCOUNT_IS_INACTIVE",
			});
		}

		if (state.tokenVersion !== tokenVersion) {
			throw new UnauthorizedException({
				message: "Token revoked — please sign in again",
				error: "TOKEN_VERSION_MISMATCH",
			});
		}

		if (sessionId !== undefined && state.revokedSessionIds.has(sessionId)) {
			throw new UnauthorizedException({
				message: "This device was signed out. Please sign in again.",
				error: "SESSION_REVOKED",
			});
		}
	}

	public invalidate(userId: string): void {
		this.store.delete(userId);
	}

	public async bumpTokenVersion(userId: string): Promise<number> {
		this.invalidate(userId);
		const updated = await this.prisma.user.update({
			where: { id: userId },
			data: { tokenVersion: { increment: 1 }, updatedAt: Date.now() },
			select: { tokenVersion: true },
		});
		return updated.tokenVersion;
	}

	private async getAccountState(userId: string): Promise<AccessTokenAccountState> {
		const cached = this.store.get(userId);
		if (cached !== null) {
			return cached;
		}

		const revokedSince: number = Date.now() - this.revokedSessionLookbackMs;
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: {
				tokenVersion: true,
				isActive: true,
				isDeleted: true,
				refreshTokens: { where: { isDeleted: true, deletedAt: { gte: revokedSince } }, select: { id: true } },
			},
		});

		if (user === null) {
			throw new UnauthorizedException({
				message: "User account no longer exists. Please sign in again.",
				error: "USER_NOT_FOUND",
			});
		}

		const value: AccessTokenAccountState = {
			tokenVersion: user.tokenVersion,
			isActive: user.isActive,
			isDeleted: user.isDeleted,
			revokedSessionIds: new Set<string>(user.refreshTokens.map((session): string => session.id)),
		};

		this.store.set(userId, value, this.ttlMs);
		return value;
	}
}
