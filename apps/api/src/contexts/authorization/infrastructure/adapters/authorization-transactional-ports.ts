import type { Prisma } from "@prisma/client";

import { RequestContextService } from "../../../../platform/infrastructure/context/request-context";
import type { DefaultRoleAssignmentPort } from "../../application/ports/default-role-assignment.port";
import { ProvisioningRoleAssigner } from "../../application/services/provisioning-role-assigner";
import { PrismaPermissionAuditWriter } from "../persistence/prisma-permission-audit.writer";
import { PrismaRbacGraphReader } from "../persistence/prisma-rbac-graph.reader";
import { PrismaRoleRepository } from "../persistence/prisma-role.repository";
import { PrismaUserAuthorizationRepository } from "../persistence/prisma-user-authorization.repository";

/** Authorization's ports bound to ANOTHER context's transaction (§5.4 cross-context scopes). */
export interface AuthorizationTransactionalPorts {
	readonly defaultRoleAssignment: DefaultRoleAssignmentPort;
}

/**
 * Build the ports on `db`, the caller's transaction (signup, invite registration, the SuperAdmin
 * bootstrap). Only other contexts' infrastructure may call it. New instances every call; never cached.
 */
export function createAuthorizationTransactionalPorts(db: Prisma.TransactionClient): AuthorizationTransactionalPorts {
	return {
		defaultRoleAssignment: new ProvisioningRoleAssigner({
			roles: new PrismaRoleRepository(db),
			userAuthorizations: new PrismaUserAuthorizationRepository(db),
			rbacGraph: new PrismaRbacGraphReader(db),
			permissionAudit: new PrismaPermissionAuditWriter(db, new RequestContextService()),
		}),
	};
}
