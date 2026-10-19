import { Injectable } from "@nestjs/common";

import { OutboxEmailRelayService } from "../../../../platform/infrastructure/outbox/outbox-email-relay.service";
import type { EmailRequestRelayPort } from "../../application/ports/email-request-relay.port";

/** {@link EmailRequestRelayPort} over the platform outbox email relay (claim by id, hand off, mark published). */
@Injectable()
export class EmailRequestRelayAdapter implements EmailRequestRelayPort {
	public constructor(private readonly relay: OutboxEmailRelayService) {}

	public async relayNow(outboxEventId: string): Promise<void> {
		await this.relay.relayOne(outboxEventId);
	}
}
