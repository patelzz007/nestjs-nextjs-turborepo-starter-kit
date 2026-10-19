import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import { MERCHANT_CAPABILITY, type MerchantTerminalSummary } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { MerchantAccessPort } from "../../../../../platform/application/ports/authorization.port";
import { MERCHANT_ACCESS } from "../../../../organizations/public-api";
import { actingInOrganization } from "../../acting-member";
import { TerminalNotFoundError } from "../../../domain/errors/pos.errors";
import type { TerminalReadPort } from "../../ports/pos-read.port";
import { TERMINAL_READS } from "../../ports/pos.tokens";
import { isWithinGrant } from "../../services/store-scope";
import { GetTerminalQuery } from "./get-terminal.query";

/** One live till; another store's (for a store-limited member) or another organization's is 404. */
@QueryHandler(GetTerminalQuery)
export class GetTerminalHandler implements IQueryHandler<GetTerminalQuery, MerchantTerminalSummary> {
	public constructor(
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(TERMINAL_READS) private readonly reads: TerminalReadPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(query: GetTerminalQuery): Promise<MerchantTerminalSummary> {
		const { actor, input } = query;
		const grant = await this.merchantAccess.assertCapability(actor, { organizationId: input.organizationId, capability: MERCHANT_CAPABILITY.manageApiKeys });
		const tenant = actingInOrganization(actor, input.organizationId);
		const terminal = await this.reads.find(tenant, input.organizationId, input.terminalRowId, this.clock.now());
		if (terminal === null || !isWithinGrant(grant, terminal.locationId)) {
			throw new TerminalNotFoundError();
		}
		return terminal;
	}
}
