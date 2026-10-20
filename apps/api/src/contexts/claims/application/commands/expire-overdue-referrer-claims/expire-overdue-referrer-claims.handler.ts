import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { ClaimsScope } from "../../claims-scope";
import { CLAIMS_UNIT_OF_WORK } from "../../ports/claims.tokens";
import { ClaimExpiryApplicationService, type ClaimExpiryResult } from "../../services/claim-expiry.application-service";
import { ExpireOverdueReferrerClaimsCommand } from "./expire-overdue-referrer-claims.command";

@CommandHandler(ExpireOverdueReferrerClaimsCommand)
export class ExpireOverdueReferrerClaimsHandler implements ICommandHandler<ExpireOverdueReferrerClaimsCommand, ClaimExpiryResult> {
	private readonly expiry: ClaimExpiryApplicationService;

	public constructor(@Inject(CLAIMS_UNIT_OF_WORK) uow: UnitOfWork<ClaimsScope>, @Inject(CLOCK) clock: Clock) {
		this.expiry = new ClaimExpiryApplicationService(uow, clock);
	}

	public async execute(command: ExpireOverdueReferrerClaimsCommand): Promise<ClaimExpiryResult> {
		return this.expiry.expireOverdue(command.actor, true);
	}
}
