import { MiddlewareConsumer, Module, type DynamicModule, type NestApplicationOptions, type NestModule } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";

import { GlobalExceptionFilter } from "./common/errors/global-exception.filter";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import { PerformanceInterceptor } from "./common/interceptors/performance.interceptor";
import { RequestContextModule } from "./common/context/request-context.module";
import { RequestContextMiddleware } from "./common/middleware/request-context.middleware";
import { RlsPreHandlerMiddleware } from "./common/middleware/rls-pre-handler.middleware";
import { getApiConfig } from "./config/api-config";
import type { ObserveConfig } from "./config/api-config.schema";
import { ConfigModule } from "./config/config.module";
import { JobsModule } from "./infrastructure/jobs/jobs.module";
import { OutboxModule } from "./infrastructure/outbox/outbox.module";
import { AppMessagingModule } from "./messaging/app-messaging.module";
import { AuthorizationAdminModule } from "./modules/authorization/admin/authorization-admin.module";
import { AuthorizationModule } from "./modules/authorization/authorization.module";
import { AuthorizationGuard } from "./modules/authorization/guards/authorization.guard";
import { ApiKeysModule } from "./modules/api-keys/api-keys.module";
import { ApiKeyAuthGuard } from "./modules/api-keys/guards/api-key-auth.guard";
import { AuthModule } from "./modules/auth/auth.module";
import { AuthGuard } from "./modules/auth/guards/auth.guard";
import { RestrictedSessionGuard } from "./modules/auth/guards/restricted-session.guard";
import { GeoModule } from "./modules/geo/geo.module";
import { HealthModule } from "./modules/health/health.module";
import { ImpersonationModule } from "./modules/impersonation/impersonation.module";
import { LogsModule } from "./modules/logs/logs.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { PlatformResourceModule } from "./platform/platform-resource.module";
import { FilesModule } from "./modules/files/files.module";
import { StorageModule } from "./modules/storage/storage.module";
import { AuthorizationCedarModule } from "./modules/authorization-cedar/authorization-cedar.module";
import { EncryptionModule } from "./modules/encryption/encryption.module";
import { OrganizationModule } from "./modules/organization/organization.module";
import { RewardsModule } from "./modules/rewards/rewards.module";
import { SupportAccessModule } from "./modules/support-access/support-access.module";
import { ProductModule } from "./modules/product/product.module";
import { SampleCategoryModule } from "./modules/sample-category/sample-category.module";

import { SessionsModule } from "./modules/sessions/sessions.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RlsInterceptor } from "./common/interceptors/rls.interceptor";

// ── Optional ObserveModule (ESM-compatible dynamic import) ──────────────────
// Loaded only when the validated config enables it (OBSERVE_ENABLED=1, or
// production, with credentials set). Off by default in dev — instrumentation +
// the agent worker add measurable boot overhead. The config was already
// parsed (and validated) by main.ts before this module was imported.
const observeConfig: ObserveConfig | null = getApiConfig().observability.observe;

let observeImports: DynamicModule[] = [];
export let ObserveInstrument: NestApplicationOptions["instrument"] | undefined = undefined;

if (observeConfig !== null) {
	const { bootstrapObserve } = await import("./observe.bootstrap");
	const observeBootstrap = bootstrapObserve(observeConfig);
	observeImports = observeBootstrap.imports;
	ObserveInstrument = observeBootstrap.instrument;
}

@Module({
	imports: [
		ConfigModule,
		RequestContextModule,
		AppMessagingModule.register(),
		PrismaModule,
		JobsModule,
		OutboxModule,
		AuthorizationModule,
		AuthorizationAdminModule,
		ScheduleModule.forRoot(),
		LogsModule,
		HealthModule,
		ApiKeysModule,
		AuthModule,
		SessionsModule,
		ImpersonationModule,
		NotificationsModule,
		GeoModule,
		PlatformResourceModule,
		StorageModule,
		FilesModule,
		AuthorizationCedarModule,
		OrganizationModule,
		SupportAccessModule,
		EncryptionModule,
		RewardsModule,
		ProductModule,
		SampleCategoryModule,
		// Conditionally include ObserveModule
		...observeImports,
	],
	providers: [
		// One error envelope for every failure — docs/error-model.md, ADR 016.
		{
			provide: APP_FILTER,
			useClass: GlobalExceptionFilter,
		},
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
		// ApiKeyAuthGuard first (optional API key on @AllowApiKeyAuth routes),
		// then AuthGuard (JWT), then AuthorizationGuard.
		{
			provide: APP_GUARD,
			useClass: ApiKeyAuthGuard,
		},
		{
			provide: APP_GUARD,
			useClass: AuthGuard,
		},
		{
			provide: APP_GUARD,
			useClass: RestrictedSessionGuard,
		},
		{
			provide: APP_GUARD,
			useClass: AuthorizationGuard,
		},
	],
})
export class AppModule implements NestModule {
	public configure(consumer: MiddlewareConsumer): void {
		// Request context first (ADR 017): everything after it — including the
		// RLS pre-handler scope and every guard — runs inside it.
		consumer.apply(RequestContextMiddleware, RlsPreHandlerMiddleware).forRoutes("*");
	}
}
