import { Injectable, Logger } from "@nestjs/common";
import type { OwnProfile, UpdateOwnProfileInput } from "@workspace/shared";

import { AuditTrailService } from "../../../common/audit/audit-trail.service";
import { ConcurrentModificationError, ResourceNotFoundError } from "../../../platform/persistence/persistence.errors";
import type { SystemOperation } from "../../../prisma/system-operation.registry";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { UserSessionCacheService } from "../cache/user-session-cache.service";
import { OwnProfileRepository, type OwnProfileChanges } from "./own-profile.repository";
import { OwnProfileWritePolicy } from "./own-profile-write.policy";
import { ProfileUpdateDuringImpersonationError } from "./own-profile.errors";
import type { ProfileActor } from "./profile-actor";

/** The one system operation a profile write runs under — `audit_logs` accepts inserts only with a named bypass. */
export const OWN_PROFILE_UPDATE_OPERATION: SystemOperation = "auth.profile.update";

/** Picks the editable fields out of the validated body (the `version` is the lock token, never a column write). */
function toChanges(input: UpdateOwnProfileInput): OwnProfileChanges {
	return {
		...(input.fullName === undefined ? {} : { fullName: input.fullName }),
	};
}

/**
 * The signed-in user's own profile: `GET /auth/profile` and `PATCH /auth/profile`.
 *
 * A write is refused for an impersonation session ({@link OwnProfileWritePolicy}),
 * then runs as ONE transaction under `auth.profile.update`: the optimistic-lock
 * conditional update, the re-read of the result and the request's audit row
 * (actor, impersonator, correlation id, IP, user agent — `AuditTrailService`)
 * commit or roll back together. After commit the cached `/auth/me` +
 * `/auth/permissions` payloads (which carry the name) are dropped so the next
 * read on any instance is fresh.
 */
@Injectable()
export class OwnProfileService {
	private readonly logger: Logger = new Logger(OwnProfileService.name);

	public constructor(
		private readonly repository: OwnProfileRepository,
		private readonly writePolicy: OwnProfileWritePolicy,
		private readonly tenantTx: TenantTransactionService,
		private readonly auditTrail: AuditTrailService,
		private readonly sessionCache: UserSessionCacheService,
	) {}

	public async getOwnProfile(actor: ProfileActor): Promise<OwnProfile> {
		const profile: OwnProfile | null = await this.repository.findLive(actor.userId);
		if (profile === null) {
			throw new ResourceNotFoundError(actor.userId);
		}
		return profile;
	}

	public async updateOwnProfile(actor: ProfileActor, input: UpdateOwnProfileInput): Promise<OwnProfile> {
		const decision = this.writePolicy.canWrite(actor);
		if (!decision.allowed) {
			throw new ProfileUpdateDuringImpersonationError();
		}

		const updated: OwnProfile = await this.tenantTx.withSystemOperation(
			{ operation: OWN_PROFILE_UPDATE_OPERATION, reason: "User edits their own profile", actorUserId: actor.userId },
			async (tx): Promise<OwnProfile> => {
				const applied: boolean = await this.repository.updateIfVersionMatches(tx, actor.userId, input.version, toChanges(input));
				if (!applied) {
					throw (await this.repository.existsLive(actor.userId, tx)) ? new ConcurrentModificationError(actor.userId) : new ResourceNotFoundError(actor.userId);
				}
				const profile: OwnProfile | null = await this.repository.findLive(actor.userId, tx);
				if (profile === null) {
					throw new ResourceNotFoundError(actor.userId);
				}
				await this.auditTrail.recordInTransaction(tx, profile);
				return profile;
			},
		);

		await this.dropCachedSession(actor.userId);
		return updated;
	}

	/**
	 * The change is committed: a cache that cannot be cleared must not turn it
	 * into a reported failure (the client would retry with a stale version). The
	 * failure is logged at error level and the stale entry expires with the
	 * cache TTL (`USER_SESSION_CACHE_TTL_MS`) — `GET /auth/profile` itself is
	 * never cached and is already fresh.
	 */
	private async dropCachedSession(userId: string): Promise<void> {
		try {
			await this.sessionCache.invalidate(userId);
		} catch (error) {
			this.logger.error({
				event: "profile.session_cache_invalidation_failed",
				userId,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}
}
