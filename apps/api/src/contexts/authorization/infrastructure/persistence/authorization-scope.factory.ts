import type { Prisma } from "@prisma/client";

import type { ScopeFactory } from "../../../../platform/application/events/in-transaction-event-handler";
import type { TransactionalEventCollector } from "../../../../platform/application/events/transactional-event-collector";
import type { IdentitySessionsPortFactory } from "../../../../platform/application/ports/identity-sessions.port";
import type { RequestContextService } from "../../../../platform/infrastructure/context/request-context";
import type { AuthorizationScope } from "../../application/authorization-scope";
import { createTenantsTransactionalPorts } from "../../../tenancy/public-api";
import { PrismaAuthorizationCatalogStore } from "./prisma-authorization-catalog.store";
import { PrismaPermissionAuditWriter } from "./prisma-permission-audit.writer";
import { PrismaPermissionRepository } from "./prisma-permission.repository";
import { PrismaPolicyControlPlaneStore, PrismaPolicyDraftRepository } from "./prisma-policy-control-plane.repository";
import { PrismaRbacGraphReader, PrismaRbacMutationLock } from "./prisma-rbac-graph.reader";
import { PrismaRoleRepository } from "./prisma-role.repository";
import { PrismaSupportAccessGrantRepository } from "./prisma-support-access-grant.repository";
import { PrismaUserAuthorizationRepository } from "./prisma-user-authorization.repository";

/** Builds every authorization repository and port bound to the unit-of-work transaction. New instances per call; never cached. */
export class AuthorizationScopeFactory implements ScopeFactory<AuthorizationScope, Prisma.TransactionClient> {
	public constructor(
		private readonly identitySessions: IdentitySessionsPortFactory<Prisma.TransactionClient>,
		private readonly requestContext: RequestContextService,
	) {}

	public create(db: Prisma.TransactionClient, events: TransactionalEventCollector): AuthorizationScope {
		const controlPlane = new PrismaPolicyControlPlaneStore(db, this.requestContext);
		const tenants = createTenantsTransactionalPorts(db);
		return {
			roles: new PrismaRoleRepository(db),
			permissions: new PrismaPermissionRepository(db),
			userAuthorizations: new PrismaUserAuthorizationRepository(db),
			rbacGraph: new PrismaRbacGraphReader(db),
			rbacLock: new PrismaRbacMutationLock(db),
			permissionAudit: new PrismaPermissionAuditWriter(db, this.requestContext),
			identitySessions: this.identitySessions.forTransaction(db),
			catalog: new PrismaAuthorizationCatalogStore(db),
			policyDrafts: new PrismaPolicyDraftRepository(db),
			policyVersions: controlPlane,
			policySimulations: controlPlane,
			policyPrincipals: controlPlane,
			policyAudit: controlPlane,
			supportGrants: new PrismaSupportAccessGrantRepository(db),
			supportTenants: tenants.existence,
			tenantAudit: tenants.audit,
			events,
		};
	}
}
