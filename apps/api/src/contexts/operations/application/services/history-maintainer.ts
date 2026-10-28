// ============================================
// application/services/history-maintainer.ts — hourly rollup and retention of the metric history
// ============================================
// Every hour, on ONE instance: the past hour's minute rows of every server, instance and dependency
// are rolled up into one hourly row each (idempotent: the hourly row is upserted), then rows past
// their retention are removed, and instances that crashed long ago leave the live list.

import { epochMs, OPS_HOUR_MS, OPS_HOUR_RETENTION_MS, OPS_MINUTE_RETENTION_MS, type EpochMs } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { Clock } from "../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../platform/application/unit-of-work.port";
import { bucketStartOf } from "../../domain/policies/history-window.policy";
import { rollUpDependencyPoints, rollUpInstancePoints, rollUpServerPoints } from "../../domain/policies/metric-rollup.policy";
import type { OperationsScope } from "../operations-scope";
import type { OpsLiveStore } from "../ports/ops-live-store.port";
import { OPS_HISTORY_MAINTAIN_OPERATION } from "../ports/operations.tokens";

/** An instance absent for a day is forgotten from the live list (its history stays). */
const INSTANCE_FORGET_AFTER_MS = 24 * OPS_HOUR_MS;
const MAINTAIN_JOB = "maintain";

export interface HistoryMaintenanceSummary {
	readonly hourStart: EpochMs;
	readonly rolledUp: number;
	readonly pruned: number;
	readonly forgottenInstances: number;
}

export class HistoryMaintainer {
	public constructor(
		private readonly uow: UnitOfWork<OperationsScope>,
		private readonly live: OpsLiveStore,
		private readonly clock: Clock,
		private readonly actor: ActorContext,
	) {}

	/** Rolls up the hour before the current one; `null` when another instance already did this hour. */
	public async maintain(): Promise<HistoryMaintenanceSummary | null> {
		const now: EpochMs = this.clock.now();
		const hourStart: EpochMs = epochMs(bucketStartOf(now, "HOUR") - OPS_HOUR_MS);
		if (!(await this.live.claimMinute(MAINTAIN_JOB, hourStart))) {
			return null;
		}
		const hourEnd: EpochMs = epochMs(hourStart + OPS_HOUR_MS);
		const summary = await this.uow.runSystemOperation(OPS_HISTORY_MAINTAIN_OPERATION, this.actor, async (scope) => {
			let rolledUp = 0;
			for (const [serverId, points] of await scope.history.serverMinutePointsBetween(hourStart, hourEnd)) {
				const hour = rollUpServerPoints(points, hourStart);
				if (hour !== null) {
					await scope.history.putServerPoint(serverId, "HOUR", hour);
					rolledUp += 1;
				}
			}
			for (const { identity, points } of (await scope.history.instanceMinutePointsBetween(hourStart, hourEnd)).values()) {
				const hour = rollUpInstancePoints(points, hourStart);
				if (hour !== null) {
					await scope.history.putInstancePoint(identity, "HOUR", hour);
					rolledUp += 1;
				}
			}
			for (const [dependency, points] of await scope.history.dependencyMinutePointsBetween(hourStart, hourEnd)) {
				const hour = rollUpDependencyPoints(points, hourStart);
				if (hour !== null) {
					await scope.history.putDependencyPoint(dependency, "HOUR", hour);
					rolledUp += 1;
				}
			}
			const pruned: number =
				(await scope.history.prune("MINUTE", epochMs(Math.max(0, now - OPS_MINUTE_RETENTION_MS)))) +
				(await scope.history.prune("HOUR", epochMs(Math.max(0, now - OPS_HOUR_RETENTION_MS))));
			return { rolledUp, pruned };
		});
		const forgottenInstances: number = await this.live.pruneInstances(now - INSTANCE_FORGET_AFTER_MS);
		return { hourStart, ...summary, forgottenInstances };
	}
}
