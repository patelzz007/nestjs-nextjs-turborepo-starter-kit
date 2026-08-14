import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";

import { epochMs, nowEpochMs, type EpochMs, type TelescopeScheduleLog, type TelescopeScheduleRun, type TelescopeScheduleStatus } from "@workspace/shared";

import { TelescopeEventBus } from "./telescope-event-bus.js";
import { TELESCOPE_STORE } from "./telescope.options.js";
import type { TelescopeStore } from "./telescope.store.js";

/** Improvement 20 — how many recent runs each schedule keeps in `history`. */
const MAX_HISTORY = 24;

/**
 * Feature 4 — scheduled-task view.
 *
 * A dependency-free mini cron scheduler that records every run into the
 * Telescope store: `register("report", "every 5 minutes", fn)` and the
 * dashboard shows last-run duration, failure state and the next run time.
 *
 * Supports the standard 5-field cron: minute hour dom month dow, with `*`,
 * step (`*\/n`), `a-b` ranges, `a,b` lists, and single values. Runs are
 * checked on a 30-second tick (cron minute resolution), so a due schedule
 * fires at most once per tick window.
 */
interface CronFields {
	readonly minute: readonly number[];
	readonly hour: readonly number[];
	readonly dom: readonly number[];
	readonly month: readonly number[];
	readonly dow: readonly number[];
}

interface RegisteredSchedule {
	readonly name: string;
	readonly cron: string;
	readonly fields: CronFields;
	readonly fn: () => Promise<void> | void;
}

/** Parse one cron field into a sorted list of matching values. */
function parseField(raw: string, min: number, max: number): readonly number[] {
	if (raw === "*") {
		return range(min, max);
	}
	if (raw.startsWith("*/")) {
		const step = Number(raw.slice(2));
		return range(min, max).filter((value: number): boolean => (value - min) % step === 0);
	}
	if (raw.includes(",")) {
		return raw.split(",").flatMap((part: string): readonly number[] => parseField(part, min, max));
	}
	if (raw.includes("-")) {
		const [fromRaw, toRaw] = raw.split("-");
		return range(Math.max(min, Number(fromRaw)), Math.min(max, Number(toRaw)));
	}
	const value = Number(raw);
	return Number.isFinite(value) && value >= min && value <= max ? [value] : [];
}

function range(from: number, to: number): readonly number[] {
	const out: number[] = [];
	for (let value = from; value <= to; value += 1) {
		out.push(value);
	}
	return out;
}

export function parseCron(cron: string): CronFields {
	const parts: readonly string[] = cron.trim().split(/\s+/);
	const [minuteRaw = "*", hourRaw = "*", domRaw = "*", monthRaw = "*", dowRaw = "*"] = parts;
	return {
		minute: parseField(minuteRaw, 0, 59),
		hour: parseField(hourRaw, 0, 23),
		dom: parseField(domRaw, 1, 31),
		month: parseField(monthRaw, 1, 12),
		dow: parseField(dowRaw, 0, 6),
	};
}

/** `* * * * *`-style: are we inside the schedule's window right now? */
function isDue(fields: CronFields, date: Date): boolean {
	return (
		fields.minute.includes(date.getMinutes()) &&
		fields.hour.includes(date.getHours()) &&
		fields.dom.includes(date.getDate()) &&
		fields.month.includes(date.getMonth() + 1) &&
		fields.dow.includes(date.getDay())
	);
}

/** Next minute-granularity match, scanning forward (bounded to 1 year). */
function nextRunAt(fields: CronFields, from: Date): EpochMs {
	const probe: Date = new Date(from);
	probe.setSeconds(0, 0);
	for (let step = 0; step < 60 * 24 * 366; step += 1) {
		if (isDue(fields, probe)) {
			return epochMs(probe.getTime());
		}
		probe.setMinutes(probe.getMinutes() + 1);
	}
	return epochMs(from.getTime() + 60 * 60 * 1000);
}

@Injectable()
export class TelescopeSchedulerService implements OnModuleInit, OnModuleDestroy {
	private readonly schedules: RegisteredSchedule[] = [];
	private readonly lastRunBySchedule = new Map<string, TelescopeScheduleLog>();
	private readonly historyBySchedule = new Map<string, TelescopeScheduleRun[]>();
	private timer: ReturnType<typeof setInterval> | null = null;

