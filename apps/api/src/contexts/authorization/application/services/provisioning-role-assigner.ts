import type { RoleAggregate } from "../../domain/aggregates/role.aggregate";
import type { UserAuthorizationAggregate } from "../../domain/aggregates/user-authorization.aggregate";
import { PlatformRoleNotConfiguredError, RbacTargetUserNotFoundError } from "../../domain/errors/authorization.errors";
import { assertSeparationOfDuties } from "../../domain/policies/separation-of-duties.policy";
import { DEFAULT_CONSUMER_ROLE_NAME } from "../../domain/rbac-catalog";
import type { RoleRepository } from "../../domain/repositories/role.repository";
import type { UserAuthorizationRepository } from "../../domain/repositories/user-authorization.repository";
import type { DefaultRoleAssignmentPort, PlatformRoleAssignmentOutcome, PlatformRoleAssignmentRequest } from "../ports/default-role-assignment.port";
import type { AuthorizationAuditAction, PermissionAuditActor, PermissionAuditWriter } from "../ports/permission-audit.port";
import type { RbacGraphReader } from "../ports/rbac-graph.port";

/** The repositories one provisioning transaction lends the assigner (all bound to the CALLER's transaction). */
export interface ProvisioningRoleScope {
	readonly roles: RoleRepository;
	readonly userAuthorizations: UserAuthorizationRepository;
	readonly rbacGraph: RbacGraphReader;
	readonly permissionAudit: PermissionAuditWriter;
}

/**
 * Attaches a platform role to an account created in the caller's transaction. No session revocation and
 * no invalidation (the account has neither yet); separation of duties still applies; the audit row is
 * written on the same transaction.
 */
export class ProvisioningRoleAssigner implements DefaultRoleAssignmentPort {
	public constructor(private readonly scope: ProvisioningRoleScope) {}

	public async assignDefaultRole(userId: string): Promise<void> {
		const role: RoleAggregate | null = await this.scope.roles.findLiveByName(DEFAULT_CONSUMER_ROLE_NAME);
		if (role === null) {
			throw new PlatformRoleNotConfiguredError(DEFAULT_CONSUMER_ROLE_NAME);
		}
		await this.attach(userId, role.id, userId);
		await this.scope.permissionAudit.append({ action: "ROLE_ASSIGNED_AT_PROVISIONING", actor: { kind: "USER", userId }, targetUserId: userId, targetRoleId: role.id });
	}

	public async assignPlatformRole(request: PlatformRoleAssignmentRequest): Promise<PlatformRoleAssignmentOutcome> {
		const role: RoleAggregate | null = await this.scope.roles.findLiveByName(request.roleName);
		if (role === null) {
			return { kind: "role_missing" };
		}
		await this.attach(request.userId, role.id, request.operation);
		const actor: PermissionAuditActor = { kind: "SYSTEM_OPERATION", operation: request.operation };
		const actions: readonly AuthorizationAuditAction[] = [...request.precedingAuditActions, "ROLE_ASSIGNED_AT_PROVISIONING"];
		for (const action of actions) {
			await this.scope.permissionAudit.append({ action, actor, targetUserId: request.userId, targetRoleId: role.id, detail: request.detail });
		}
		return { kind: "assigned", roleId: role.id };
	}

	public async findPlatformRoleId(roleName: string): Promise<string | null> {
		const role: RoleAggregate | null = await this.scope.roles.findLiveByName(roleName);
		return role === null ? null : role.id;
	}

	private async attach(userId: string, roleId: string, assignedBy: string): Promise<void> {
		const account: UserAuthorizationAggregate | null = await this.scope.userAuthorizations.findForAccount(userId);
		if (account === null) {
			throw new RbacTargetUserNotFoundError(userId);
		}
		account.attachProvisioningRole(roleId, assignedBy);
		await this.scope.userAuthorizations.save(account);
		assertSeparationOfDuties(await this.scope.rbacGraph.activeRoleNames(await this.scope.rbacGraph.assignedRoleIds(userId)));
	}
}
