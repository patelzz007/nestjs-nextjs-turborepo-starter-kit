import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { RewardClaimQrResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { ClaimsScope } from "../../claims-scope";
import type { ClaimCodesPort } from "../../ports/claim-codes.port";
import { CLAIM_CODES, CLAIMS_UNIT_OF_WORK } from "../../ports/claims.tokens";
import { actingUserId } from "../acting-user";
import { IssueClaimQrCodesCommand } from "./issue-claim-qr-codes.command";

/**
 * Issues fresh QR and backup codes for the caller's own PENDING, unexpired claim (D07). The old
 * codes stop working at commit; the save is compared-and-set on PENDING and the expiry, so a claim
 * redeemed or expired meanwhile is refused instead of rotated.
 */
@CommandHandler(IssueClaimQrCodesCommand)
export class IssueClaimQrCodesHandler implements ICommandHandler<IssueClaimQrCodesCommand, RewardClaimQrResponse> {
	public constructor(
		@Inject(CLAIMS_UNIT_OF_WORK) private readonly uow: UnitOfWork<ClaimsScope>,
		@Inject(CLAIM_CODES) private readonly codes: ClaimCodesPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: IssueClaimQrCodesCommand): Promise<RewardClaimQrResponse> {
		const { actor, input } = command;
		const userId = actingUserId(actor);

		return this.uow.run(actor, async (scope: ClaimsScope): Promise<RewardClaimQrResponse> => {
			const claim = await scope.claims.getForUser(input.claimId, userId);
			const codes = this.codes.issueClaimCodes();
			claim.issueCodes(codes.hashes, this.clock.now());
			await scope.claims.save(claim);
			scope.events.collectFrom(claim);
			return { claimId: claim.id, qrPayload: codes.qrPayload, backupCode: codes.backupCode, claimExpiresAt: claim.claimExpiresAt };
		});
	}
}
