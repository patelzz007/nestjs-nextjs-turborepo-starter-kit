import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { ClaimsScope } from "../../claims-scope";
import { CLAIMS_UNIT_OF_WORK } from "../../ports/claims.tokens";
import { ClaimExpiryApplicationService, type ClaimExpiryResult } from "../../services/claim-expiry.application-service";
import { ExpireOverdueClaimHoldsCommand } from "./expire-overdue-claim-holds.command";

@CommandHandler(ExpireOverdueClaimHoldsCommand)
export class ExpireOverdueClaimHoldsHandler implements ICommandHandler<ExpireOverdueClaimHoldsCommand, ClaimExpiryResult> {
	private readonly expiry: ClaimExpiryApplicationService;

	public constructor(@Inject(CLAIMS_UNIT_OF_WORK) uow: UnitOfWork<ClaimsScope>, @Inject(CLOCK) clock: Clock) {
		this.expiry = new ClaimExpiryApplicationService(uow, clock);
	}

	public async execute(command: ExpireOverdueClaimHoldsCommand): Promise<ClaimExpiryResult> {
		return this.expiry.expireOverdueHolds(command.actor);
	}
}
