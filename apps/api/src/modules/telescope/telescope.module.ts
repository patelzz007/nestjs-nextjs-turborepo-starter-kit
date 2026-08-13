import { DynamicModule, Global, Module, type Provider, type Type } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";

import type { TelescopeOptions } from "@workspace/shared";

import { resolveTelescopeOptions, TELESCOPE_OPTIONS, TELESCOPE_STORE } from "./telescope.options.js";
import { TelescopeAdminGuard } from "./telescope-admin.guard.js";
import { TelescopeAlertService } from "./telescope-alert.service.js";
import { TelescopeCacheTracer } from "./telescope-cache-tracer.js";
import { TelescopeConsoleCapture } from "./telescope-console-capture.js";
import { TelescopeDemoService } from "./telescope-demo.service.js";
import { TelescopeController } from "./telescope.controller.js";
import { TelescopeEventBus } from "./telescope-event-bus.js";
import { TelescopeInterceptor } from "./telescope.interceptor.js";
import { TelescopeJobRunner } from "./telescope-job-runner.js";
import { TelescopePrismaListener } from "./telescope-prisma-listener.js";
import { TelescopePostgresStore } from "./telescope-postgres.store.js";
import { TelescopeRetentionService } from "./telescope-retention.service.js";
import { TelescopeSchedulerService } from "./telescope-scheduler.js";
import { TelescopeService } from "./telescope.service.js";
import { TelescopeMemoryStore } from "./telescope.store.js";

/**
 * The one config surface (docs/telescope.md §3): `TelescopeModule.register()`
 * resolves options (env wins), builds the store (memory or Postgres —
 * improvement 1), and wires capture.
 *
 * When disabled (fail-closed in production), the module still provides the
 * store + options so the capture middleware can resolve — but registers no
 * controller, no interceptor, and no Prisma listener, so nothing is captured
 * and `/telescope/*` does not exist.
 */
@Global()
@Module({})
export class TelescopeModule {
	public static register(provided: Partial<TelescopeOptions>): DynamicModule {
		const resolved: TelescopeOptions = resolveTelescopeOptions(provided);

		const providers: Provider[] = [
			{ provide: TELESCOPE_OPTIONS, useValue: resolved },
			// The store is a drop-in behind the token: memory = plain instance,
			// postgres = an injectable class that hydrates from the DB at boot.
			...(resolved.storage === "postgres"
				? [TelescopePostgresStore, { provide: TELESCOPE_STORE, useExisting: TelescopePostgresStore }]
				: [{ provide: TELESCOPE_STORE, useValue: new TelescopeMemoryStore(resolved.maxRequests) }]),
		];

		const controllers: Type<TelescopeController>[] = [];

		if (resolved.enabled) {
			providers.push(
				TelescopeEventBus,
				TelescopeConsoleCapture,
				TelescopeRetentionService,
				TelescopePrismaListener,
				// Feature surfaces (3/4/5/7/18): job runner, scheduler, cache tracer,
				// alert service — registered alongside the capture pipeline. The
				// demo service is dev-only sugar so the jobs/schedules pages have
				// data out of the box (fail-closed in production).
				TelescopeJobRunner,
				TelescopeSchedulerService,
				TelescopeCacheTracer,
				TelescopeAlertService,
				TelescopeDemoService,
				TelescopeService,
				TelescopeAdminGuard,
				{
					provide: APP_INTERCEPTOR,
					useClass: TelescopeInterceptor,
				},
			);
			controllers.push(TelescopeController);
		}

		return {
			module: TelescopeModule,
			providers,
			controllers,
			exports: [TELESCOPE_OPTIONS, TELESCOPE_STORE, TelescopeJobRunner, TelescopeSchedulerService, TelescopeCacheTracer, TelescopeAlertService, TelescopeDemoService],
		};
	}
}
