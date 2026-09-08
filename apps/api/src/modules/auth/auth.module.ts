import { Inject, Logger, Module, type OnModuleDestroy } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule, ThrottlerStorage } from "@nestjs/throttler";
import { JwtModule } from "@nestjs/jwt";
import type Redis from "ioredis";

import { TypedConfigService } from "../../config/typed-config.service";
import { ConfigModule } from "../../config/config.module";
import { REDIS_PUBLISHER } from "../../infrastructure/redis/redis.tokens";
import { NotificationsModule } from "../notifications/notifications.module";
import { AuthorizationModule } from "../authorization/authorization.module";
import { PrismaModule } from "../../prisma/prisma.module";

import { AccessTokenModule } from "./access-token.module";
import { CookieConfigService } from "./constants/cookie.config";
import { AdminAccessGuard } from "./guards/admin-access.guard";
import { AuthGuard } from "./guards/auth.guard";
import { EmailVerifiedGuard } from "./guards/email-verified.guard";
import { RefreshTokenGuard } from "./guards/refresh-token.guard";
import { RestrictedSessionGuard } from "./guards/restricted-session.guard";
import { MutationIntentGuard } from "./guards/mutation-intent.guard";
import { SuperAdminGuard } from "./guards/super-admin.guard";
import { ClearAuthCookiesInterceptor } from "./interceptors/clear-auth-cookies.interceptor";
import { SetAuthCookiesInterceptor } from "./interceptors/set-auth-cookies.interceptor";
import { AuthController } from "./auth.controller";
import { MfaRecoveryController } from "./mfa-recovery.controller";
import { TwoFactorController } from "./two-factor.controller";
import { AuthService } from "./auth.service";
import { RedisUserSessionCacheService } from "./cache/redis-user-session-cache.service";
import { UserSessionCacheService } from "./cache/user-session-cache.service";
import { AuthMeCacheListener } from "./listeners/auth-me-cache.listener";
import { UserRepository } from "./repositories/user.repository";
import { AccountLockoutService } from "./services/account-lockout.service";
import { AdminUserService } from "./services/admin-user.service";
import { AuthEventsService } from "./services/auth-events.service";
import { AuthSessionService } from "./services/auth-session.service";
import { ChangePasswordService } from "./services/change-password.service";
import { CryptoService } from "./services/crypto.service";
import { EmailService } from "./services/email.service";
import { EmailVerificationService } from "./services/email-verification.service";
import { IdentityService } from "./services/identity.service";
import { UserProvisioningService } from "./services/user-provisioning.service";
import { LoginService } from "./services/login.service";
import { LoginVerificationService } from "./services/login-verification.service";
import { PasswordResetService } from "./services/password-reset.service";
import { PasswordHistoryService } from "./services/password-history.service";
import { SessionRestrictionService } from "./services/session-restriction.service";
import { TwoFactorService } from "./services/two-factor.service";
import { TaskScheduleService } from "./services/task-schedule.service";
import { TokenService } from "./services/token.service";
import { UserResponseMapper } from "./services/user-response.mapper";
import { MfaChallengeService } from "./services/mfa-challenge.service";
import { MfaRecoveryService } from "./services/mfa-recovery.service";
import { SecretEncryptionService } from "./services/secret-encryption.service";
import { authThrottlerOptionsFactory } from "./throttling/auth-throttler.config";
import { RedisThrottlerStorage } from "./throttling/redis-throttler.storage";

