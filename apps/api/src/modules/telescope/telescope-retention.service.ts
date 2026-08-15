import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";

import type { TelescopeOptions } from "@workspace/shared";

import { TELESCOPE_OPTIONS, TELESCOPE_STORE } from "./telescope.options";
import type { TelescopeStore } from "./telescope.store";

/**
 * Improvement 4 — retention pruning on a fixed interval (every 5 minutes).
 * Uses `setInterval` instead of `@nestjs/schedule` so the module has zero
 * extra wiring (the ScheduleModule is not registered app-wide). Works for
 * both stores: memory prunes the buffer, Postgres prunes buffer + DB.
 */
@Injectable()
export class TelescopeRetentionService implements OnModuleInit, OnModuleDestroy {
	private readonly intervalMs: number = 5 * 60 * 1000;
	/** First prune is deferred until shortly after boot so the store can hydrate. */
	private readonly firstPruneDelayMs: number = 60 * 1000;

	private timer: NodeJS.Timeout | undefined;
	private bootTimeout: NodeJS.Timeout | undefined;

	public constructor(
		@Inject(TELESCOPE_OPTIONS) private readonly options: TelescopeOptions,
		@Inject(TELESCOPE_STORE) private readonly store: TelescopeStore,
	) {}

	public onModuleInit(): void {
		// Fail-closed: no timers at all while Telescope is disabled.
		if (!this.options.enabled) {
			return;
		}
		this.bootTimeout = setTimeout((): void => {
			this.prune();
		}, this.firstPruneDelayMs);
		this.timer = setInterval((): void => {
			this.prune();
		}, this.intervalMs);
	}

	public onModuleDestroy(): void {
		if (this.timer !== undefined) {
			clearInterval(this.timer);
			this.timer = undefined;
		}
		if (this.bootTimeout !== undefined) {
			clearTimeout(this.bootTimeout);
			this.bootTimeout = undefined;
		}
	}

	private prune(): void {
		const removed: number = this.store.pruneRetention(this.options.retentionMinutes);
		if (removed > 0) {
			console.warn(`[Telescope] retention pruned ${String(removed)} entries (${String(this.options.retentionMinutes)}m window)`);
		}
	}
}
