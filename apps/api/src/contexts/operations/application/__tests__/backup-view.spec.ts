import { epochMs } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { toBackup } from "../commands/backups/backup.handlers";
import type { OpsBackupRecord } from "../ports/operations-repositories.port";

describe("toBackup", () => {
	it("shows a backup without where its file is stored", () => {
		const record: OpsBackupRecord = {
			id: "33333333-3333-4333-8333-333333333333",
			status: "SUCCEEDED",
			trigger: "MANUAL",
			requestedByName: "Super Admin",
			createdAt: epochMs(1),
			startedAt: epochMs(2),
			finishedAt: epochMs(3),
			sizeBytes: 1_024,
			checksum: "abc",
			pgDumpVersion: "pg_dump (PostgreSQL) 18.1",
			serverVersion: "18.1",
			pinned: true,
			error: null,
			storageContainer: "private",
			storagePath: "backups/2026/10/29.dump",
		};

		const backup = toBackup(record);

		expect(backup).toEqual({
			id: record.id,
			status: "SUCCEEDED",
			trigger: "MANUAL",
			requestedByName: "Super Admin",
			createdAt: 1,
			startedAt: 2,
			finishedAt: 3,
			sizeBytes: 1_024,
			checksum: "abc",
			pgDumpVersion: "pg_dump (PostgreSQL) 18.1",
			serverVersion: "18.1",
			pinned: true,
			error: null,
		});
		expect(Object.keys(backup)).not.toContain("storagePath");
	});
});
