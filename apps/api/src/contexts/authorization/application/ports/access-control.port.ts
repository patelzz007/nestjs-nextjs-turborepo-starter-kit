// ============================================
// application/ports/access-control.port.ts — the access decision, as other contexts see it (ADR 067)
// ============================================
// Dependency Inversion + Interface Segregation: a context that needs a decision
// (tenancy's merchant capability gate) depends on this interface and the
// `ACCESS_CONTROL` token, never on `AccessControlService` itself — so it never
// imports the authorization module's classes, and no import cycle can leave
// the dependency undefined when Nest reads the constructor.

import type { PermissionPair } from "@workspace/shared";

import type { AccessDecision, AccessRequest } from "../../domain/access/access-request";

export interface AccessControlPort {
	/** Allowed or not, and which path allowed it (deny by default). */
	decide(request: AccessRequest): Promise<AccessDecision>;
	/** Every permission the caller holds right now through their role or a live grant. */
	effectivePermissions(userId: string, tenantId: string | undefined): Promise<readonly PermissionPair[]>;
}
