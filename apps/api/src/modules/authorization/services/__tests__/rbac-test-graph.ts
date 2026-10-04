// TEST-ONLY collaborator factories for RBAC service specs: each builds the real
// class from its real constructor arguments (no connection is opened), so specs
// stay type-checked without casts; mocked modules simply ignore the arguments.

import type { TypedConfigService } from "../../../../config/typed-config.service";
import type { PrismaService } from "../../../../prisma/prisma.service";
import { AccessTokenStateService } from "../../../auth/services/access-token-state.service";
import { RefreshTokenRepository } from "../../../sessions/repositories/refresh-token.repository";
import { SessionUserRepository } from "../../../sessions/repositories/session-user.repository";
import { AuthorizationCacheService } from "../../cache/authorization-cache.service";
import { AuthorizationInvalidationService } from "../../cache/authorization-invalidation.service";
import { UserSessionRevocationService } from "../user-session-revocation.service";
import { createTestTypedConfig } from "../../../../../test/support/test-api-env";

/** A local-only invalidation service (no Redis clients). */
export function createTestInvalidation(prisma: PrismaService, config: TypedConfigService = createTestTypedConfig()): AuthorizationInvalidationService {
	return new AuthorizationInvalidationService(new AuthorizationCacheService(config), new AccessTokenStateService(prisma, config), config, null, null);
}

export function createTestSessionRevocation(prisma: PrismaService): UserSessionRevocationService {
	return new UserSessionRevocationService(prisma, new RefreshTokenRepository(prisma), new SessionUserRepository(prisma), createTestInvalidation(prisma));
}
