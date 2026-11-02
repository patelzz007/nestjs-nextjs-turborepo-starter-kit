import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { LegacyRewardNoticeMigrationResult } from "../../services/legacy-reward-notice-migration";

/** Move what is left of the earlier reward inbox into the unified inbox (ADR 070). */
export class MigrateLegacyRewardNoticesCommand extends Command<LegacyRewardNoticeMigrationResult> {
	public constructor(public readonly actor: ActorContext) {
		super();
	}
}
