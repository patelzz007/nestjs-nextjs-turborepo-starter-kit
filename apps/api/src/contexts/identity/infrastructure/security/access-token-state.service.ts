import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { parseExpiryToMilliseconds } from "../../../../platform/infrastructure/utils/expiry";
import { TypedConfigService } from "../../../../config/typed-config.service";
import type { AccessTokenStatePort } from "../../../../platform/application/ports/access-token.port";
import { APP_CACHE, defineCache, userScope, type AppCache, type CacheDefinition } from "../../../../platform/application/ports/app-cache.port";
import type { SystemDatabaseContext } from "../../../../prisma/tenant-context";
import { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import { PRINCIPAL_LOOKUP_OPERATION } from "../../../../platform/application/shared-system-operations";

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

/** Account state is never served stale: a revocation must take effect on the next request. */
const NO_STALE_MS = 0;
/** The one id each user's state is stored under. */
const STATE_ENTRY_ID = "state";

const AccessTokenAccountStateSchema = z.object({
	tokenVersion: z.number().int(),
	isActive: z.boolean(),
	isDeleted: z.boolean(),
	revokedSessionIds: z.set(z.string()),
});

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
/** Account revocation state the access-token guard reads before the handler's RLS scope exists. */
interface AccessTokenStateLookup {
	withSystemOperation<TResult>(context: SystemDatabaseContext, work: (tx: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult>;
}

@Injectable()
export class AccessTokenStateService implements AccessTokenStatePort {
	/** Per process (`local`): read on every authenticated request; every instance drops it after a revocation. */
	public readonly states: CacheDefinition<AccessTokenAccountState, "user">;
	/** How far back a revoked session can still have an unexpired access token. */
	private readonly revokedSessionLookbackMs: number;

	public constructor(
		@Inject(TenantTransactionService) private readonly transactions: AccessTokenStateLookup,
		config: TypedConfigService,
		@Inject(APP_CACHE) private readonly cache: AppCache,
	) {
		this.revokedSessionLookbackMs = parseExpiryToMilliseconds(config.auth.jwtAccessExpiry) + REVOKED_SESSION_LOOKBACK_MARGIN_MS;
		this.states = defineCache<AccessTokenAccountState, "user">({
			name: "identity.access-token-state",
			version: 1,
			schema: AccessTokenAccountStateSchema,
			scope: "user",
			tier: "local",
			ttlMs: config.caches.accessTokenStateTtlMs,
			staleMs: NO_STALE_MS,
			containsPersonalData: false,
			localMaxEntries: config.caches.accessTokenStateMaxEntries,
			sharedMaxKeys: config.caches.accessTokenStateMaxEntries,
		});
		this.cache.register(this.states);
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

	/** Drops this process's copy at once (synchronously, before the broadcast is even sent). */
	public invalidate(userId: string): void {
		void this.cache.invalidate(this.states, userScope(userId), STATE_ENTRY_ID);
	}

	private async getAccountState(userId: string): Promise<AccessTokenAccountState> {
		return this.cache.getOrLoad(this.states, userScope(userId), STATE_ENTRY_ID, async (): Promise<AccessTokenAccountState> => this.loadAccountState(userId));
	}

	private async loadAccountState(userId: string): Promise<AccessTokenAccountState> {
		const revokedSince: number = Date.now() - this.revokedSessionLookbackMs;
		const user = await this.transactions.withSystemOperation(
			{ operation: PRINCIPAL_LOOKUP_OPERATION, reason: "Read account revocation state for an access token", actorUserId: userId },
			(tx) =>
				tx.user.findUnique({
					where: { id: userId },
					select: {
						tokenVersion: true,
						isActive: true,
						isDeleted: true,
						refreshTokens: { where: { isDeleted: true, deletedAt: { gte: revokedSince } }, select: { id: true } },
					},
				}),
		);

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

		return value;
	}
}
