import type { ActorContext } from "../../../../platform/application/actor-context";
import { BACKGROUND_AUDIT_ORIGIN, type AuditOrigin } from "../../domain/value-objects/audit-origin.value-object";

/** The audit-row origin of an actor's request (correlation id, client, the impersonator behind it). */
export function auditOriginOf(actor: ActorContext): AuditOrigin {
	if (actor.kind === "system") {
		return BACKGROUND_AUDIT_ORIGIN;
	}
	return {
		correlationId: actor.request.requestId,
		ipAddress: actor.request.ip,
		userAgent: actor.request.userAgent,
		impersonatorId: actor.kind === "user" ? actor.impersonatorUserId : null,
	};
}
