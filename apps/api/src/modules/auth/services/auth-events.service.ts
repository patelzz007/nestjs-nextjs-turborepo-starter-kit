import { Injectable } from "@nestjs/common";

import { AuthFlowEventSchema, type AuthFlowEvent } from "@workspace/shared";

import { PlatformOutboxService, type TelemetryRecordResult } from "../../../infrastructure/outbox/platform-outbox.service";

/**
 * Records completed auth flows (signup, login, password reset, …) as
 * `auth.flow` platform events in the transactional outbox.
 *
 * An auth flow outcome is telemetry about the whole flow (status, error code,
 * duration) — including failed attempts that write nothing — so it is recorded
 * in its own awaited transaction rather than inside one domain transaction.
 * The `@TrackAuthFlow` decorator calls {@link recordFlow} once per flow.
 */
@Injectable()
export class AuthEventsService {
	public constructor(private readonly outbox: PlatformOutboxService) {}

	/** Durably record one completed flow. Never throws — see `PlatformOutboxService.recordTelemetry`. */
	public async recordFlow(event: AuthFlowEvent): Promise<TelemetryRecordResult> {
		return this.outbox.recordTelemetry({ type: "auth.flow", payload: AuthFlowEventSchema.parse(event) });
	}
}