@Module({
	imports: [
		PrismaModule,
		AccessTokenModule,
		JwtModule.register({ global: true }),
		AuthorizationModule,
		NotificationsModule,
		ThrottlerModule.forRootAsync({
			imports: [ConfigModule],
			inject: [TypedConfigService],
			useFactory: authThrottlerOptionsFactory,
		}),
	],
	controllers: [AuthController, TwoFactorController, MfaRecoveryController],
	providers: [
		// ── Facade ──────────────────────────────────────────────
		AuthService,
		// ── Session cache ───────────────────────────────────────
		{
			provide: "IN_MEMORY_USER_SESSION_CACHE",
			useClass: UserSessionCacheService,
		},
		{
			provide: "REDIS_USER_SESSION_CACHE_LIFECYCLE",
			useFactory: async (config: TypedConfigService, publisher: Redis | null): Promise<RedisUserSessionCacheService | null> => {
				if (!config.useRedisUserSessionCache) {
					if (config.userSessionCacheBackend === "redis" && config.redisUrl === undefined) {
						Logger.warn("USER_SESSION_CACHE_BACKEND=redis but REDIS_URL is unset — using in-memory user session cache", AuthModule.name);
					}
					return null;
				}
				if (publisher === null) {
					return null;
				}
				const redisCache = new RedisUserSessionCacheService(config, publisher);
				await redisCache.onModuleInit();
				return redisCache;
			},
			inject: [TypedConfigService, REDIS_PUBLISHER],
		},
		{
			provide: UserSessionCacheService,
			useFactory: (memory: UserSessionCacheService, redis: RedisUserSessionCacheService | null): UserSessionCacheService => redis ?? memory,
			inject: ["IN_MEMORY_USER_SESSION_CACHE", "REDIS_USER_SESSION_CACHE_LIFECYCLE"],
		},
		// ── Domain services ─────────────────────────────────────
		IdentityService,
		UserProvisioningService,
		AuthSessionService,
		SessionRestrictionService,
		LoginService,
		LoginVerificationService,
		PasswordResetService,
		ChangePasswordService,
		PasswordHistoryService,
		TwoFactorService,
		EmailVerificationService,
		AdminUserService,
		AccountLockoutService,
		MfaChallengeService,
		MfaRecoveryService,
		SecretEncryptionService,
		UserResponseMapper,
		// ── Infrastructure ──────────────────────────────────────
		UserRepository,
		AuthEventsService,
		TokenService,
		CryptoService,
		RedisThrottlerStorage,
		{
			provide: ThrottlerStorage,
			useExisting: RedisThrottlerStorage,
		},
		{
			provide: APP_GUARD,
			useClass: ThrottlerGuard,
		},
		{
			provide: APP_GUARD,
			useClass: MutationIntentGuard,
		},
		CookieConfigService,
		EmailService,
		TaskScheduleService,
		// ── Guards & interceptors ────────────────────────────────
		AuthGuard,
		AdminAccessGuard,
		EmailVerifiedGuard,
		RestrictedSessionGuard,
		SuperAdminGuard,
		RefreshTokenGuard,
		SetAuthCookiesInterceptor,
		ClearAuthCookiesInterceptor,
		AuthMeCacheListener,
	],
	exports: [
		// ── Facade ──────────────────────────────────────────────
		AuthService,
		// ── Domain services (for sibling modules) ───────────────
		IdentityService,
		UserProvisioningService,
		UserResponseMapper,
		UserSessionCacheService,
		// ── Infrastructure ──────────────────────────────────────
		UserRepository,
		AuthEventsService,
		TokenService,
		SessionRestrictionService,
		CryptoService,
		AccessTokenModule,
		MfaChallengeService,
		SecretEncryptionService,
		EmailService,
		EmailVerificationService,
		AuthGuard,
		AdminAccessGuard,
		EmailVerifiedGuard,
		RestrictedSessionGuard,
		SuperAdminGuard,
		RefreshTokenGuard,
		SetAuthCookiesInterceptor,
		ClearAuthCookiesInterceptor,
		CookieConfigService,
	],
})
export class AuthModule implements OnModuleDestroy {
	public constructor(@Inject("REDIS_USER_SESSION_CACHE_LIFECYCLE") private readonly redisUserSessionCache: RedisUserSessionCacheService | null) {}

	public async onModuleDestroy(): Promise<void> {
		if (this.redisUserSessionCache !== null) {
			await this.redisUserSessionCache.onModuleDestroy();
		}
	}
}
