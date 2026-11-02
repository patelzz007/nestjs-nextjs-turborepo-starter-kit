import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { ClaimsScope } from "../../claims-scope";
import { CLAIMS_UNIT_OF_WORK } from "../../ports/claims.tokens";
import { LegacyRewardNoticeMigration, type LegacyRewardNoticeMigrationResult } from "../../services/legacy-reward-notice-migration";
import { MigrateLegacyRewardNoticesCommand } from "./migrate-legacy-reward-notices.command";

@CommandHandler(MigrateLegacyRewardNoticesCommand)
export class MigrateLegacyRewardNoticesHandler implements ICommandHandler<MigrateLegacyRewardNoticesCommand, LegacyRewardNoticeMigrationResult> {
	private readonly migration: LegacyRewardNoticeMigration;

	public constructor(@Inject(CLAIMS_UNIT_OF_WORK) uow: UnitOfWork<ClaimsScope>, @Inject(CLOCK) clock: Clock) {
		this.migration = new LegacyRewardNoticeMigration(uow, clock);
	}

	public async execute(command: MigrateLegacyRewardNoticesCommand): Promise<LegacyRewardNoticeMigrationResult> {
		return this.migration.migrate(command.actor);
	}
}
