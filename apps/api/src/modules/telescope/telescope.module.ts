import { Global, Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";

import type { TelescopeOptions, TelescopeStorage } from "@workspace/shared";

import { PrismaModule } from "../../prisma/prisma.module";

import { resolveTelescopeOptions, TELESCOPE_OPTIONS, TELESCOPE_STORE } from "./telescope.options";
import { TelescopeAdminGuard } from "./telescope-admin.guard";
import { TelescopeAlertService } from "./telescope-alert.service";
import { TelescopeCacheTracer } from "./telescope-cache-tracer";
import { TelescopeConsoleCapture } from "./telescope-console-capture";
import { TelescopeController } from "./telescope.controller";
import { TelescopeDemoService } from "./telescope-demo.service";
import { TelescopeEventBus } from "./telescope-event-bus";
import { TelescopeInterceptor } from "./telescope.interceptor";
import { TelescopeJobRunner } from "./telescope-job-runner";
import { TelescopePrismaListener } from "./telescope-prisma-listener";
import { TelescopePostgresStore } from "./telescope-postgres.store";
import { TelescopeReplayService } from "./telescope-replay.service";
import { TelescopeRetentionService } from "./telescope-retention.service";
import { TelescopeSchedulerService } from "./telescope-scheduler";
import { TelescopeService } from "./telescope.service";
import { TelescopeMemoryStore, type TelescopeStore } from "./telescope.store";

/**
 * The one config surface (docs/telescope.md §3): options are resolved from
 * env (`TELESCOPE_*`) at module init — `TELESCOPE_ENABLED`/`NODE_ENV` decide
 * whether capture runs, `TELESCOPE_MODE` picks the store backend.
 *
 * This is a plain static `@Global()` module (same pattern as ConfigModule,
 * PrismaModule and LogsModule): any module can inject `TelescopeJobRunner`,
 * `TelescopeSchedulerService`, `TELESCOPE_STORE`, … without importing it or
 * listing providers. All capture components are registered unconditionally and
 * self-guard on the resolved options at runtime, so the fail-closed semantics
 * are preserved: when disabled, the middleware never opens a captured span
 * store (the interceptor + Prisma listener + console capture become no-ops),
 * the demo service stays silent, and `/telescope/*` returns 404 via the guard.
 */
@Global()
@Module({
	imports: [PrismaModule],
	providers: [
		// Env-driven options — capture code never touches process.env directly.
		{ provide: TELESCOPE_OPTIONS, useFactory: (): TelescopeOptions => resolveTelescopeOptions({}) },
		TelescopeEventBus,
		TelescopeConsoleCapture,
		TelescopeRetentionService,
		TelescopePrismaListener,
		// Feature surfaces (3/4/5/7/18): job runner, scheduler, cache tracer,
		// alert service — registered alongside the capture pipeline.
		TelescopeJobRunner,
		TelescopeSchedulerService,
		TelescopeCacheTracer,
		TelescopeAlertService,
		TelescopeReplayService,
		// The demo service is dev-only sugar so the jobs/schedules pages have
		// data out of the box (self-guards on `options.enabled` — silent in
		// production). The email-job adapter (TelescopeEmailJobAdapter) is wired
		// in AppModule — it observes NotificationsModule's event stream, so it
		// lives where both modules' exports are visible.
		TelescopeDemoService,
		// The store is a drop-in behind the token: memory = plain instance,
		// postgres = the injectable class (its onModuleInit hydrates from the
		// DB at boot, and no-ops unless TELESCOPE_MODE=postgres).
		TelescopePostgresStore,
		{
			provide: TELESCOPE_STORE,
			inject: [TELESCOPE_OPTIONS, TelescopePostgresStore],
			useFactory: (options: TelescopeOptions, postgresStore: TelescopePostgresStore): TelescopeStore => {
				const storage: TelescopeStorage = options.storage;
				return storage === "postgres" ? postgresStore : new TelescopeMemoryStore(options.maxRequests);
			},
		},
		TelescopeService,
		TelescopeAdminGuard,
		{
			provide: APP_INTERCEPTOR,
			useClass: TelescopeInterceptor,
		},
	],
	controllers: [TelescopeController],
	exports: [
		TELESCOPE_OPTIONS,
		TELESCOPE_STORE,
		TelescopeEventBus,
		TelescopeJobRunner,
		TelescopeSchedulerService,
		TelescopeCacheTracer,
		TelescopeAlertService,
		TelescopeDemoService,
	],
})
export class TelescopeModule {}
