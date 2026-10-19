import { Injectable } from "@nestjs/common";
import { SessionActionEventSchema } from "@workspace/shared";

import { PlatformOutboxService } from "../../../../platform/infrastructure/outbox/platform-outbox.service";
import type { IdentityTelemetryPort, SessionActionTelemetry } from "../../application/ports/identity-telemetry.port";

/** `session.action` telemetry for outcomes with no write to be atomic with (own transaction; never throws). */
@Injectable()
export class OutboxIdentityTelemetry implements IdentityTelemetryPort {
	public constructor(private readonly outbox: PlatformOutboxService) {}

	public async recordSessionAction(event: SessionActionTelemetry): Promise<void> {
		await this.outbox.recordTelemetry({
			type: "session.action",
			payload: SessionActionEventSchema.parse({
				action: event.action,
				userId: event.userId,
				status: event.error === null ? "succeeded" : "failed",
				error: event.error,
				durationMs: Math.max(0, Math.round(event.durationMs)),
			}),
		});
	}
}
