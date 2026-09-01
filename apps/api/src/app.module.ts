import { MiddlewareConsumer, Module, type DynamicModule, type NestApplicationOptions, type NestModule } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";

import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import { PerformanceInterceptor } from "./common/interceptors/performance.interceptor";
import { CorrelationIdMiddleware } from "./common/middleware/correlation-id.middleware";
import { ConfigModule } from "./config/config.module";
import { AuthorizationAdminModule } from "./modules/authorization/admin/authorization-admin.module";
import { AuthorizationModule } from "./modules/authorization/authorization.module";
import { AuthorizationGuard } from "./modules/authorization/guards/authorization.guard";
import { AuthModule } from "./modules/auth/auth.module";
import { AuthGuard } from "./modules/auth/guards/auth.guard";
import { GeoModule } from "./modules/geo/geo.module";
import { HealthModule } from "./modules/health/health.module";
import { ImpersonationModule } from "./modules/impersonation/impersonation.module";
import { LogsModule } from "./modules/logs/logs.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { RewardsModule } from "./modules/rewards/rewards.module";

import { SessionsModule } from "./modules/sessions/sessions.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RlsInterceptor } from "./common/interceptors/rls.interceptor";

// ── Optional ObserveModule (ESM-compatible dynamic import) ──────────────────
// Loaded only when OBSERVE_ENABLED=1 and credentials are set. Off by default in
// dev — instrumentation + the agent worker add measurable boot overhead.
const observeAppKey: string | undefined = process.env.OBSERVE_APP_KEY;
const observeAppSecret: string | undefined = process.env.OBSERVE_APP_SECRET;
const observeEnabled: boolean = Boolean(observeAppKey && observeAppSecret) && (process.env.NODE_ENV === "production" || process.env.OBSERVE_ENABLED === "1");

let observeImports: DynamicModule[] = [];
export let ObserveInstrument: NestApplicationOptions["instrument"] | undefined = undefined;

if (observeEnabled && observeAppKey !== undefined && observeAppSecret !== undefined) {
	const { bootstrapObserve } = await import("./observe.bootstrap");
	const observeBootstrap = bootstrapObserve({
		appKey: observeAppKey,
		appSecret: observeAppSecret,
		serviceId: process.env.OBSERVE_SERVICE_ID ?? "freebuff-api",
	});
	observeImports = observeBootstrap.imports;
	ObserveInstrument = observeBootstrap.instrument;
}

@Module({
	imports: [
		ConfigModule,
		PrismaModule,
		AuthorizationModule,
		AuthorizationAdminModule,

		ScheduleModule.forRoot(),
		LogsModule,
		HealthModule,
		AuthModule,
		SessionsModule,
		ImpersonationModule,
		NotificationsModule,
		GeoModule,
		RewardsModule,
		// Conditionally include ObserveModule
		...observeImports,
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
		{
			provide: APP_INTERCEPTOR,
			useClass: PerformanceInterceptor,
		},
		// AuthGuard first (attach `request.user`), then AuthorizationGuard
		// (evaluates @RequirePermission, @RequireAllPermissions, @RequireAnyPermission,
		// @RequireAllRoles, @RequireAnyRole).
		{
			provide: APP_GUARD,
			useClass: AuthGuard,
		},
		{
			provide: APP_GUARD,
			useClass: AuthorizationGuard,
		},
	],
})
export class AppModule implements NestModule {
	public configure(consumer: MiddlewareConsumer): void {
		consumer.apply(CorrelationIdMiddleware).forRoutes("*");
	}
}