	public constructor(
		@Inject(TELESCOPE_STORE) private readonly store: TelescopeStore,
		private readonly eventBus: TelescopeEventBus,
	) {}

	public onModuleInit(): void {
		// Sync every schedule's initial row so the page shows registered tasks.
		for (const schedule of this.schedules) {
			this.store.upsertSchedule(this.snapshot(schedule));
		}
		// 30s tick — cron has minute resolution, so this cannot double-fire.
		this.timer = setInterval((): void => {
			void this.tick();
		}, 30_000);
	}

	public onModuleDestroy(): void {
		if (this.timer !== null) {
			clearInterval(this.timer);
		}
	}

	/** Registers a named cron task. Call from a module's `onModuleInit`. */
	public register(name: string, cron: string, fn: () => Promise<void> | void): void {
		this.schedules.push({ name, cron, fields: parseCron(cron), fn });
		this.store.upsertSchedule(this.snapshot({ name, cron, fields: parseCron(cron), fn }));
	}

	/**
	 * Feature 12 — run a registered schedule on demand (the UI's "Run now"
	 * button). Records the run through the same path as a cron tick, so the
	 * schedule's history + the SSE `schedule` frame behave identically.
	 * Returns the updated schedule row, or `undefined` if no such name.
	 */
	public async runNow(name: string): Promise<TelescopeScheduleLog | undefined> {
		const schedule: RegisteredSchedule | undefined = this.schedules.find((candidate: RegisteredSchedule): boolean => candidate.name === name);
		if (schedule === undefined) {
			return undefined;
		}
		await this.runSchedule(schedule);
		return this.store.listSchedules().find((candidate: TelescopeScheduleLog): boolean => candidate.name === name);
	}

	private async tick(): Promise<void> {
		const now: Date = new Date();
		for (const schedule of this.schedules) {
			if (!isDue(schedule.fields, now)) {
				continue;
			}
			await this.runSchedule(schedule);
		}
	}

	private async runSchedule(schedule: RegisteredSchedule): Promise<void> {
		const start: number = performance.now();
		const startedAt: EpochMs = nowEpochMs();
		let status: TelescopeScheduleStatus = "succeeded";
		let error: string | null = null;
		try {
			await schedule.fn();
		} catch (caught) {
			status = "failed";
			error = caught instanceof Error ? caught.message : String(caught);
		}
		const durationMs: number = Math.round(performance.now() - start);
		// Improvement 20 — append to this schedule's run history (oldest-first, capped).
		const history: TelescopeScheduleRun[] = [...(this.historyBySchedule.get(schedule.name) ?? []), { at: startedAt, status, durationMs }].slice(-MAX_HISTORY);
		this.historyBySchedule.set(schedule.name, history);
		const log: TelescopeScheduleLog = {
			name: schedule.name,
			cron: schedule.cron,
			status,
			lastRunAt: startedAt,
			lastDurationMs: durationMs,
			lastError: error,
			nextRunAt: nextRunAt(schedule.fields, new Date(Date.now() + 60 * 1000)),
			history,
		};
		this.lastRunBySchedule.set(schedule.name, log);
		this.store.upsertSchedule(log);
		// Publish a `schedule` frame so the /telescope/schedules page refetches
		// on push instead of polling — a card flips to succeeded/failed live.
		this.eventBus.publish({
			type: "schedule",
			id: schedule.name,
			scheduleName: schedule.name,
			scheduleStatus: log.status,
			durationMs: log.lastDurationMs ?? undefined,
		});
	}

	/** The schedule row to display before its first run. */
	private snapshot(schedule: RegisteredSchedule): TelescopeScheduleLog {
		const last: TelescopeScheduleLog | undefined = this.lastRunBySchedule.get(schedule.name);
		if (last !== undefined) {
			return last;
		}
		const status: TelescopeScheduleStatus = "pending";
		return {
			name: schedule.name,
			cron: schedule.cron,
			status,
			lastRunAt: null,
			lastDurationMs: null,
			lastError: null,
			nextRunAt: nextRunAt(schedule.fields, new Date()),
			history: this.historyBySchedule.get(schedule.name) ?? [],
		};
	}
}
