import { MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";

import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import { CorrelationIdMiddleware } from "./common/middleware/correlation-id.middleware";
import { ConfigModule } from "./config/config.module";
import { AuthModule } from "./modules/auth/auth.module";
import { AuthGuard } from "./modules/auth/guards/auth.guard";
import { BackupModule } from "./modules/backup/backup.module";
import { HealthModule } from "./modules/health/health.module";
import { ImpersonationModule } from "./modules/impersonation/impersonation.module";
import { LogsModule } from "./modules/logs/logs.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { PermissionGuard } from "./modules/rbac/permission.guard";
import { RbacModule } from "./modules/rbac/rbac.module";
import { SessionsModule } from "./modules/sessions/sessions.module";
import { TelescopeCaptureMiddleware } from "./modules/telescope/telescope-capture.middleware";
import { TelescopeAuthJobAdapter } from "./modules/telescope/telescope-auth-job-adapter";
import { TelescopeEmailJobAdapter } from "./modules/telescope/telescope-email-job-adapter";
import { TelescopeImpersonationJobAdapter } from "./modules/telescope/telescope-impersonation-job-adapter";
import { TelescopeSessionsJobAdapter } from "./modules/telescope/telescope-sessions-job-adapter";
import { TelescopeModule } from "./modules/telescope/telescope.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RlsInterceptor } from "./common/interceptors/rls.interceptor";

@Module({
	imports: [
		ConfigModule,
		PrismaModule,
		RbacModule,
		ScheduleModule.forRoot(),
		LogsModule,
		HealthModule,
		AuthModule,
		SessionsModule,
		ImpersonationModule,
		NotificationsModule,
		TelescopeModule,
		BackupModule,
	],
	providers: [
		{
			provide: APP_INTERCEPTOR,
			useClass: RlsInterceptor,
		},
		{
			provide: APP_INTERCEPTOR,
			useClass: ResponseInterceptor,
		},
		// AuthGuard first (attach `request.user`), then PermissionGuard (`@RequirePermission`).
		{
			provide: APP_GUARD,
			useClass: AuthGuard,
		},
		{
			provide: APP_GUARD,
			useClass: PermissionGuard,
		},
		// Telescope's auto-capture job adapters observe their module's domain
		// event streams and record real work as jobs — auth flows, impersonation
		// actions, email sends. They sit in AppModule because each needs exports
		// from BOTH the @Global() TelescopeModule and a (non-global) business
		// module — a global module cannot reliably inject from a module it merely
		// imports (Nest creates all module providers in parallel, so the imported
		// module's exports may not be resolved yet). This keeps business modules
		// free of telescope references.
		TelescopeEmailJobAdapter,
		TelescopeAuthJobAdapter,
		TelescopeImpersonationJobAdapter,
		TelescopeSessionsJobAdapter,
	],
})
export class AppModule implements NestModule {
	public configure(consumer: MiddlewareConsumer): void {
		// CorrelationId first (stamps req.correlationId), then the telescope
		// capture middleware (opens the ALS scope using that correlation id).
		consumer.apply(CorrelationIdMiddleware, TelescopeCaptureMiddleware).forRoutes("*");
	}
}
