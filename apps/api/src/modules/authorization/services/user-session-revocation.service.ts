import { Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import type { SessionRevoker } from "../../sessions/device/session-revoker";
import { RefreshTokenRepository } from "../../sessions/repositories/refresh-token.repository";
import { SessionUserRepository } from "../../sessions/repositories/session-user.repository";
import { AuthorizationInvalidationService, type UserInvalidationTrigger } from "../cache/authorization-invalidation.service";

/** A caller-supplied write that must commit atomically with the revocation (e.g. its outbox event). */
export type RevocationTransactionWrite = (tx: Prisma.TransactionClient) => Promise<void>;

const NO_ADDITIONAL_WRITE: RevocationTransactionWrite = (): Promise<void> => Promise.resolve();

/**
 * Revokes every active session for affected users when authorization state changes.
 *
 * Two shapes:
 * - {@link revokeAllSessionsForUsers} owns its transaction (refresh-token
 *   revocation + tokenVersion bump + the caller's `withinTransaction` write);
 * - {@link revokeWithinTransaction} joins the caller's transaction (RBAC
 *   mutations: the RBAC write, the revocation and the audit row commit
 *   together), and the caller runs {@link afterRevocationCommitted} once the
 *   transaction has committed.
 *
 * Cached access-token state is invalidated only after commit — on every API
 * instance — so a concurrent reload cannot re-cache the old tokenVersion.
 *
 * Every revoked session records who revoked it (`deletedBy`, a
 * {@link SessionRevoker}: the user, an admin, or a system marker).
 */
@Injectable()
export class UserSessionRevocationService {
	private readonly logger: Logger = new Logger(UserSessionRevocationService.name);

	public constructor(
		private readonly prisma: PrismaService,
		private readonly refreshTokens: RefreshTokenRepository,
		private readonly sessionUsers: SessionUserRepository,
		private readonly invalidation: AuthorizationInvalidationService,
	) {}

	public async revokeAllSessionsForUser(
		userId: string,
		revoker: SessionRevoker,
		trigger: UserInvalidationTrigger,
		withinTransaction: RevocationTransactionWrite = NO_ADDITIONAL_WRITE,
	): Promise<void> {
		await this.revokeAllSessionsForUsers([userId], revoker, trigger, withinTransaction);
	}

	/**
	 * Refresh-token revocation, the tokenVersion bump, and `withinTransaction`
	 * commit together; cached access-token state is invalidated only after commit.
	 */
	public async revokeAllSessionsForUsers(
		userIds: readonly string[],
		revoker: SessionRevoker,
		trigger: UserInvalidationTrigger,
		withinTransaction: RevocationTransactionWrite = NO_ADDITIONAL_WRITE,
	): Promise<void> {
		const uniqueUserIds: string[] = [...new Set<string>(userIds)];
		if (uniqueUserIds.length === 0) {
			return;
		}

		await this.prisma.$transaction(async (tx: Prisma.TransactionClient): Promise<void> => {
			await this.revokeWithinTransaction(uniqueUserIds, revoker, tx);
			await withinTransaction(tx);
		});

		await this.afterRevocationCommitted(uniqueUserIds, trigger);
	}

	/** Revoke refresh tokens and bump tokenVersion inside the caller's transaction. Pair with {@link afterRevocationCommitted}. */
	public async revokeWithinTransaction(userIds: readonly string[], revoker: SessionRevoker, tx: Prisma.TransactionClient): Promise<void> {
		const uniqueUserIds: string[] = [...new Set<string>(userIds)];
		if (uniqueUserIds.length === 0) {
			return;
		}
		await this.refreshTokens.revokeAllForUsers(uniqueUserIds, revoker, tx);
		await this.sessionUsers.bumpTokenVersions(uniqueUserIds, tx);
	}

	/** Post-commit: drop cached access-token state (and cached authorization) for `userIds` on every instance. */
	public async afterRevocationCommitted(userIds: readonly string[], trigger: UserInvalidationTrigger): Promise<void> {
		if (userIds.length === 0) {
			return;
		}
		await this.invalidation.invalidateUsers(userIds, { accessTokenState: true, trigger });
		this.logger.log(`Revoked all sessions for ${String(new Set<string>(userIds).size)} user(s) (trigger=${trigger})`);
	}
}
