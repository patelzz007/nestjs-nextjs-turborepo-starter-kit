import type { Clock } from "../../../../platform/application/clock.port";
import type { FlagCatalogSource } from "../ports/flag-catalog.port";
import type { FlagMaintenanceStore } from "../ports/flag-maintenance.store";

/** How far back a run looks for scheduled steps: twice the job's period, so a late run misses none. */
export const SCHEDULE_LOOKBACK_MS = 120_000;

export interface MaintenanceOutcome {
	readonly expired: number;
	readonly version: number | null;
}

/**
 * The every-minute job (ADR 087): pending revisions past their week expire, and when a scheduled rollout reaches a
 * step the catalogue version rises, so live streams tell clients to refetch (the share itself is worked out from
 * the clock at evaluation, so a missed run never leaves a rollout stuck; clients also refetch at `nextChangeAt`).
 */
export class FlagMaintenanceService {
	public constructor(
		private readonly store: FlagMaintenanceStore,
		private readonly catalog: FlagCatalogSource,
		private readonly clock: Clock,
	) {}

	public async run(): Promise<MaintenanceOutcome> {
		const now = this.clock.now();
		const expired = await this.store.expirePending(now);
		const version = await this.store.bumpForStepsBetween(now - SCHEDULE_LOOKBACK_MS, now);
		if (version !== null) {
			await this.catalog.changed(version);
		}
		return { expired, version };
	}
}
