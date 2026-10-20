import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { ClaimsScope } from "../../claims-scope";
import { CLAIMS_UNIT_OF_WORK } from "../../ports/claims.tokens";
import { ReferrerCreditEmailApplicationService, type ReferrerCreditEmailSweep } from "../../services/referrer-credit-email.application-service";
import { SweepReferrerCreditEmailsCommand } from "./sweep-referrer-credit-emails.command";

@CommandHandler(SweepReferrerCreditEmailsCommand)
export class SweepReferrerCreditEmailsHandler implements ICommandHandler<SweepReferrerCreditEmailsCommand, ReferrerCreditEmailSweep> {
	private readonly emails: ReferrerCreditEmailApplicationService;

	public constructor(@Inject(CLAIMS_UNIT_OF_WORK) uow: UnitOfWork<ClaimsScope>, @Inject(CLOCK) clock: Clock) {
		this.emails = new ReferrerCreditEmailApplicationService(uow, clock);
	}

	public async execute(command: SweepReferrerCreditEmailsCommand): Promise<ReferrerCreditEmailSweep> {
		return this.emails.sweep(command.actor);
	}
}
