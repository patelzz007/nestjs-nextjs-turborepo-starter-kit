import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { MERCHANT_CAPABILITY, type MerchantTerminalSettings } from "@workspace/shared";

import type { MerchantAccessPort } from "../../../../../platform/application/ports/authorization.port";
import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { MERCHANT_ACCESS } from "../../../../organizations/public-api";
import { MerchantProfileNotFoundError } from "../../../domain/errors/pos.errors";
import { actingInOrganization, actingMemberId } from "../../acting-member";
import type { PosScope } from "../../pos-scope";
import { POS_UNIT_OF_WORK } from "../../ports/pos.tokens";
import { ChangePosSettingsCommand } from "./change-pos-settings.command";

/** Writes the merchant profile's POS policy through organizations (it owns the column), with its audit row, in one transaction. */
@CommandHandler(ChangePosSettingsCommand)
export class ChangePosSettingsHandler implements ICommandHandler<ChangePosSettingsCommand, MerchantTerminalSettings> {
	public constructor(
		@Inject(POS_UNIT_OF_WORK) private readonly uow: UnitOfWork<PosScope>,
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: ChangePosSettingsCommand): Promise<MerchantTerminalSettings> {
		const { actor, input } = command;
		const memberId = actingMemberId(actor);
		await this.merchantAccess.assertCapability(actor, { organizationId: input.organizationId, capability: MERCHANT_CAPABILITY.manageApiKeys });
		const tenant = actingInOrganization(actor, input.organizationId);
		await this.uow.run(tenant, async (scope: PosScope): Promise<void> => {
			if (!(await scope.posSettings.setRequireRegisteredTerminals(input.organizationId, input.requireRegisteredTerminals, this.clock.now()))) {
				throw new MerchantProfileNotFoundError();
			}
			await scope.rewardAudit.append({
				organizationId: input.organizationId,
				actorUserId: memberId,
				action: "merchant.terminal_settings_updated",
				metadata: { requireRegisteredTerminals: input.requireRegisteredTerminals },
			});
		});
		return { requireRegisteredTerminals: input.requireRegisteredTerminals };
	}
}
