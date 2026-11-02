import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { systemActor } from "../../../../platform/application/actor-context";
import { SystemCommandDispatcher } from "../../../../platform/application/system-command-dispatcher";
import { MigrateLegacyRewardNoticesCommand } from "../../application/commands/migrate-legacy-reward-notices/migrate-legacy-reward-notices.command";
import { LEGACY_REWARD_NOTICE_MIGRATION_OPERATION } from "../../application/services/legacy-reward-notice-migration";

/** The cron's name on its audit rows. */
const MIGRATE_CRON_NAME = "LegacyRewardNoticesCron.migrate";

/**
 * Hourly, on every API replica: move what is left of the earlier reward inbox into the unified inbox
 * (ADR 070). Overlapping runs are safe (the copy is keyed on the legacy id). A system command, audited by
 * the dispatcher. Removed with the `RewardNotification` table one release later.
 */
@Injectable()
export class LegacyRewardNoticesCron {
	private readonly logger: Logger = new Logger(LegacyRewardNoticesCron.name);

	public constructor(@Inject(SystemCommandDispatcher) private readonly dispatcher: Pick<SystemCommandDispatcher, "dispatch">) {}

	@Cron(CronExpression.EVERY_HOUR)
	public async migrate(): Promise<void> {
		const result = await this.dispatcher.dispatch(
			new MigrateLegacyRewardNoticesCommand(systemActor(LEGACY_REWARD_NOTICE_MIGRATION_OPERATION, "cron", null, "Move the earlier reward inbox into the unified inbox", null)),
			{ kind: "cron", name: MIGRATE_CRON_NAME },
		);
		if (result.moved > 0) {
			this.logger.log({ event: "notifications.legacy_inbox_moved", moved: result.moved });
		}
	}
}
