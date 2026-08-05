import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { CookieConfigService } from "../../common/constants/cookie.config.js";
import { AuthGuard } from "../../common/guards/auth.guard.js";
import { RefreshTokenGuard } from "../../common/guards/refresh-token.guard.js";
import { SuperAdminGuard } from "../../common/guards/super-admin.guard.js";
import { ClearAuthCookiesInterceptor } from "../../common/interceptors/clear-auth-cookies.interceptor.js";
import { SetAuthCookiesInterceptor } from "../../common/interceptors/set-auth-cookies.interceptor.js";
import { TypedConfigService } from "../../config/typed-config.service.js";
import { LogService } from "../../modules/logs/logs.service.js";
import { PrismaModule } from "../../prisma/prisma.module.js";
import { RbacModule } from "../rbac/rbac.module.js";

import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { CryptoService } from "./services/crypto.service.js";
import { EmailService } from "./services/email.service.js";
import { TaskScheduleService } from "./services/task-schedule.service.js";
import { TokenService } from "./services/token.service.js";

@Module({
	imports: [PrismaModule, JwtModule.register({ global: true }), RbacModule],
	controllers: [AuthController],
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
	exports: [AuthService, TokenService, CryptoService, EmailService, AuthGuard, SuperAdminGuard, RefreshTokenGuard],
})
export class AuthModule {}
