import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { MfaRecoveryStatusResponse } from "@workspace/shared";

import type { IdentityReadPort } from "../../ports/identity-read.port";
import { IDENTITY_READ } from "../../ports/identity.tokens";
import { GetMyMfaRecoveryStatusQuery } from "./get-my-mfa-recovery-status.query";

const NO_REQUEST: MfaRecoveryStatusResponse = { status: "NONE", message: "No MFA recovery request found" };

@QueryHandler(GetMyMfaRecoveryStatusQuery)
export class GetMyMfaRecoveryStatusHandler implements IQueryHandler<GetMyMfaRecoveryStatusQuery, MfaRecoveryStatusResponse> {
	public constructor(@Inject(IDENTITY_READ) private readonly reads: IdentityReadPort) {}

	public async execute(query: GetMyMfaRecoveryStatusQuery): Promise<MfaRecoveryStatusResponse> {
		return (await this.reads.latestMfaRecovery(query.actor, query.input.userId)) ?? NO_REQUEST;
	}
}
