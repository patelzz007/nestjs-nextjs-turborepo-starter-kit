import { RequestContextService } from "../../../common/context/request-context";
import { TypedConfigService } from "../../../config/typed-config.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { AuthorizationAuditService } from "../../authorization/audit/authorization-audit.service";
import { RoleAssignmentRepository } from "../../authorization/repositories/role-assignment.repository";
import { RoleRepository } from "../../authorization/repositories/role.repository";
import { ConflictDetectionService } from "../../authorization/services/conflict-detection.service";
import { CryptoService } from "../services/crypto.service";
import { NodeOperatorIdentityProvider } from "../../../common/operator-identity";
import { SuperAdminBootstrapRepository } from "./superadmin-bootstrap.repository";
import { SuperAdminBootstrapService } from "./superadmin-bootstrap.service";

/**
 * Wires the bootstrap service from the application's OWN collaborators (the same hasher and cost as
 * signup, the same RBAC repositories, separation-of-duty check and audit writer) by hand: the command
 * runs under tsx without Nest decorator metadata or a container, and needs no Redis, queue or HTTP server.
 */
export function createSuperAdminBootstrapService(config: TypedConfigService, prisma: PrismaService): SuperAdminBootstrapService {
	const requestContext = new RequestContextService();
	const tenantTx = new TenantTransactionService(prisma, requestContext);
	const roles = new RoleRepository(prisma);
	const assignments = new RoleAssignmentRepository();
	return new SuperAdminBootstrapService(
		tenantTx,
		new SuperAdminBootstrapRepository(),
		roles,
		assignments,
		new ConflictDetectionService(roles, assignments, tenantTx),
		new AuthorizationAuditService(requestContext),
		new CryptoService(config),
		new NodeOperatorIdentityProvider(),
	);
}
