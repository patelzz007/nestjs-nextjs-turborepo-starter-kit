import { Inject, Logger, Module, type OnModuleDestroy } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import type Redis from "ioredis";

import { TypedConfigService } from "../../config/typed-config.service";
import { REDIS_PUBLISHER } from "../../infrastructure/redis/redis.tokens";
import { NotificationsModule } from "../notifications/notifications.module";
import { AuthorizationModule } from "../authorization/authorization.module";
import { PrismaModule } from "../../prisma/prisma.module";

import { CookieConfigService } from "./constants/cookie.config";
import { AdminAccessGuard } from "./guards/admin-access.guard";
import { AuthGuard } from "./guards/auth.guard";
import { EmailVerifiedGuard } from "./guards/email-verified.guard";
import { RefreshTokenGuard } from "./guards/refresh-token.guard";
import { SuperAdminGuard } from "./guards/super-admin.guard";
import { ClearAuthCookiesInterceptor } from "./interceptors/clear-auth-cookies.interceptor";
import { SetAuthCookiesInterceptor } from "./interceptors/set-auth-cookies.interceptor";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { RedisUserSessionCacheService } from "./cache/redis-user-session-cache.service";
import { UserSessionCacheService } from "./cache/user-session-cache.service";
import { AuthMeCacheListener } from "./listeners/auth-me-cache.listener";
import { UserRepository } from "./repositories/user.repository";
import { AccountLockoutService } from "./services/account-lockout.service";
import { AdminUserService } from "./services/admin-user.service";
import { AuthEventsService } from "./services/auth-events.service";
import { CryptoService } from "./services/crypto.service";
import { EmailService } from "./services/email.service";
import { EmailVerificationService } from "./services/email-verification.service";
import { IdentityService } from "./services/identity.service";
import { LoginService } from "./services/login.service";
import { PasswordResetService } from "./services/password-reset.service";
import { TaskScheduleService } from "./services/task-schedule.service";
import { TokenService } from "./services/token.service";
import { UserResponseMapper } from "./services/user-response.mapper";

@Module({
	imports: [PrismaModule, JwtModule.register({ global: true }), AuthorizationModule, NotificationsModule],
	controllers: [AuthController],
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
		LoginService,
		PasswordResetService,
		EmailVerificationService,
		AdminUserService,
		AccountLockoutService,
		UserResponseMapper,
		// ── Infrastructure ──────────────────────────────────────
		UserRepository,
		AuthEventsService,
		TokenService,
		CryptoService,
		CookieConfigService,
		EmailService,
		TaskScheduleService,
		// ── Guards & interceptors ────────────────────────────────
		AuthGuard,
		AdminAccessGuard,
		EmailVerifiedGuard,
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
		UserResponseMapper,
		UserSessionCacheService,
		// ── Infrastructure ──────────────────────────────────────
		AuthEventsService,
		TokenService,
		CryptoService,
		EmailService,
		AuthGuard,
		AdminAccessGuard,
		EmailVerifiedGuard,
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
