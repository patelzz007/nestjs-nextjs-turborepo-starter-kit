import { Injectable, Logger } from "@nestjs/common";
import { nowEpochMs } from "@workspace/shared";

import { runWithSystemRlsContext } from "../../../prisma/rls-context";
import { OutboxDispatchRepository } from "./outbox-dispatch.repository";
import { OUTBOX_PUBLISH_OPERATION } from "./outbox-operations";
import type { OutboxClock } from "./outbox-dispatcher";
import { OutboxEmailRelay, OutboxEmailRouteRegistry, type OutboxEmailRelayOutcome, type OutboxEmailRelaySummary } from "./outbox-email-relay";

const SYSTEM_CLOCK: OutboxClock = { nowEpochMs: (): number => nowEpochMs() };

/**
 * The email relay with its database session: every claim and state change
 * runs as the `outbox.publish` system operation. Used by the outbox sweep
 * (crash backstop) and by the notifications after-commit nudge.
 */
@Injectable()
export class OutboxEmailRelayService {
	private readonly logger: Logger = new Logger(OutboxEmailRelayService.name);
	private readonly relay: OutboxEmailRelay;

	public constructor(store: OutboxDispatchRepository, routes: OutboxEmailRouteRegistry) {
		this.relay = new OutboxEmailRelay(store, routes, SYSTEM_CLOCK, this.logger);
	}

	public relayDue(): Promise<OutboxEmailRelaySummary | null> {
		return runWithSystemRlsContext(OUTBOX_PUBLISH_OPERATION, async (): Promise<OutboxEmailRelaySummary | null> => this.relay.relayDue());
	}

	public relayOne(outboxEventId: string): Promise<OutboxEmailRelayOutcome> {
		return runWithSystemRlsContext(OUTBOX_PUBLISH_OPERATION, async (): Promise<OutboxEmailRelayOutcome> => this.relay.relayOne(outboxEventId));
	}
}
