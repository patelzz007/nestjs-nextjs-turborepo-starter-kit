import { MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";

import { ResponseInterceptor } from "./common/interceptors/response.interceptor.js";
import { CorrelationIdMiddleware } from "./common/middleware/correlation-id.middleware.js";
import { ConfigModule } from "./config/config.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { AuthGuard } from "./modules/auth/guards/auth.guard.js";
import { HealthModule } from "./modules/health/health.module.js";
import { ImpersonationModule } from "./modules/impersonation/impersonation.module.js";
import { LogsModule } from "./modules/logs/logs.module.js";
import { NotificationsModule } from "./modules/notifications/notifications.module.js";
import { SessionsModule } from "./modules/sessions/sessions.module.js";
import { TelescopeCaptureMiddleware } from "./modules/telescope/telescope-capture.middleware.js";
import { TelescopeAuthJobAdapter } from "./modules/telescope/telescope-auth-job-adapter.js";
import { TelescopeEmailJobAdapter } from "./modules/telescope/telescope-email-job-adapter.js";
import { TelescopeImpersonationJobAdapter } from "./modules/telescope/telescope-impersonation-job-adapter.js";
import { TelescopeSessionsJobAdapter } from "./modules/telescope/telescope-sessions-job-adapter.js";
import { TelescopeModule } from "./modules/telescope/telescope.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";

@Module({
	imports: [ConfigModule, PrismaModule, LogsModule, HealthModule, AuthModule, SessionsModule, ImpersonationModule, NotificationsModule, TelescopeModule],
	providers: [
		{
			provide: APP_INTERCEPTOR,
			useClass: ResponseInterceptor,
		},
		{
			provide: APP_GUARD,
			useClass: AuthGuard,
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
