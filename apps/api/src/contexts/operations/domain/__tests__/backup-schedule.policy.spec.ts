import { epochMs } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { expiredBackupIds, hourIn, isScheduledBackupDue, nextScheduledBackupAt } from "../policies/backup-schedule.policy";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** 2026-10-28T00:00:00Z. */
const MIDNIGHT_UTC = Date.UTC(2026, 9, 28);
const KL = "Asia/Kuala_Lumpur";

describe("hourIn", () => {
	it("reads the wall-clock hour in a time zone", () => {
		expect(hourIn(epochMs(MIDNIGHT_UTC), "UTC")).toBe(0);
		expect(hourIn(epochMs(MIDNIGHT_UTC), KL)).toBe(8);
	});
});

describe("nextScheduledBackupAt", () => {
	it("is the next start of the backup hour in the zone", () => {
		// 03:00 in Kuala Lumpur is 19:00 UTC the day before.
		expect(nextScheduledBackupAt(3, KL, epochMs(MIDNIGHT_UTC))).toBe(MIDNIGHT_UTC + 19 * HOUR);
		expect(nextScheduledBackupAt(1, "UTC", epochMs(MIDNIGHT_UTC + 30 * 60_000))).toBe(MIDNIGHT_UTC + HOUR);
	});

	it("is tomorrow's when the hour has already started today", () => {
		expect(nextScheduledBackupAt(0, "UTC", epochMs(MIDNIGHT_UTC + 60_000))).toBe(MIDNIGHT_UTC + DAY);
	});
});

describe("isScheduledBackupDue", () => {
	const inHour = epochMs(MIDNIGHT_UTC + 2 * HOUR + 60_000);

	it("is due in the backup hour when no scheduled backup was taken today", () => {
		expect(isScheduledBackupDue(2, "UTC", null, inHour)).toBe(true);
		expect(isScheduledBackupDue(2, "UTC", epochMs(inHour - DAY), inHour)).toBe(true);
	});

	it("starts it once per day, and only in its hour", () => {
		expect(isScheduledBackupDue(2, "UTC", epochMs(inHour - 30_000), inHour)).toBe(false);
		expect(isScheduledBackupDue(3, "UTC", null, inHour)).toBe(false);
	});
});

describe("expiredBackupIds", () => {
	it("removes unpinned backups older than the retention", () => {
		const now = epochMs(MIDNIGHT_UTC);
		const backups = [
			{ id: "old", createdAt: epochMs(now - 8 * DAY), pinned: false },
			{ id: "old-pinned", createdAt: epochMs(now - 8 * DAY), pinned: true },
			{ id: "recent", createdAt: epochMs(now - DAY), pinned: false },
		];

		expect(expiredBackupIds(backups, 7, now)).toEqual(["old"]);
	});
});
