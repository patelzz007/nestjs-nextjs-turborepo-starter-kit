import { Injectable, type OnModuleInit } from "@nestjs/common";

import { IntegrationEventMapperRegistry } from "../../../platform/application/events/integration-event-mapper";
import { PosIntegrationEventsMapper } from "./outbox/pos-integration-events.mapper";

/** Pos's mechanism-3 outbox mapper (every paid bill → `reward.platform` `merchant.redeem_reward`). */
@Injectable()
export class PosRegistrations implements OnModuleInit {
	public constructor(private readonly mappers: IntegrationEventMapperRegistry) {}

	public onModuleInit(): void {
		this.mappers.register(new PosIntegrationEventsMapper());
	}
}
