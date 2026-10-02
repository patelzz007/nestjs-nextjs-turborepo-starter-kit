// ============================================
// test/support/test-service-graph.ts - TEST-ONLY collaborator factories
// ============================================
// Unit specs replace collaborators with `vi.mock` class factories, but the
// class under test still declares its real constructor. These factories build
// each collaborator with its REAL constructor arguments (rooted at the hermetic
// TEST-ONLY config), so specs stay fully type-checked without casts: when a
// collaborator module is mocked, vitest swaps the class and the arguments are
// simply ignored; when it is not, the real (connection-less) instance is used.
// Nothing here opens a network or database connection — pg pools connect lazily.

import type { TypedConfigService } from "../../src/config/typed-config.service";
import { AuthorizationAuditKernelService } from "../../src/modules/authorization/kernel/authorization-audit-kernel.service";
import { AclService } from "../../src/modules/authorization/kernel/acl.service";
import { AuthorizationKernelService } from "../../src/modules/authorization/kernel/authorization-kernel.service";
import { PolicyEngineService } from "../../src/modules/authorization/kernel/policy-engine.service";
import { ResourceOwnershipResolver } from "../../src/modules/authorization/kernel/resource-ownership.resolver";
import { SubjectGrantsLoader } from "../../src/modules/authorization/kernel/subject-grants.loader";
import { TenantMembershipService } from "../../src/modules/authorization/kernel/tenant-membership.service";
import { PrismaService } from "../../src/prisma/prisma.service";
import { SystemPrismaService } from "../../src/prisma/system-prisma.service";
import { createTestTypedConfig } from "./test-api-env";

/** A tenant-scoped Prisma client over the TEST-ONLY config (no connection is opened). */
export function createTestPrisma(config: TypedConfigService = createTestTypedConfig()): PrismaService {
	return new PrismaService(config);
}

/** A system (RLS-bypassing) Prisma client over the TEST-ONLY config (no connection is opened). */
export function createTestSystemPrisma(config: TypedConfigService = createTestTypedConfig()): SystemPrismaService {
	return new SystemPrismaService(config);
}

/** Every collaborator the authorization kernel is constructed from. */
export interface TestAuthorizationKernelCollaborators {
	readonly grantsLoader: SubjectGrantsLoader;
	readonly tenantMembership: TenantMembershipService;
	readonly ownership: ResourceOwnershipResolver;
	readonly aclService: AclService;
	readonly policyEngine: PolicyEngineService;
	readonly audit: AuthorizationAuditKernelService;
}

/** Builds the kernel's collaborators with their real constructor arguments. */
export function createTestAuthorizationKernelCollaborators(prisma: PrismaService = createTestPrisma()): TestAuthorizationKernelCollaborators {
	const policyEngine = new PolicyEngineService(prisma);
	return {
		grantsLoader: new SubjectGrantsLoader(prisma),
		tenantMembership: new TenantMembershipService(prisma),
		ownership: new ResourceOwnershipResolver(prisma),
		aclService: new AclService(prisma, policyEngine),
		policyEngine,
		audit: new AuthorizationAuditKernelService(createTestSystemPrisma()),
	};
}

/** Builds the authorization kernel with its real constructor graph. */
export function createTestAuthorizationKernel(prisma: PrismaService = createTestPrisma()): AuthorizationKernelService {
	const collaborators = createTestAuthorizationKernelCollaborators(prisma);
	return new AuthorizationKernelService(
		collaborators.grantsLoader,
		collaborators.tenantMembership,
		collaborators.ownership,
		collaborators.aclService,
		collaborators.policyEngine,
		collaborators.audit,
	);
}
