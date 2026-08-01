import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { CookieConfigService } from "../../common/constants/cookie.config";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RefreshTokenGuard } from "../../common/guards/refresh-token.guard";
import { SuperAdminGuard } from "../../common/guards/super-admin.guard";
import { ClearAuthCookiesInterceptor } from "../../common/interceptors/clear-auth-cookies.interceptor";
import { SetAuthCookiesInterceptor } from "../../common/interceptors/set-auth-cookies.interceptor";
import { TypedConfigService } from "../../config/typed-config.service";
import { LogService } from "../../modules/logs/logs.service";
import { PrismaModule } from "../../prisma/prisma.module";
import { RbacModule } from "../rbac/rbac.module";

import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { CryptoService } from "./services/crypto.service";
import { EmailService } from "./services/email.service";
import { TaskScheduleService } from "./services/task-schedule.service";
import { TokenService } from "./services/token.service";

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
