import { epochMs } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { systemActor } from "../../../../platform/application/actor-context";
import type { Clock } from "../../../../platform/application/clock.port";
import { RECORD_RETENTION_MS } from "../../../../platform/domain/record-retention";
import { PurgeExpiredAuditRecordsCommand } from "../commands/purge-expired-audit-records/purge-expired-audit-records.command";
import { AUDIT_RETENTION_BATCH_SIZE, PurgeExpiredAuditRecordsHandler } from "../commands/purge-expired-audit-records/purge-expired-audit-records.handler";
import type { AuditRetentionCount, AuditRetentionPort, AuditRetentionRunRecord, AuditRetentionTarget } from "../ports/audit-retention.port";

const NOW = 1_793_664_000_000;
const ACTOR = systemActor("maintenance.audit_record_retention", "cron", null, "test", null);

/** A store holding `eligible` rows per target, deleting them in batches; `failOn` throws on that target. */
class ScriptedRetention implements AuditRetentionPort {
	public readonly batches: { readonly target: AuditRetentionTarget; readonly cutoff: number; readonly size: number }[] = [];
	public readonly runs: AuditRetentionRunRecord[] = [];
	private readonly remaining: Map<AuditRetentionTarget, number>;

	public constructor(
		eligible: Readonly<Record<AuditRetentionTarget, number>>,
		private readonly held: number,
		private readonly failOn: AuditRetentionTarget | null = null,
	) {
		this.remaining = new Map([
			["AUDIT_LOG", eligible.AUDIT_LOG],
			["DATA_CHANGE_LOG", eligible.DATA_CHANGE_LOG],
		]);
	}

	public count(_actor: typeof ACTOR, target: AuditRetentionTarget): Promise<AuditRetentionCount> {
		return Promise.resolve({ eligible: this.remaining.get(target) ?? 0, held: this.held });
	}

	public purgeBatch(_actor: typeof ACTOR, target: AuditRetentionTarget, cutoff: number, size: number): Promise<number> {
		if (target === this.failOn) {
			return Promise.reject(new Error("canceling statement due to statement timeout"));
		}
		this.batches.push({ target, cutoff, size });
		const left = this.remaining.get(target) ?? 0;
		const removed = Math.min(left, size);
		this.remaining.set(target, left - removed);
		return Promise.resolve(removed);
	}

	public recordRun(_actor: typeof ACTOR, run: AuditRetentionRunRecord): Promise<void> {
		this.runs.push(run);
		return Promise.resolve();
	}
}

const clock: Clock = { now: () => epochMs(NOW) };

describe("PurgeExpiredAuditRecordsHandler", () => {
	it("deletes in batches until one comes back short, with the cutoff ten years back, and records each table's run", async () => {
		const store = new ScriptedRetention({ AUDIT_LOG: AUDIT_RETENTION_BATCH_SIZE * 2 + 7, DATA_CHANGE_LOG: 0 }, 3);
		const runs = await new PurgeExpiredAuditRecordsHandler(store, clock).execute(new PurgeExpiredAuditRecordsCommand(ACTOR, false));

		expect(store.batches.filter((batch) => batch.target === "AUDIT_LOG")).toHaveLength(3);
		expect(store.batches.every((batch) => batch.cutoff === NOW - RECORD_RETENTION_MS && batch.size === AUDIT_RETENTION_BATCH_SIZE)).toBe(true);
		expect(runs.map((run) => [run.target, run.deletedCount, run.heldBackCount, run.outcome, run.dryRun])).toStrictEqual([
			["AUDIT_LOG", AUDIT_RETENTION_BATCH_SIZE * 2 + 7, 3, "COMPLETED", false],
			["DATA_CHANGE_LOG", 0, 3, "COMPLETED", false],
		]);
		expect(store.runs).toStrictEqual(runs);
	});

	it("only counts on a dry run, and deletes nothing", async () => {
		const store = new ScriptedRetention({ AUDIT_LOG: 12, DATA_CHANGE_LOG: 4 }, 1);
		const runs = await new PurgeExpiredAuditRecordsHandler(store, clock).execute(new PurgeExpiredAuditRecordsCommand(ACTOR, true));

		expect(store.batches).toStrictEqual([]);
		expect(runs.map((run) => [run.target, run.deletedCount, run.heldBackCount, run.dryRun])).toStrictEqual([
			["AUDIT_LOG", 12, 1, true],
			["DATA_CHANGE_LOG", 4, 1, true],
		]);
	});

	it("records a failed table with its reason and still runs the next one", async () => {
		const store = new ScriptedRetention({ AUDIT_LOG: 10, DATA_CHANGE_LOG: 2 }, 0, "AUDIT_LOG");
		const runs = await new PurgeExpiredAuditRecordsHandler(store, clock).execute(new PurgeExpiredAuditRecordsCommand(ACTOR, false));

		expect(runs.map((run) => [run.target, run.outcome, run.failureReason])).toStrictEqual([
			["AUDIT_LOG", "FAILED", "canceling statement due to statement timeout"],
			["DATA_CHANGE_LOG", "COMPLETED", null],
		]);
	});
});
