import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import { MERCHANT_CAPABILITY, type MerchantTerminalStatusSummary } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { MerchantAccessPort } from "../../../../../platform/application/ports/authorization.port";
import { MERCHANT_ACCESS } from "../../../../organizations/public-api";
import { actingInOrganization } from "../../acting-member";
import type { TerminalReadPort } from "../../ports/pos-read.port";
import { TERMINAL_READS } from "../../ports/pos.tokens";
import { GetTerminalSummaryQuery } from "./get-terminal-summary.query";

/** Live tills per status and the stores they cover, within the member's stores (like the list). */
@QueryHandler(GetTerminalSummaryQuery)
export class GetTerminalSummaryHandler implements IQueryHandler<GetTerminalSummaryQuery, MerchantTerminalStatusSummary> {
	public constructor(
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(TERMINAL_READS) private readonly reads: TerminalReadPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(query: GetTerminalSummaryQuery): Promise<MerchantTerminalStatusSummary> {
		const { actor, input } = query;
		const grant = await this.merchantAccess.assertCapability(actor, {
			organizationId: input.organizationId,
			capability: MERCHANT_CAPABILITY.manageApiKeys,
			locationId: input.locationId ?? null,
		});
		const tenant = actingInOrganization(actor, input.organizationId);
		return this.reads.summary(tenant, grant, this.clock.now());
	}
}
