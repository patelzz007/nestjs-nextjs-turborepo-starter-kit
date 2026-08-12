import { DynamicModule, Module, type Provider, type Type } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";

import type { TelescopeOptions } from "@workspace/shared";

import { resolveTelescopeOptions, TELESCOPE_OPTIONS, TELESCOPE_STORE, warnUnsupportedStorage } from "./telescope.options.js";
import { TelescopeAdminGuard } from "./telescope-admin.guard.js";
import { TelescopeController } from "./telescope.controller.js";
import { TelescopeInterceptor } from "./telescope.interceptor.js";
import { TelescopePrismaListener } from "./telescope-prisma-listener.js";
import { TelescopeService } from "./telescope.service.js";
import { TelescopeMemoryStore } from "./telescope.store.js";

/**
 * The one config surface (docs/telescope.md §3): `TelescopeModule.register()`
 * resolves options (env wins), builds the store, and wires capture.
 *
 * When disabled (fail-closed in production), the module still provides the
 * store + options so the capture middleware can resolve — but registers no
 * controller, no interceptor, and no Prisma listener, so nothing is captured
 * and `/telescope/*` does not exist.
 */
@Module({})
export class TelescopeModule {
	public static register(provided: Partial<TelescopeOptions>): DynamicModule {
		const resolved: TelescopeOptions = resolveTelescopeOptions(provided);
		warnUnsupportedStorage(resolved.storage);

		const store: TelescopeMemoryStore = new TelescopeMemoryStore(resolved.maxRequests);

		const providers: Provider[] = [
			{ provide: TELESCOPE_OPTIONS, useValue: resolved },
			{ provide: TELESCOPE_STORE, useValue: store },
		];

		const controllers: Type<TelescopeController>[] = [];

		if (resolved.enabled) {
			providers.push(
				TelescopePrismaListener,
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
			exports: [TELESCOPE_OPTIONS, TELESCOPE_STORE],
		};
	}
}
