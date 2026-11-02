import { APP_LINKS, type NotificationSurface } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { Clock } from "../../../../platform/application/clock.port";
import type { SystemOperationName } from "../../../../platform/application/system-operation-names";
import type { UnitOfWork } from "../../../../platform/application/unit-of-work.port";
import type { LegacyInboxNotice } from "../../../notifications/public-api";
import type { ClaimsScope } from "../claims-scope";
import type { LegacyRewardNotice } from "../ports/claims-transactional.ports";

/** The audited system operation of the move (its RLS scope: the legacy table and the unified inbox). */
export const LEGACY_REWARD_NOTICE_MIGRATION_OPERATION: SystemOperationName = "notifications.legacy_inbox.migrate";

/** Legacy rows moved per transaction. */
export const LEGACY_REWARD_NOTICE_BATCH_SIZE = 200;

/** Who soft-deleted a moved row (`deletedBy`). */
export const LEGACY_REWARD_NOTICE_RETIRED_BY = "system:notifications.legacy_inbox.migrate";

/** The legacy types that went to a tenant's owners (the merchant app); every other went to a customer. */
const MERCHANT_LEGACY_TYPES: readonly string[] = ["reward_approved", "reward_rejected", "reward_auto_published"];

export interface LegacyRewardNoticeMigrationResult {
	readonly moved: number;
}

/**
 * Where opening a moved notice leads: its stored link, else (for a customer) the reward it was about, else
 * nowhere. A merchant notice never links its reward: merchant pages need the tenant's slug, which the
 * legacy row never stored.
 */
export function legacyNoticeLink(notice: LegacyRewardNotice): string | null {
	const href = notice.metadata.href;
	if (href !== undefined && href.length > 0) {
		return href;
	}
	const rewardId = notice.metadata.rewardId;
	return rewardId === undefined || rewardId.length === 0 || legacyNoticeSurface(notice) === "MERCHANT" ? null : APP_LINKS.web.reward(rewardId);
}

export function legacyNoticeSurface(notice: LegacyRewardNotice): NotificationSurface {
	return MERCHANT_LEGACY_TYPES.includes(notice.type) ? "MERCHANT" : "CUSTOMER";
}

export function toLegacyInboxNotice(notice: LegacyRewardNotice): LegacyInboxNotice {
	return {
		legacyId: notice.id,
		userId: notice.userId,
		surface: legacyNoticeSurface(notice),
		title: notice.title,
		body: notice.body,
		link: legacyNoticeLink(notice),
		readAt: notice.readAt,
		createdAt: notice.createdAt,
	};
}

/**
 * Moves the earlier reward inbox (`RewardNotification`) into the unified inbox (ADR 070), one batch per
 * transaction: the copy and the legacy row's soft delete commit together. Safe to run on every replica at
 * once: the copy is keyed on the legacy id (a repeat writes nothing) and the soft delete is idempotent.
 * Once the table is empty each run is one empty read.
 */
export class LegacyRewardNoticeMigration {
	public constructor(
		private readonly uow: UnitOfWork<ClaimsScope>,
		private readonly clock: Clock,
	) {}

	public async migrate(actor: ActorContext): Promise<LegacyRewardNoticeMigrationResult> {
		let moved = 0;
		for (;;) {
			const batch = await this.uow.runSystemOperation(LEGACY_REWARD_NOTICE_MIGRATION_OPERATION, actor, async (scope: ClaimsScope): Promise<number> => {
				const notices = await scope.legacyNotices.takeBatch(LEGACY_REWARD_NOTICE_BATCH_SIZE);
				if (notices.length === 0) {
					return 0;
				}
				const now = this.clock.now();
				await scope.legacyInbox.import(notices.map(toLegacyInboxNotice), now);
				await scope.legacyNotices.retire(
					notices.map((notice: LegacyRewardNotice): string => notice.id),
					now,
					LEGACY_REWARD_NOTICE_RETIRED_BY,
				);
				return notices.length;
			});
			moved += batch;
			if (batch < LEGACY_REWARD_NOTICE_BATCH_SIZE) {
				return { moved };
			}
		}
	}
}
