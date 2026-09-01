import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { CookieConfigService } from "./constants/cookie.config";
import { AdminAccessGuard } from "./guards/admin-access.guard";
import { AuthGuard } from "./guards/auth.guard";
import { EmailVerifiedGuard } from "./guards/email-verified.guard";
import { RefreshTokenGuard } from "./guards/refresh-token.guard";
import { SuperAdminGuard } from "./guards/super-admin.guard";
import { ClearAuthCookiesInterceptor } from "./interceptors/clear-auth-cookies.interceptor";
import { SetAuthCookiesInterceptor } from "./interceptors/set-auth-cookies.interceptor";
import { PrismaModule } from "../../prisma/prisma.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { AuthorizationModule } from "../authorization/authorization.module";

import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
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
export class AuthModule {}
