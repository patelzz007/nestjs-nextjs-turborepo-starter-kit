import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import { MERCHANT_CAPABILITY, type MerchantTerminalSettings } from "@workspace/shared";

import type { MerchantAccessPort } from "../../../../../platform/application/ports/authorization.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { MERCHANT_ACCESS } from "../../../../tenancy/public-api";
import { actingInTenant } from "../../acting-member";
import type { PosScope } from "../../pos-scope";
import { POS_UNIT_OF_WORK } from "../../ports/pos.tokens";
import { GetPosSettingsQuery } from "./get-pos-settings.query";

/** The merchant profile's POS policy, read through tenants (off without a profile). */
@QueryHandler(GetPosSettingsQuery)
export class GetPosSettingsHandler implements IQueryHandler<GetPosSettingsQuery, MerchantTerminalSettings> {
	public constructor(
		@Inject(POS_UNIT_OF_WORK) private readonly uow: UnitOfWork<PosScope>,
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
	) {}

	public async execute(query: GetPosSettingsQuery): Promise<MerchantTerminalSettings> {
		const { actor, input } = query;
		await this.merchantAccess.assertCapability(actor, { tenantId: input.tenantId, capability: MERCHANT_CAPABILITY.manageApiKeys });
		const tenant = actingInTenant(actor, input.tenantId);
		const requireRegisteredTerminals = await this.uow.run(tenant, async (scope: PosScope) => scope.posSettings.requireRegisteredTerminals(input.tenantId));
		return { requireRegisteredTerminals: requireRegisteredTerminals ?? false };
	}
}
