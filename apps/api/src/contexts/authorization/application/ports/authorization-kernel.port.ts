import type { AuthorizationDecision, AuthorizationRequest, AuthorizationResult } from "@workspace/shared";

/** Request metadata recorded alongside an audited decision. */
export interface AuthorizationAuditMetadata {
	readonly ipAddress?: string;
	readonly userAgent?: string;
	readonly requestId?: string;
}

/**
 * The single backend decision point (ADR 026): RBAC grants with scopes, ReBAC tenant membership, ABAC
 * conditional policies and resource ACLs. `authorize` throws `AccessDeniedError` (`PERMISSION_DENIED`).
 */
export interface AuthorizationKernelPort {
	can(request: AuthorizationRequest): Promise<AuthorizationDecision>;
	/** Audited (DENY, writes, sensitive reads); throws on DENY. */
	authorize(request: AuthorizationRequest, metadata?: AuthorizationAuditMetadata): Promise<void>;
	explain(request: AuthorizationRequest): Promise<AuthorizationResult>;
}

/** The explicit, audited platform bypass a SuperAdmin takes on a protected route (`SUPER_ADMIN_BYPASS`). */
export interface SuperAdminBypassAuditPort {
	recordBypass(userId: string, detail: string): Promise<void>;
}
