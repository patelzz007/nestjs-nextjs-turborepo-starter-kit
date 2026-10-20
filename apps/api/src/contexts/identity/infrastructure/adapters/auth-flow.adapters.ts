import { Injectable } from "@nestjs/common";
import { AuthFlowEventSchema, type AuthFlowEvent } from "@workspace/shared";

import { PlatformOutboxService, type TelemetryRecordResult } from "../../../../platform/infrastructure/outbox/platform-outbox.service";
import { identifyAuthFlowSubject } from "../../../../platform/presentation/http/security/decorators/track-auth-flow.decorator";
import type { AuthFlowRecorder } from "../../../../platform/application/ports/access-token.port";
import type { AuthFlowSubjectPort } from "../../application/ports/auth-flow.port";

/** Names the subject of the `@TrackAuthFlow` scope the request runs in (AsyncLocalStorage owned by the decorator). */
@Injectable()
export class TrackedAuthFlowSubject implements AuthFlowSubjectPort {
	public identify(userId: string): void {
		identifyAuthFlowSubject(userId);
	}
}

/**
 * Records completed auth flows as `auth.flow` outbox events. A flow outcome is telemetry about the whole
 * flow — including failed attempts that write nothing — so it is recorded in its own awaited
 * transaction, never inside one domain transaction.
 */
@Injectable()
export class OutboxAuthFlowRecorder implements AuthFlowRecorder {
	public constructor(private readonly outbox: PlatformOutboxService) {}

	public async recordFlow(event: AuthFlowEvent): Promise<TelemetryRecordResult> {
		return this.outbox.recordTelemetry({ type: "auth.flow", payload: AuthFlowEventSchema.parse(event) });
	}
}
