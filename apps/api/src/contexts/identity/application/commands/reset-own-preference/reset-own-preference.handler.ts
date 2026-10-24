import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { UserPreferences } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { IdentityScope } from "../../identity-scope";
import type { IdentityReadPort } from "../../ports/identity-read.port";
import { IDENTITY_READ, IDENTITY_UNIT_OF_WORK } from "../../ports/identity.tokens";
import { ResetOwnPreferenceCommand } from "./reset-own-preference.command";

/** Forgets one choice (soft delete), so the page falls back to its default; answers the preferences left. Resetting an unset key is a no-op. */
@CommandHandler(ResetOwnPreferenceCommand)
export class ResetOwnPreferenceHandler implements ICommandHandler<ResetOwnPreferenceCommand, UserPreferences> {
	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(IDENTITY_READ) private readonly reads: IdentityReadPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: ResetOwnPreferenceCommand): Promise<UserPreferences> {
		await this.uow.run(command.actor, async (scope: IdentityScope): Promise<void> => {
			await scope.preferences.reset(command.userId, command.key, command.userId, this.clock.now());
		});
		return this.reads.listOwnPreferences(command.actor, command.userId);
	}
}
