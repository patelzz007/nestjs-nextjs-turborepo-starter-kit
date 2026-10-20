/** `TenantAuditLog.resourceType` of support-access audit rows. */
export const SUPPORT_ACCESS_AUDIT_RESOURCE_TYPE = "SupportAccessGrant";

/** `TenantAuditLog.action` values of the support-access lifecycle. */
export const SUPPORT_ACCESS_AUDIT_ACTIONS = {
	requested: "support.grant_requested",
	approved: "support.grant_approved",
	revoked: "support.grant_revoked",
} satisfies Record<string, string>;
