import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { ClaimsScope } from "../../claims-scope";
import { CLAIMS_UNIT_OF_WORK } from "../../ports/claims.tokens";
import { SignupSuccessNoticeApplicationService, type SignupSuccessNoticeSweep } from "../../services/signup-success-notice.application-service";
import { SweepSignupSuccessNoticesCommand } from "./sweep-signup-success-notices.command";

@CommandHandler(SweepSignupSuccessNoticesCommand)
export class SweepSignupSuccessNoticesHandler implements ICommandHandler<SweepSignupSuccessNoticesCommand, SignupSuccessNoticeSweep> {
	private readonly notices: SignupSuccessNoticeApplicationService;

	public constructor(@Inject(CLAIMS_UNIT_OF_WORK) uow: UnitOfWork<ClaimsScope>, @Inject(CLOCK) clock: Clock) {
		this.notices = new SignupSuccessNoticeApplicationService(uow, clock);
	}

	public async execute(command: SweepSignupSuccessNoticesCommand): Promise<SignupSuccessNoticeSweep> {
		return this.notices.sweep(command.actor);
	}
}
