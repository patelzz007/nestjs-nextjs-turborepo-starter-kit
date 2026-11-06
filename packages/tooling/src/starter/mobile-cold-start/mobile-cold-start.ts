/**
 * The pieces of `pnpm --filter @workspace/mobile cold-start` (enhancement 6.6): how long the Android app takes to
 * open from nothing (its process stopped), measured with `adb shell am start -W` several times, the median checked
 * against `budgets/mobile-startup.json`. Pure, so unit-tested without a device.
 */

import { z } from "zod";

/** Runs per measurement: the median of five shrugs off one slow start (a GC, a busy CPU) without a long wait. */
export const COLD_START_RUNS = 5;

/** `am start -W` prints `TotalTime: 1234` (milliseconds from the launch intent to the first frame). */
const TOTAL_TIME_PATTERN = /^TotalTime:\s*(?<ms>\d+)\s*$/mu;

/** `am start -W`'s outcome line: `Status: ok`, or `timeout` when the first frame took too long to report. */
const STATUS_PATTERN = /^Status:\s*(?<status>\S+)\s*$/mu;

/** Why a launch gave no time: its `Status:` line, or the first line it printed (an error). */
export function launchFailureOf(amStartOutput: string): string {
	const status = STATUS_PATTERN.exec(amStartOutput)?.groups?.status;
	if (status !== undefined) {
		return `status ${status}`;
	}
	const [firstLine = "no output"] = amStartOutput.split("\n").filter((line) => line.trim().length > 0);
	return firstLine.trim();
}

/** The launch time in `am start -W`'s output, or null when it reported none (the launch failed). */
export function totalTimeMsOf(amStartOutput: string): number | null {
	const ms = TOTAL_TIME_PATTERN.exec(amStartOutput)?.groups?.ms;
	return ms === undefined ? null : Number(ms);
}

/** The middle of the samples (the mean of the two middle ones for an even count). */
export function medianMs(samples: readonly number[]): number {
	if (samples.length === 0) {
		throw new Error("No cold-start samples: every launch failed");
	}
	const sorted = [...samples].sort((left, right) => left - right);
	const middle = Math.floor(sorted.length / 2);
	const upper = sorted.at(middle) ?? 0;
	return sorted.length % 2 === 1 ? upper : ((sorted.at(middle - 1) ?? upper) + upper) / 2;
}

/** `adb` arguments that stop the app's process, so the next launch is a cold start (its data is kept). */
export function forceStopArgs(appId: string): string[] {
	return ["shell", "am", "force-stop", appId];
}

/** `adb` arguments that launch the app's main activity and wait for its first frame. */
export function launchArgs(appId: string): string[] {
	return ["shell", "am", "start", "-W", "-n", `${appId}/.MainActivity`];
}

/**
 * A budget is a measured median + 10% (decision #57, like budgets/bundle.json), and says where it was measured:
 * a release build's cold start depends on the device, so a budget only holds on the kind of device it came from.
 */
const BudgetsSchema = z
	.object({
		android: z
			.object({
				coldStartMs: z.number().int().positive(),
				measuredMedianMs: z.number().int().positive(),
				measuredOn: z.string().min(1),
				measuredAt: z.iso.date(),
			})
			.strict()
			.refine((budget) => budget.coldStartMs >= budget.measuredMedianMs, { message: "the budget is below the median it was set from" }),
	})
	.strict();

/** The budgets file (`budgets/mobile-startup.json`), validated. */
export function parseStartupBudgets(json: string): { android: { coldStartMs: number; measuredMedianMs: number; measuredOn: string; measuredAt: string } } {
	return BudgetsSchema.parse(JSON.parse(json));
}

/** Whether a median start is within its budget, with the numbers to print. */
export function coldStartVerdict(median: number, budgetMs: number): { ok: boolean; medianMs: number; budgetMs: number } {
	return { ok: median <= budgetMs, medianMs: median, budgetMs };
}
