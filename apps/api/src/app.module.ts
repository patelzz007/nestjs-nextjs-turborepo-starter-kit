import { MiddlewareConsumer, Module, type DynamicModule, type NestApplicationOptions, type NestModule } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";

import { GlobalExceptionFilter } from "./platform/presentation/http/errors/global-exception.filter";
import { ResponseInterceptor } from "./platform/presentation/http/interceptors/response.interceptor";
import { PerformanceInterceptor } from "./platform/presentation/http/interceptors/performance.interceptor";
import { RequestContextModule } from "./platform/infrastructure/context/request-context.module";
import { ActorContextSecurityModule } from "./platform/presentation/http/security/actor-context-security.module";
import { HttpSecurityModule } from "./platform/presentation/http/security/http-security.module";
import { SystemCommandModule } from "./platform/infrastructure/system-command.module";
import { RequestContextMiddleware } from "./platform/presentation/http/middleware/request-context.middleware";
import { getApiConfig } from "./config/api-config";
import type { ObserveConfig } from "./config/api-config.schema";
import { ConfigModule } from "./config/config.module";
import { JobsModule } from "./platform/infrastructure/jobs/jobs.module";
import { MaintenanceSchedulerModule } from "./platform/infrastructure/jobs/maintenance-scheduler.module";
import { OutboxModule } from "./platform/infrastructure/outbox/outbox.module";
import { AppMessagingModule } from "./platform/infrastructure/messaging/app-messaging.module";
import { AuthorizationHttpModule } from "./contexts/authorization/presentation/http/authorization-http.module";
import { AuditModule } from "./contexts/audit/public-api";
import { AuthorizationModule } from "./contexts/authorization/public-api";
import { APP_GUARD_ORDER } from "./platform/presentation/http/security/app-guard-order";
import { ThrottlingModule } from "./platform/presentation/http/security/throttling/throttling.module";
import { PosAccessModule } from "./contexts/pos/public-api";
import { PosModule } from "./contexts/pos/pos.module";
import { IdentityModule } from "./contexts/identity/identity.module";
import { ReferenceDataModule } from "./contexts/reference-data/public-api";
import { GithubModule } from "./contexts/integrations-github/public-api";
import { HealthModule } from "./platform/presentation/http/health/health.module";
import { LogsModule } from "./platform/infrastructure/logging/logs.module";
import { NotificationsModule } from "./contexts/notifications/public-api";
import { AuditLogInterceptor } from "./platform/infrastructure/audit/audit-log.interceptor";
import { AuditLogModule } from "./platform/infrastructure/audit/audit-log.module";
import { IdempotencyInterceptor } from "./platform/infrastructure/idempotency/idempotency.interceptor";
import { IdempotencyModule } from "./platform/infrastructure/idempotency/idempotency.module";
import { FilesModule } from "./contexts/files/public-api";
import { StorageModule } from "./platform/infrastructure/storage/storage.module";
import { EncryptionModule } from "./platform/infrastructure/encryption/encryption.module";
import { TenantsModule } from "./contexts/tenancy/tenants.module";
import { ReferralsModule } from "./contexts/referrals/public-api";
import { RewardsAccessModule, RewardsModule } from "./contexts/rewards/public-api";
import { ClaimsModule } from "./contexts/claims/claims.module";
import { CatalogModule } from "./contexts/catalog/public-api";
import { KanbanModule } from "./contexts/kanban/public-api";
import { OperationsModule } from "./contexts/operations/public-api";
import { ReportingModule } from "./contexts/reporting/public-api";

import { PrismaModule } from "./prisma/prisma.module";
import { RlsInterceptor } from "./platform/presentation/http/interceptors/rls.interceptor";
import { TenancyModule } from "./platform/infrastructure/tenancy/tenancy.module";

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
		CqrsModule.forRoot(),
		ConfigModule,
		RequestContextModule,
		ActorContextSecurityModule,
		HttpSecurityModule,
		SystemCommandModule,
		AppMessagingModule.register(),
		PrismaModule,
		TenancyModule,
		JobsModule,
		MaintenanceSchedulerModule,
		OutboxModule,
		AuthorizationModule,
		AuthorizationHttpModule,
		AuditModule,
		ScheduleModule.forRoot(),
		LogsModule,
		HealthModule,
		PosAccessModule,
		RewardsAccessModule,
		ThrottlingModule,
		IdentityModule,
		ReferralsModule,
		NotificationsModule,
		ReferenceDataModule,
		GithubModule,
		AuditLogModule,
		IdempotencyModule.register(),
		StorageModule,
		FilesModule,
		TenantsModule,
		EncryptionModule,
		RewardsModule,
		ClaimsModule,
		PosModule,
		CatalogModule,
		KanbanModule,
		ReportingModule,
		OperationsModule,
		// Conditionally include ObserveModule
		...observeImports,
	],
	providers: [
		// One error envelope for every failure — docs/technical/api/errors.md, ADR 016.
		{
			provide: APP_FILTER,
			useClass: GlobalExceptionFilter,
		},
		// Global interceptors run in this order (outermost first):
		//   RLS scope → audit trail → Idempotency-Key → response contract/envelope → timing.
		// The audit and idempotency interceptors sit OUTSIDE the response
		// interceptor so they see (and store) the exact wire body; an idempotent
		// replay is audited like any other request.
		{
			provide: APP_INTERCEPTOR,
			useClass: RlsInterceptor,
		},
		{
			provide: APP_INTERCEPTOR,
			useClass: AuditLogInterceptor,
		},
		{
			provide: APP_INTERCEPTOR,
			useClass: IdempotencyInterceptor,
		},
		{
			provide: APP_INTERCEPTOR,
			useClass: ResponseInterceptor,
		},
		{
			provide: APP_INTERCEPTOR,
			useClass: PerformanceInterceptor,
		},
		// Order is APP_GUARD_ORDER: outdated app, pre-auth IP throttler, optional API key, JWT, principal throttlers, restricted session, authorization.
		...APP_GUARD_ORDER.map((guard) => ({
			provide: APP_GUARD,
			useClass: guard,
		})),
	],
})
export class AppModule implements NestModule {
	public configure(consumer: MiddlewareConsumer): void {
		// Request context first (ADR 017): every guard and the handler run inside it.
		// Guards open their own auth lookups. There is no request-wide table bypass.
		consumer.apply(RequestContextMiddleware).forRoutes("*");
	}
}
