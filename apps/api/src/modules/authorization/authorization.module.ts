import { Global, Inject, Logger, Module, type OnModuleDestroy } from "@nestjs/common";
import type Redis from "ioredis";

import { TypedConfigService } from "../../config/typed-config.service";
import { REDIS_PUBLISHER, REDIS_SUBSCRIBER } from "../../infrastructure/redis/redis.tokens";

import { AuthorizationAuditService } from "./audit/authorization-audit.service";
import { AuthorizationCacheService } from "./cache/authorization-cache.service";
import { RedisAuthorizationCacheService } from "./cache/redis-authorization-cache.service";
import { AuthorizationHealthIndicator } from "./health/authorization.health";
import { AuthorizationGuard } from "./guards/authorization.guard";
import { AuthorizationCheckerService } from "./services/authorization-checker.service";
import { AuthorizationService } from "./services/authorization.service";
import { AuthRateLimitService } from "./services/auth-rate-limit.service";
import { ConflictDetectionService } from "./services/conflict-detection.service";
import { PermissionService } from "./services/permission.service";
import { RoleService } from "./services/role.service";
import { PermissionExpiryCleanup } from "./cleanup/permission-expiry.cleanup";
import { PermissionMigrationService } from "./migration/permission-migration.service";
import { PermissionRegistrySyncBootstrap } from "./migration/permission-registry-sync.bootstrap";
import { PolicyRegistry } from "./policies/policy-registry";
import { AuditLogCleanup } from "./cleanup/audit-log.cleanup";
import { AuthorizationEventEmitter } from "./events/authorization.events";

/**
 * First-class authorization module for NestJS + Fastify + Prisma.
 *
 * Provides:
 * - **AuthorizationService** — Spatie-like fluent facade
 * - **AuthorizationCheckerService** — permission/role evaluation
 * - **RoleService** — CRUD + assignment + hierarchy
 * - **PermissionService** — CRUD + direct user grants
 * - **AuthorizationCacheService** — in-memory cache (Redis-ready)
 * - **AuthorizationGuard** — global guard
 * - **ConflictDetectionService** — role conflict rules
 * - **PolicyRegistry** — resource-specific policies
 * - **PermissionMigrationService** — code-to-DB sync
 * - **PermissionExpiryCleanup** — background cleanup of expired grants
 * - **AuthRateLimitService** — rate limiting on auth checks
 * - **AuthorizationEventEmitter** — NestJS events for auth changes
 * - **AuthorizationAuditService** — audit logging
 */
@Global()
@Module({
	providers: [
		{
			provide: "IN_MEMORY_AUTH_CACHE",
			useClass: AuthorizationCacheService,
		},
		{
			provide: "REDIS_AUTH_CACHE_LIFECYCLE",
			useFactory: async (
				config: TypedConfigService,
				memory: AuthorizationCacheService,
				publisher: Redis | null,
				subscriber: Redis | null,
			): Promise<RedisAuthorizationCacheService | null> => {
				if (!config.useRedisAuthorizationCache) {
					if (config.authorizationCacheBackend === "redis" && config.redisUrl === undefined) {
						Logger.warn("AUTHORIZATION_CACHE_BACKEND=redis but REDIS_URL is unset — using in-memory authorization cache", AuthorizationModule.name);
					}
					return null;
				}
				if (publisher === null || subscriber === null) {
					return null;
				}
				const redis = new RedisAuthorizationCacheService(memory, publisher, subscriber);
				await redis.onModuleInit();
				return redis;
			},
			inject: [TypedConfigService, "IN_MEMORY_AUTH_CACHE", REDIS_PUBLISHER, REDIS_SUBSCRIBER],
		},
		{
			provide: AuthorizationCacheService,
			useFactory: (memory: AuthorizationCacheService, redis: RedisAuthorizationCacheService | null): AuthorizationCacheService => redis ?? memory,
			inject: ["IN_MEMORY_AUTH_CACHE", "REDIS_AUTH_CACHE_LIFECYCLE"],
		},
		AuthorizationCheckerService,
		RoleService,
		PermissionService,
		AuthorizationService,
		AuthorizationGuard,
		AuthorizationAuditService,
		AuthorizationHealthIndicator,
		ConflictDetectionService,
		PolicyRegistry,
		PermissionMigrationService,
		PermissionRegistrySyncBootstrap,
		PermissionExpiryCleanup,
		AuditLogCleanup,
		AuthRateLimitService,
		AuthorizationEventEmitter,
	],
	exports: [
		AuthorizationCacheService,
		AuthorizationCheckerService,
		RoleService,
		PermissionService,
		AuthorizationService,
		AuthorizationGuard,
		AuthorizationAuditService,
		AuthorizationHealthIndicator,
		ConflictDetectionService,
		PolicyRegistry,
		PermissionMigrationService,
		PermissionExpiryCleanup,
		AuthRateLimitService,
		AuthorizationEventEmitter,
	],
})
export class AuthorizationModule implements OnModuleDestroy {
	public constructor(@Inject("REDIS_AUTH_CACHE_LIFECYCLE") private readonly redisAuthCache: RedisAuthorizationCacheService | null) {}

	public async onModuleDestroy(): Promise<void> {
		if (this.redisAuthCache !== null) {
			await this.redisAuthCache.onModuleDestroy();
		}
	}
}
