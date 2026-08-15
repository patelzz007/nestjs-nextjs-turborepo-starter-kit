import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { CookieConfigService } from "./constants/cookie.config";
import { AuthGuard } from "./guards/auth.guard";
import { RefreshTokenGuard } from "./guards/refresh-token.guard";
import { SuperAdminGuard } from "./guards/super-admin.guard";
import { ClearAuthCookiesInterceptor } from "./interceptors/clear-auth-cookies.interceptor";
import { SetAuthCookiesInterceptor } from "./interceptors/set-auth-cookies.interceptor";
import { PrismaModule } from "../../prisma/prisma.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { RbacModule } from "../rbac/rbac.module";

import { AuthController } from "./auth.controller";
import { RootUsersController } from "./root-users.controller";
import { AuthService } from "./auth.service";
import { AuthEventsService } from "./services/auth-events.service";
import { CryptoService } from "./services/crypto.service";
import { EmailService } from "./services/email.service";
import { TaskScheduleService } from "./services/task-schedule.service";
import { TokenService } from "./services/token.service";

@Module({
	imports: [PrismaModule, JwtModule.register({ global: true }), RbacModule, NotificationsModule],
	controllers: [AuthController, RootUsersController],
	providers: [
		AuthService,
		AuthEventsService,
		TokenService,
		CryptoService,
		CookieConfigService,
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
		// AuthEventsService is exported for Telescope's auth-job adapter
		AuthEventsService,
		TokenService,
		CryptoService,
		EmailService,
		AuthGuard,
		SuperAdminGuard,
		RefreshTokenGuard,
		SetAuthCookiesInterceptor,
		ClearAuthCookiesInterceptor,
		CookieConfigService,
	],
})
export class AuthModule {}
