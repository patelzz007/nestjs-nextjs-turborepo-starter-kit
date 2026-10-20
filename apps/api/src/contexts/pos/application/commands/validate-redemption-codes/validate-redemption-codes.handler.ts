import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { RedemptionPreviewResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { PosCodeLockedError, RedemptionCodeNotFoundError } from "../../../domain/errors/pos.errors";
import { redemptionInvalidReason } from "../../../domain/policies/redemption-eligibility.policy";
import type { PosScope } from "../../pos-scope";
import { POS_UNIT_OF_WORK } from "../../ports/pos.tokens";
import { RedemptionCodeResolver, type CodeResolution } from "../../services/redemption-code-resolver";
import { ValidateRedemptionCodesCommand } from "./validate-redemption-codes.command";

type ValidationOutcome = Exclude<CodeResolution, { readonly kind: "resolved" }> | { readonly kind: "preview"; readonly preview: RedemptionPreviewResponse };

/**
 * Resolves one code to the merchant's claim and says whether it is redeemable here now, in ONE
 * transaction with the scan audit row. An unknown backup code is counted against the key and that
 * count commits before the request fails (404 `REDEMPTION_TOKEN_INVALID`, or 429 `POS_CODE_LOCKED`).
 */
@CommandHandler(ValidateRedemptionCodesCommand)
export class ValidateRedemptionCodesHandler implements ICommandHandler<ValidateRedemptionCodesCommand, RedemptionPreviewResponse> {
	public constructor(
		@Inject(POS_UNIT_OF_WORK) private readonly uow: UnitOfWork<PosScope>,
		private readonly resolver: RedemptionCodeResolver,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: ValidateRedemptionCodesCommand): Promise<RedemptionPreviewResponse> {
		const { actor, point, input } = command;
		const outcome = await this.uow.run(actor, async (scope: PosScope): Promise<ValidationOutcome> => {
			const now = this.clock.now();
			const resolution = await this.resolver.resolve(scope, point, [input], now);
			if (resolution.kind !== "resolved") {
				return resolution;
			}
			const [resolved] = resolution.codes;
			if (resolved === undefined) {
				return { kind: "not_found" };
			}
			const { claim } = resolved;
			await scope.rewardAudit.append({
				tenantId: point.tenantId,
				actorUserId: null,
				action: "merchant.scan_qr",
				metadata: { claimId: claim.claimId, terminalId: point.terminalId, apiKeyId: point.apiKeyId, locationId: point.locationId },
			});
			const invalidReason = redemptionInvalidReason(claim, point.locationId, now);
			return {
				kind: "preview",
				preview: {
					claimId: claim.claimId,
					rewardTitle: claim.rewardTitle,
					rewardType: resolved.lookup.reward.rewardType,
					claimExpiresAt: claim.claimExpiresAt,
					valid: invalidReason === null,
					invalidReason,
					minSpendMinor: claim.minSpendMinor,
				},
			};
		});
		switch (outcome.kind) {
			case "locked":
				throw new PosCodeLockedError(outcome.lockedUntil);
			case "not_found":
				throw new RedemptionCodeNotFoundError();
			case "preview":
				return outcome.preview;
		}
	}
}
