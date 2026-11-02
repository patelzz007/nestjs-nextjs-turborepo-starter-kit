import type { InTransactionEventHandler } from "../../../../../platform/application/events/in-transaction-event-handler";
import type { DomainEvent } from "../../../../../platform/domain/domain-event";
import {
	REFERRER_CREDITED_NOTIFICATION,
	REWARD_APPROVED_NOTIFICATION,
	REWARD_AUTO_PUBLISHED_NOTIFICATION,
	REWARD_REJECTED_NOTIFICATION,
} from "../../../../notifications/public-api";
import { ReferrerCredited } from "../../../../referrals/public-api";
import { RewardApproved, RewardAutoPublished, RewardRejected } from "../../../../rewards/public-api";
import type { TenantReadPort } from "../../../../tenancy/public-api";
import type { ClaimsScope } from "../../claims-scope";

/** A referee's redemption credited the referrer: tell them, in the checkout's own transaction (ADR 070). */
export class RecordNotificationOnReferrerCredited implements InTransactionEventHandler<ReferrerCredited, ClaimsScope> {
	public accepts(event: DomainEvent): event is ReferrerCredited {
		return event instanceof ReferrerCredited;
	}

	public async handle(event: ReferrerCredited, scope: ClaimsScope): Promise<void> {
		await scope.notify.notify({
			type: REFERRER_CREDITED_NOTIFICATION,
			recipient: { kind: "user", userId: event.referrerUserId },
			payload: { rewardId: event.referrerRewardId, rewardTitle: event.referrerRewardTitle, claimTtlDays: event.claimTtlDays },
			dedupeKey: `referrer-credited:${event.referralId}`,
			tenantId: null,
		});
	}
}

type RewardReviewDecision = RewardApproved | RewardRejected | RewardAutoPublished;

/** Every review decision tells the tenant's owners, in the decision's own transaction (ADR 070). */
export class RecordOwnerNoticesOnRewardReview implements InTransactionEventHandler<RewardReviewDecision, ClaimsScope> {
	public constructor(private readonly tenants: TenantReadPort) {}

	public accepts(event: DomainEvent): event is RewardReviewDecision {
		return event instanceof RewardApproved || event instanceof RewardRejected || event instanceof RewardAutoPublished;
	}

	public async handle(event: RewardReviewDecision, scope: ClaimsScope): Promise<void> {
		const owners = await this.tenants.listOwnerUserIds(event.tenantId);
		if (owners.length === 0) {
			return;
		}
		const tenant = (await this.tenants.getDisplayData([event.tenantId])).get(event.tenantId);
		if (tenant === undefined) {
			return;
		}
		// A reward can be reviewed more than once (rejected, edited, reviewed again): the decision's time keeps each one.
		const decision = `${event.rewardId}:${String(event.occurredAt)}`;
		for (const ownerUserId of owners) {
			if (event instanceof RewardRejected) {
				await scope.notify.notify({
					type: REWARD_REJECTED_NOTIFICATION,
					recipient: { kind: "user", userId: ownerUserId },
					payload: { rewardId: event.rewardId, rewardTitle: event.title, tenantSlug: tenant.slug, reason: event.reason },
					dedupeKey: `reward-rejected:${decision}`,
					tenantId: event.tenantId,
				});
			} else {
				await scope.notify.notify({
					type: event instanceof RewardApproved ? REWARD_APPROVED_NOTIFICATION : REWARD_AUTO_PUBLISHED_NOTIFICATION,
					recipient: { kind: "user", userId: ownerUserId },
					payload: { rewardId: event.rewardId, rewardTitle: event.title, tenantSlug: tenant.slug },
					dedupeKey: `${event instanceof RewardApproved ? "reward-approved" : "reward-auto-published"}:${decision}`,
					tenantId: event.tenantId,
				});
			}
		}
	}
}
