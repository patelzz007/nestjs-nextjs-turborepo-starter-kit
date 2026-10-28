// ============================================
// domain/policies/backup-schedule.policy.ts — when the daily backup is due
// ============================================
// Pure functions (no I/O). The hour is wall-clock time in the platform's time zone, so a backup at
// 03:00 stays at 03:00 across daylight-saving changes.

import { epochMs, type EpochMs } from "@workspace/shared";

const MS_PER_HOUR = 3_600_000;
const HOURS_PER_DAY = 24;
const MS_PER_DAY = HOURS_PER_DAY * MS_PER_HOUR;

/** The wall-clock hour (0–23) `at` falls in, in `timeZone`. */
export function hourIn(at: EpochMs, timeZone: string): number {
	const hour: string = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(at);
	return Number.parseInt(hour, 10);
}

/**
 * The start of the UTC hour `at` falls in. In a zone offset by a whole number of hours that is also the
 * local hour's start; in a half-hour zone (India) the backup starts half-way into the named hour.
 */
function hourStart(at: number): number {
	return Math.floor(at / MS_PER_HOUR) * MS_PER_HOUR;
}

/**
 * The next time the daily backup starts: the first start of an hour after `now` whose wall-clock hour
 * in `timeZone` is `backupHour`.
 */
export function nextScheduledBackupAt(backupHour: number, timeZone: string, now: EpochMs): EpochMs {
	for (let candidate = hourStart(now) + MS_PER_HOUR; candidate <= now + MS_PER_DAY + MS_PER_HOUR; candidate += MS_PER_HOUR) {
		if (hourIn(epochMs(candidate), timeZone) === backupHour) {
			return epochMs(candidate);
		}
	}
	return epochMs(hourStart(now) + MS_PER_DAY);
}

/**
 * Whether the daily backup is due at `now`: it is the backup hour, and no scheduled backup has been
 * taken in the last {@link HOURS_PER_DAY} − 1 hours (so a clock-hour check that runs several times in
 * that hour starts it once).
 */
export function isScheduledBackupDue(backupHour: number, timeZone: string, lastScheduledAt: EpochMs | null, now: EpochMs): boolean {
	if (hourIn(now, timeZone) !== backupHour) {
		return false;
	}
	return lastScheduledAt === null || now - lastScheduledAt > MS_PER_DAY - MS_PER_HOUR;
}

/** The backups the retention removes: finished, not pinned, older than `retentionDays`. */
export function expiredBackupIds(
	backups: readonly { readonly id: string; readonly createdAt: EpochMs; readonly pinned: boolean }[],
	retentionDays: number,
	now: EpochMs,
): string[] {
	const cutoff: number = now - retentionDays * MS_PER_DAY;
	return backups.filter((backup) => !backup.pinned && backup.createdAt < cutoff).map((backup) => backup.id);
}
