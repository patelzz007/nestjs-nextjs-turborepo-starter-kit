import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { CookieConfigService } from "./constants/cookie.config.js";
import { AuthGuard } from "./guards/auth.guard.js";
import { RefreshTokenGuard } from "./guards/refresh-token.guard.js";
import { SuperAdminGuard } from "./guards/super-admin.guard.js";
import { ClearAuthCookiesInterceptor } from "./interceptors/clear-auth-cookies.interceptor.js";
import { SetAuthCookiesInterceptor } from "./interceptors/set-auth-cookies.interceptor.js";
import { TypedConfigService } from "../../config/typed-config.service.js";
import { LogService } from "../../modules/logs/logs.service.js";
import { PrismaModule } from "../../prisma/prisma.module.js";
import { RbacModule } from "../rbac/rbac.module.js";

import { AuthController } from "./auth.controller.js";
import { RootUsersController } from "./root-users.controller.js";
import { AuthService } from "./auth.service.js";
import { CryptoService } from "./services/crypto.service.js";
import { EmailService } from "./services/email.service.js";
import { TaskScheduleService } from "./services/task-schedule.service.js";
import { TokenService } from "./services/token.service.js";

@Module({
	imports: [PrismaModule, JwtModule.register({ global: true }), RbacModule],
	controllers: [AuthController, RootUsersController],
	providers: [
		AuthService,
		TokenService,
		CryptoService,
		CookieConfigService,
		TypedConfigService,
		LogService,
		EmailService,
		TaskScheduleService,
		AuthGuard,
		SuperAdminGuard,
		RefreshTokenGuard,
		SetAuthCookiesInterceptor,
		ClearAuthCookiesInterceptor,
	],
	exports: [
		AuthService,
		TokenService,
		CryptoService,
		EmailService,
		AuthGuard,
		SuperAdminGuard,
		RefreshTokenGuard,
		SetAuthCookiesInterceptor,
		ClearAuthCookiesInterceptor,
		TypedConfigService,
		CookieConfigService,
		LogService,
	],
})
export class AuthModule {}
