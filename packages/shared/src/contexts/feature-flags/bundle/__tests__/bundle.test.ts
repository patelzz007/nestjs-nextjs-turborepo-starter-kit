import { describe, expect, it, vi } from "vitest";

import { epochMs } from "../../../../schemas/api/common";
import type { Exposure, FeatureFlagBundle } from "../../schemas/bundle";
import { configExposure, configResultOf, configValueOf, flagExposure, flagResultOf, isFlagOn } from "../bundle-values";
import { EXPOSURE_FLUSH_MS, ExposureQueue, type ExposureTimers } from "../exposure-queue";

const RULE = "019b76da-a800-7000-8000-0000000000a1";
const NOW = 1_800_000_000_000;
const BATCH = 50;

const BUNDLE: FeatureFlagBundle = {
	version: 3,
	app: "web",
	evaluatedAt: epochMs(NOW),
	nextChangeAt: null,
	flags: [{ key: "web-activity", on: false, source: "KILL_SWITCH", revision: null, ruleId: null }],
	configs: [{ key: "reward-claim-cta", valueName: "bold", value: { emphasis: "bold" }, source: "RULE", revision: 1, ruleId: RULE, experimentId: null, variant: null }],
};

describe("bundle values", () => {
	it("answers the bundle's value, else the code default", () => {
		expect(isFlagOn(BUNDLE, "web-activity")).toBe(false);
		expect(isFlagOn(null, "web-activity")).toBe(true);
		expect(isFlagOn(BUNDLE, "showcase")).toBe(false);
	});

	it("finds a result only when the bundle carries it", () => {
		expect(flagResultOf(BUNDLE, "web-activity")).toMatchObject({ source: "KILL_SWITCH" });
		expect(flagResultOf(BUNDLE, "showcase")).toBeNull();
		expect(configResultOf(null, "reward-claim-cta")).toBeNull();
	});

	it("checks a config value against its declared shape, falling back to the default", () => {
		expect(configValueOf(BUNDLE, "reward-claim-cta")).toStrictEqual({ emphasis: "bold" });
		const broken: FeatureFlagBundle = { ...BUNDLE, configs: BUNDLE.configs.map((config) => ({ ...config, value: { emphasis: "neon" } })) };
		expect(configValueOf(broken, "reward-claim-cta")).toStrictEqual({ emphasis: "standard" });
		expect(configValueOf(null, "reward-claim-cta")).toStrictEqual({ emphasis: "standard" });
	});

	it("turns rendered results into exposures", () => {
		const [flag] = BUNDLE.flags;
		const [config] = BUNDLE.configs;
		expect(flag === undefined ? null : flagExposure(flag, epochMs(NOW))).toStrictEqual({
			kind: "FLAG",
			key: "web-activity",
			on: false,
			source: "KILL_SWITCH",
			revision: null,
			ruleId: null,
			at: NOW,
		});
		expect(config === undefined ? null : configExposure(config, epochMs(NOW))).toMatchObject({ kind: "CONFIG", valueName: "bold", ruleId: RULE });
	});
});

describe("ExposureQueue", () => {
	function exposure(on: boolean): Exposure {
		return { kind: "FLAG", key: "web-activity", on, source: "RULE", revision: 1, ruleId: null, at: epochMs(NOW) };
	}

	function fakeTimers(): ExposureTimers & { readonly fire: () => void; readonly pending: () => number } {
		let callback: (() => void) | null = null;
		return {
			setTimeout: (next: () => void, delayMs: number): number => {
				expect(delayMs).toBe(EXPOSURE_FLUSH_MS);
				callback = next;
				return 1;
			},
			clearTimeout: (): void => {
				callback = null;
			},
			fire: (): void => callback?.(),
			pending: (): number => (callback === null ? 0 : 1),
		};
	}

	it("notes each decision once per session and sends after the flush delay", async () => {
		const sent: (readonly Exposure[])[] = [];
		const timers = fakeTimers();
		const queue = new ExposureQueue((batch) => {
			sent.push(batch);
			return Promise.resolve();
		}, timers);
		queue.note(exposure(true));
		queue.note(exposure(true));
		queue.note(exposure(false));
		expect(timers.pending()).toBe(1);
		timers.fire();
		await vi.waitFor((): void => {
			expect(sent).toHaveLength(1);
		});
		const [firstBatch] = sent;
		expect(firstBatch).toHaveLength(2);
		queue.reset();
		queue.note(exposure(true));
		await queue.flush();
		expect(sent).toHaveLength(2);
	});

	it("sends at once when a full batch is waiting, and never throws when sending fails", async () => {
		const send = vi.fn((): Promise<void> => Promise.reject(new Error("offline")));
		const queue = new ExposureQueue(send, fakeTimers());
		for (let index = 0; index < BATCH; index += 1) {
			queue.note({ ...exposure(true), revision: index + 1 });
		}
		await vi.waitFor((): void => {
			expect(send).toHaveBeenCalledTimes(1);
		});
		await expect(queue.flush()).resolves.toBeUndefined();
	});
});
