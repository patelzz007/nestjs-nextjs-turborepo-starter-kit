import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { ClaimsScope } from "../../claims-scope";
import { CLAIMS_UNIT_OF_WORK } from "../../ports/claims.tokens";
import { ClaimExpiryApplicationService, type ClaimExpiryResult } from "../../services/claim-expiry.application-service";
import { ExpireOverdueClaimsCommand } from "./expire-overdue-claims.command";

@CommandHandler(ExpireOverdueClaimsCommand)
export class ExpireOverdueClaimsHandler implements ICommandHandler<ExpireOverdueClaimsCommand, ClaimExpiryResult> {
	private readonly expiry: ClaimExpiryApplicationService;

	public constructor(@Inject(CLAIMS_UNIT_OF_WORK) uow: UnitOfWork<ClaimsScope>, @Inject(CLOCK) clock: Clock) {
		this.expiry = new ClaimExpiryApplicationService(uow, clock);
	}

	public async execute(command: ExpireOverdueClaimsCommand): Promise<ClaimExpiryResult> {
		return this.expiry.expireOverdue(command.actor, false);
	}
}
