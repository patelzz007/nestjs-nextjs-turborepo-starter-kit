import { createHash } from "node:crypto";
import { Readable } from "node:stream";

import type { EpochMs } from "@workspace/shared";
import { epochMs } from "@workspace/shared";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { SystemOperationName } from "../../../../platform/application/system-operation-names";
import type { UnitOfWork } from "../../../../platform/application/unit-of-work.port";
import type { OperationsScope } from "../operations-scope";
import type { BackupStoragePort, StoredBackup } from "../ports/backup.ports";
import type { NewOpsRestoreDrill, OpsBackupRecord, OpsRestoreDrillRecord } from "../ports/operations-repositories.port";
import type { RestoreDrillChecks, RestoreDrillPort, RestoreDrillQueuePort } from "../ports/restore-drill.port";
import { RESTORE_DRILL_INTERVAL_MS, restoreDrillSlot, RestoreDrillService } from "../services/restore-drill.service";
import { FakeClock, FakeOperationsUnitOfWork, superAdminActor } from "./fakes/operations.fakes";

const NOW = Date.UTC(2026, 10, 3, 3, 0);
const BYTES = Buffer.from("PGDMP custom-format bytes");
const CHECKSUM = createHash("sha256").update(BYTES).digest("hex");
const PASSING: RestoreDrillChecks = { tablesChecked: 120, rowsRestored: 4_200, migration: "20261103083410_init", failures: [] };

function backup(overrides: Partial<OpsBackupRecord> = {}): OpsBackupRecord {
	return {
		id: "backup-1",
		status: "SUCCEEDED",
		trigger: "SCHEDULED",
		requestedByName: null,
		startedAt: epochMs(NOW - 1_000),
		finishedAt: epochMs(NOW - 500),
		sizeBytes: BYTES.length,
		checksum: CHECKSUM,
		pgDumpVersion: "18.6",
		serverVersion: "18.6",
		pinned: false,
		error: null,
		createdAt: epochMs(NOW - 2_000),
		storageContainer: "backups",
		storagePath: "2026/11/03/backup-1.dump",
		...overrides,
	};
}

interface Harness {
	readonly service: RestoreDrillService;
	readonly recorded: NewOpsRestoreDrill[];
	readonly queued: string[];
	readonly restoredBytes: Buffer[];
}

function harness(
	options: { readonly latest?: OpsBackupRecord | null; readonly stored?: Buffer | null; readonly ready?: boolean; readonly lastDrillAt?: number | null } = {},
): Harness {
	const recorded: NewOpsRestoreDrill[] = [];
	const queued: string[] = [];
	const restoredBytes: Buffer[] = [];
	const fake = new FakeOperationsUnitOfWork();
	const scope: OperationsScope = {
		...fake.scope,
		backups: { ...fake.scope.backups, latestSucceeded: (): Promise<OpsBackupRecord | null> => Promise.resolve(options.latest === undefined ? backup() : options.latest) },
		restoreDrills: {
			record: (drill: NewOpsRestoreDrill): Promise<OpsRestoreDrillRecord> => {
				recorded.push(drill);
				return Promise.resolve({ id: "drill-1", ...drill });
			},
			recent: (): Promise<readonly OpsRestoreDrillRecord[]> =>
				Promise.resolve(
					options.lastDrillAt === undefined || options.lastDrillAt === null
						? []
						: [
								{
									id: "drill-0",
									backupId: "backup-0",
									startedAt: epochMs(options.lastDrillAt),
									finishedAt: epochMs(options.lastDrillAt),
									outcome: "PASSED",
									tablesChecked: 1,
									rowsRestored: 1,
									failures: [],
									migration: null,
								},
							],
				),
		},
	};
	const uow: UnitOfWork<OperationsScope> = {
		run: <TResult>(_actor: ActorContext, work: (s: OperationsScope) => Promise<TResult>): Promise<TResult> => work(scope),
		runSystemOperation: <TResult>(_operation: SystemOperationName, _actor: ActorContext, work: (s: OperationsScope) => Promise<TResult>): Promise<TResult> => work(scope),
	};
	const storage: BackupStoragePort = {
		store: (): Promise<StoredBackup> => Promise.reject(new Error("not used")),
		open: (): Promise<Readable | null> =>
			Promise.resolve(options.stored === undefined ? Readable.from([BYTES]) : options.stored === null ? null : Readable.from([options.stored])),
		remove: (): Promise<void> => Promise.resolve(),
	};
	const drill: RestoreDrillPort = {
		availability: () => (options.ready === false ? { ready: false, reason: "not set" } : { ready: true }),
		restoreAndCheck: async (dump: Readable): Promise<RestoreDrillChecks> => {
			for await (const chunk of dump) {
				restoredBytes.push(z.instanceof(Buffer).parse(chunk));
			}
			return PASSING;
		},
	};
	const queue: RestoreDrillQueuePort = {
		enqueue: (slot: string): Promise<void> => {
			queued.push(slot);
			return Promise.resolve();
		},
	};
	const clock = new FakeClock(NOW);
	return { service: new RestoreDrillService({ uow, storage, drill, queue, clock: { now: (): EpochMs => clock.now() } }), recorded, queued, restoredBytes };
}

