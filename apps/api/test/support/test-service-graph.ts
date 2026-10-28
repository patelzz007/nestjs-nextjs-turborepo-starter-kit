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

import type { Prisma } from "@prisma/client";

import type { TypedConfigService } from "../../src/config/typed-config.service";
import type { Clock } from "../../src/platform/application/clock.port";
import { FixedClock } from "../../src/contexts/authorization/application/__tests__/fakes/authorization.fakes";
import { AccessControlService } from "../../src/contexts/authorization/application/services/access-control.service";
import { PrismaAccessFactsReader } from "../../src/contexts/authorization/infrastructure/access/prisma-access-facts.reader";
import { PrismaRecordOwnership } from "../../src/contexts/authorization/infrastructure/access/prisma-record-ownership";
import { AuthorizationAuditKernelService } from "../../src/contexts/authorization/infrastructure/kernel/authorization-audit-kernel.service";
import { AuthorizationKernelService } from "../../src/contexts/authorization/infrastructure/kernel/authorization-kernel.service";
import { TenantMembershipService } from "../../src/contexts/authorization/infrastructure/kernel/tenant-membership.service";
import { PrismaService } from "../../src/prisma/prisma.service";
import { SystemPrismaService } from "../../src/prisma/system-prisma.service";
import type { SystemDatabaseContext } from "../../src/prisma/tenant-context";
import { SERVES_EVERY_TENANT } from "./served-tenants";
import { createTestTypedConfig } from "./test-api-env";

/** Runs a system operation on the test client, which never opens a connection. */
function lookupOn(prisma: PrismaService): {
	withSystemOperation<TResult>(context: SystemDatabaseContext, work: (tx: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult>;
} {
	return {
		withSystemOperation: <TResult>(_context: SystemDatabaseContext, work: (tx: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult> => work(prisma),
	};
}

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
	readonly tenantMembership: TenantMembershipService;
	readonly accessControl: AccessControlService;
	readonly audit: AuthorizationAuditKernelService;
}

/** Builds the kernel's collaborators with their real constructor arguments. */
export function createTestAuthorizationKernelCollaborators(prisma: PrismaService = createTestPrisma(), clock: Clock = new FixedClock()): TestAuthorizationKernelCollaborators {
	const lookup = lookupOn(prisma);
	return {
		tenantMembership: new TenantMembershipService(lookup, SERVES_EVERY_TENANT),
		accessControl: new AccessControlService(new PrismaAccessFactsReader(lookup, clock), new PrismaRecordOwnership(lookup), clock),
		audit: new AuthorizationAuditKernelService(createTestSystemPrisma()),
	};
}

/** Builds the authorization kernel with its real constructor graph. */
export function createTestAuthorizationKernel(prisma: PrismaService = createTestPrisma()): AuthorizationKernelService {
	const collaborators = createTestAuthorizationKernelCollaborators(prisma);
	return new AuthorizationKernelService(collaborators.tenantMembership, collaborators.accessControl, collaborators.audit);
}
