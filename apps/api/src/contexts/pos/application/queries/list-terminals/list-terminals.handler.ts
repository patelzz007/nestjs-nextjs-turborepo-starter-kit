import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import { MERCHANT_CAPABILITY, type MerchantTerminalSummary, type PaginatedServiceResult } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { MerchantAccessPort } from "../../../../../platform/application/ports/authorization.port";
import { MERCHANT_ACCESS } from "../../../../tenancy/public-api";
import { actingInTenant } from "../../acting-member";
import type { TerminalReadPort } from "../../ports/pos-read.port";
import { TERMINAL_READS } from "../../ports/pos.tokens";
import { ListTerminalsQuery } from "./list-terminals.query";

/** The tenant's live tills within the member's stores (one store when `locationId` narrows it). */
@QueryHandler(ListTerminalsQuery)
export class ListTerminalsHandler implements IQueryHandler<ListTerminalsQuery, PaginatedServiceResult<MerchantTerminalSummary>> {
	public constructor(
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(TERMINAL_READS) private readonly reads: TerminalReadPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(query: ListTerminalsQuery): Promise<PaginatedServiceResult<MerchantTerminalSummary>> {
		const { actor, input } = query;
		const grant = await this.merchantAccess.assertCapability(actor, {
			tenantId: input.tenantId,
			capability: MERCHANT_CAPABILITY.manageApiKeys,
			locationId: input.locationId ?? null,
		});
		const tenant = actingInTenant(actor, input.tenantId);
		return this.reads.list(tenant, grant, input, this.clock.now());
	}
}
