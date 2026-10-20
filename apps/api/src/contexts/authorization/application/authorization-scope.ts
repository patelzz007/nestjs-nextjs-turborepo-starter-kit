import type { TransactionalEventCollector } from "../../../platform/application/events/transactional-event-collector";
import type { IdentitySessionsPort } from "../../../platform/application/ports/identity-sessions.port";

import type { PermissionRepository } from "../domain/repositories/permission.repository";
import type { PolicyDraftRepository } from "../domain/repositories/policy-draft.repository";
import type { RoleRepository } from "../domain/repositories/role.repository";
import type { SupportAccessGrantRepository } from "../domain/repositories/support-access-grant.repository";
import type { UserAuthorizationRepository } from "../domain/repositories/user-authorization.repository";
import type { AuthorizationCatalogStore } from "./ports/catalog-sync.port";
import type { PermissionAuditWriter } from "./ports/permission-audit.port";
import type { PolicyAuditWriter, PolicyPrincipalReader, PolicySimulationStore, PolicyVersionStore } from "./ports/policy-control-plane.port";
import type { RbacGraphReader, RbacMutationLock } from "./ports/rbac-graph.port";
import type { TenantAuditWriter, SupportAccessTenantReader } from "./ports/support-access.port";

/**
 * Everything one authorization transaction can touch. Every member is bound to that transaction by
 * `AuthorizationScopeFactory` (new instances per unit of work, never cached), so a role change, the
 * session revocation and the permission audit row commit or roll back together.
 */
export interface AuthorizationScope {
	// ── RBAC ────────────────────────────────────────────────────────────
	readonly roles: RoleRepository;
	readonly permissions: PermissionRepository;
	readonly userAuthorizations: UserAuthorizationRepository;
	readonly rbacGraph: RbacGraphReader;
	readonly rbacLock: RbacMutationLock;
	readonly permissionAudit: PermissionAuditWriter;
	/** Identity's sessions, revoked in THIS transaction (decision #42). */
	readonly identitySessions: IdentitySessionsPort;
	// ── Boot-time catalog sync ──────────────────────────────────────────
	readonly catalog: AuthorizationCatalogStore;
	// ── Policy control plane ────────────────────────────────────────────
	readonly policyDrafts: PolicyDraftRepository;
	readonly policyVersions: PolicyVersionStore;
	readonly policySimulations: PolicySimulationStore;
	readonly policyPrincipals: PolicyPrincipalReader;
	readonly policyAudit: PolicyAuditWriter;
	// ── Support access ──────────────────────────────────────────────────
	readonly supportGrants: SupportAccessGrantRepository;
	readonly supportTenants: SupportAccessTenantReader;
	readonly tenantAudit: TenantAuditWriter;
	readonly events: TransactionalEventCollector;
}