describe("RestoreDrillService.run", () => {
	it("restores the newest good backup, checks it and records a pass", async () => {
		const { service, recorded, restoredBytes } = harness();
		await service.run(superAdminActor());
		expect(Buffer.concat(restoredBytes)).toStrictEqual(BYTES);
		expect(recorded).toStrictEqual([
			{ backupId: "backup-1", startedAt: NOW, finishedAt: NOW, outcome: "PASSED", tablesChecked: 120, rowsRestored: 4_200, failures: [], migration: "20261103083410_init" },
		]);
	});

	it("fails a drill whose stored bytes don't match the checksum taken with the backup", async () => {
		const { service, recorded } = harness({ stored: Buffer.from("tampered bytes") });
		await service.run(superAdminActor());
		expect(recorded.at(0)?.outcome).toBe("FAILED");
		expect(recorded.at(0)?.failures.join(" ")).toMatch(/don't match the checksum/u);
	});

	it("records a failure when there's no good backup or its object is gone, and does nothing where drills aren't set up", async () => {
		const none = harness({ latest: null });
		await none.service.run(superAdminActor());
		expect(none.recorded.at(0)).toMatchObject({ outcome: "FAILED", backupId: "none", failures: ["There is no successful backup to restore yet."] });

		const gone = harness({ stored: null });
		await gone.service.run(superAdminActor());
		expect(gone.recorded.at(0)?.failures.join(" ")).toMatch(/stored object is gone/u);

		const unset = harness({ ready: false });
		await expect(unset.service.run(superAdminActor())).resolves.toBeNull();
		expect(unset.recorded).toStrictEqual([]);
	});
});

describe("RestoreDrillService.scheduleIfDue", () => {
	it("queues a drill for this week when none ran in the last week, and not otherwise", async () => {
		const due = harness({ lastDrillAt: NOW - RESTORE_DRILL_INTERVAL_MS - 1 });
		await expect(due.service.scheduleIfDue(superAdminActor())).resolves.toBe(true);
		expect(due.queued).toStrictEqual([restoreDrillSlot(NOW)]);

		const recent = harness({ lastDrillAt: NOW - 1_000 });
		await expect(recent.service.scheduleIfDue(superAdminActor())).resolves.toBe(false);
		expect(recent.queued).toStrictEqual([]);

		const first = harness({ lastDrillAt: null });
		await expect(first.service.scheduleIfDue(superAdminActor())).resolves.toBe(true);
	});

	it("gives every instance the same slot within a week", () => {
		expect(restoreDrillSlot(NOW)).toBe(restoreDrillSlot(NOW + 1_000));
		expect(restoreDrillSlot(NOW)).not.toBe(restoreDrillSlot(NOW + RESTORE_DRILL_INTERVAL_MS));
	});
});
