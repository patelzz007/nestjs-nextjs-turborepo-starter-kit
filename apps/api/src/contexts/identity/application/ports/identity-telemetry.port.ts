import type { SessionActionName } from "../../domain/events/identity.events";

/** A session action that wrote nothing (a benign concurrent refresh, an idempotent logout). */
export interface SessionActionTelemetry {
	readonly action: SessionActionName;
	readonly userId: string;
	readonly error: string | null;
	readonly durationMs: number;
}

/**
 * Telemetry for outcomes with no database write to be atomic with: recorded in its own transaction
 * (outbox `session.action`). Outcomes that do write go through domain events and the outbox mapper.
 */
export interface IdentityTelemetryPort {
	recordSessionAction(event: SessionActionTelemetry): Promise<void>;
}
