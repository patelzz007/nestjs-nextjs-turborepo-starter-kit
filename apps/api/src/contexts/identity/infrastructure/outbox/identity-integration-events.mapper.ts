import { ImpersonationActionEventSchema, SessionActionEventSchema, type PlatformEventInput } from "@workspace/shared";

import type { DomainEvent } from "../../../../platform/domain/domain-event";
import type { IntegrationEventMapper } from "../../../../platform/application/events/integration-event-mapper";
import {
	AllDeviceSessionsSignedOut,
	DeviceSessionRotated,
	DeviceSessionSignedOut,
	ImpersonationStarted,
	ImpersonationStopped,
	RefreshTokenReuseDetected,
	type SessionActionName,
} from "../../domain/events/identity.events";

/** The action's duration as the payload reports it (ms between the use case start and the event). */
function durationOf(startedAt: number, occurredAt: number): number {
	return Math.max(0, occurredAt - startedAt);
}

function sessionAction(action: SessionActionName, userId: string, error: string | null, startedAt: number, occurredAt: number): PlatformEventInput {
	return {
		type: "session.action",
		payload: SessionActionEventSchema.parse({ action, userId, status: error === null ? "succeeded" : "failed", error, durationMs: durationOf(startedAt, occurredAt) }),
	};
}

function impersonationAction(action: "start" | "stop", superAdminId: string, targetUserId: string, startedAt: number, occurredAt: number): PlatformEventInput {
	return {
		type: "impersonation.action",
		payload: ImpersonationActionEventSchema.parse({ action, superAdminId, targetUserId, status: "succeeded", error: null, durationMs: durationOf(startedAt, occurredAt) }),
	};
}

/**
 * Identity's integration events (mechanism 3): the existing `session.action` and `impersonation.action`
 * outbox payloads, written in the same transaction as the session or impersonation change they describe.
 */
export class IdentityIntegrationEventsMapper implements IntegrationEventMapper {
	public map(event: DomainEvent): PlatformEventInput | null {
		if (event instanceof DeviceSessionRotated) {
			return sessionAction("refresh", event.userId, null, event.startedAt, event.occurredAt);
		}
		if (event instanceof RefreshTokenReuseDetected) {
			return sessionAction("refresh", event.userId, "TOKEN_THEFT_DETECTED", event.startedAt, event.occurredAt);
		}
		if (event instanceof DeviceSessionSignedOut) {
			return sessionAction(event.action, event.userId, null, event.startedAt, event.occurredAt);
		}
		if (event instanceof AllDeviceSessionsSignedOut) {
			return sessionAction("logout-all", event.userId, null, event.startedAt, event.occurredAt);
		}
		if (event instanceof ImpersonationStarted) {
			return impersonationAction("start", event.impersonatorId, event.targetUserId, event.startedAt, event.occurredAt);
		}
		if (event instanceof ImpersonationStopped) {
			return impersonationAction("stop", event.impersonatorId, event.targetUserId, event.startedAt, event.occurredAt);
		}
		return null;
	}
}
