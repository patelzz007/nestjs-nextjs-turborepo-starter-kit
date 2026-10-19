import { Logger } from "@nestjs/common";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { Clock } from "../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../platform/application/unit-of-work.port";
import { CLAIM_EXPIRY_BATCH_SIZE } from "../../domain/value-objects/claim-rules.value-object";
import type { ClaimsScope } from "../claims-scope";

/** How one expiry run went. */
export interface ClaimExpiryResult {
	readonly expired: number;
	readonly skipped: number;
}

/**
 * Expires overdue PENDING claims one transaction each: the claim moves to EXPIRED (compare-and-set
 * on PENDING), its unit returns to the reward, and the reward audit row and the
 * `reward.claim_expired` outbox record commit with it. A claim another worker (or a checkout)
 * moved first is skipped. One claim's failure does not stop the others; the run then rethrows the
 * first failure so the job is retried and audited as failed.
 */
export class ClaimExpiryApplicationService {
	private readonly logger: Logger = new Logger(ClaimExpiryApplicationService.name);

	public constructor(
		private readonly uow: UnitOfWork<ClaimsScope>,
		private readonly clock: Clock,
	) {}

	public async expireOverdue(actor: ActorContext, isReferrerCredit: boolean): Promise<ClaimExpiryResult> {
		const now = this.clock.now();
		const overdue = await this.uow.run(actor, async (scope: ClaimsScope) => scope.claims.listOverdue(isReferrerCredit, now, CLAIM_EXPIRY_BATCH_SIZE));
		let expired = 0;
		const failures: Error[] = [];
		for (const { claimId, organizationId } of overdue) {
			try {
				const didExpire = await this.uow.run(actor, async (scope: ClaimsScope): Promise<boolean> => {
					const claim = await scope.claims.findById(claimId);
					if (!claim?.isOverdue(now)) {
						return false;
					}
					claim.expire(organizationId, now);
					if (!(await scope.claims.saveIfUnchanged(claim))) {
						return false;
					}
					await scope.rewards.release(claim.rewardId, now);
					await scope.rewardAudit.append({ organizationId, actorUserId: null, action: "reward.claim_expired", metadata: { claimId, isReferrerCredit } });
					scope.events.collectFrom(claim);
					return true;
				});
				expired += didExpire ? 1 : 0;
			} catch (error) {
				failures.push(error instanceof Error ? error : new Error(String(error)));
			}
		}
		const result: ClaimExpiryResult = { expired, skipped: overdue.length - expired - failures.length };
		this.logger.log({ event: "claims.expiry.run", isReferrerCredit, ...result, failed: failures.length });
		const [firstFailure] = failures;
		if (firstFailure !== undefined) {
			throw firstFailure;
		}
		return result;
	}
}
