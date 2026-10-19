import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { OkResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { LegalAcceptance } from "../../../domain/aggregates/legal-acceptance.aggregate";
import { REWARDS_UNIT_OF_WORK } from "../../ports/rewards.tokens";
import type { RewardsScope } from "../../rewards-scope";
import { actingUserId } from "../acting-user";
import { AcceptLegalTermsCommand } from "./accept-legal-terms.command";

/** Records the signed-in customer's acceptance of the rewards terms; every call appends a row. */
@CommandHandler(AcceptLegalTermsCommand)
export class AcceptLegalTermsHandler implements ICommandHandler<AcceptLegalTermsCommand, OkResponse> {
	public constructor(
		@Inject(REWARDS_UNIT_OF_WORK) private readonly uow: UnitOfWork<RewardsScope>,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: AcceptLegalTermsCommand): Promise<OkResponse> {
		const { actor, input } = command;
		const userId = actingUserId(actor);

		return this.uow.run(actor, async (scope: RewardsScope): Promise<OkResponse> => {
			const acceptance = LegalAcceptance.accept(userId, input.termsVersion, input.privacyVersion, this.clock.now());
			await scope.legalAcceptances.add(acceptance);
			scope.events.collectFrom(acceptance);
			return { ok: true };
		});
	}
}
